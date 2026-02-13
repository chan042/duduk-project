"""
[파일 역할]
- 사용자 프로필 관련 API 뷰를 정의합니다.
- 프로필 조회, 수정, 삭제 기능을 제공합니다.
- 윤택지수 점수 및 월간 AI 분석 리포트 API를 제공합니다.
- 로그인은 Google OAuth를 사용합니다.
"""
import logging
from django.db import transaction

from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.contrib.auth import get_user_model

from .serializers import UserSerializer
from .services import (
    get_target_month,
    is_new_user_for_month,
    collect_report_data,
    get_new_user_default_report,
    save_report_cache,
    save_report_and_persona,
)

User = get_user_model()
logger = logging.getLogger(__name__)


class ProfileView(APIView):
    """
    사용자 프로필 조회/수정/삭제 API
    GET /api/users/profile/ - 현재 로그인한 사용자 정보 조회
    PATCH /api/users/profile/ - 사용자 정보 수정
    DELETE /api/users/profile/ - 회원 탈퇴 (관련 데이터 모두 삭제)
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)

    def patch(self, request):
        old_monthly_budget = request.user.monthly_budget
        serializer = UserSerializer(
            request.user,
            data=request.data,
            partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()

        # monthly_budget 변경 시 일일 권장 예산 스냅샷 재계산
        new_monthly_budget = request.user.monthly_budget
        if old_monthly_budget != new_monthly_budget:
            from django.utils import timezone
            from apps.transactions.services import recalculate_snapshots_from_date
            today = timezone.localdate()
            first_day_of_month = today.replace(day=1)
            recalculate_snapshots_from_date(request.user, first_day_of_month)

        return Response(serializer.data)

    def delete(self, request):
        """
        회원 탈퇴 API
        사용자 삭제 시 관련된 모든 데이터(Transaction, Coaching 등)가 CASCADE로 자동 삭제됩니다.
        """
        user = request.user
        user_email = user.email
        user.delete()

        return Response({
            "message": f"'{user_email}' 계정이 성공적으로 삭제되었습니다."
        }, status=status.HTTP_200_OK)


class YuntaekScoreView(APIView):
    """
    윤택지수 점수 조회 API
    GET /api/users/yuntaek-score/?year=YYYY&month=MM
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from .yuntaek_score import get_yuntaek_score

        year, month = get_target_month(
            request.query_params.get('year'),
            request.query_params.get('month'),
        )

        if is_new_user_for_month(request.user, year, month):
            return Response({
                'total_score': 0,
                'max_score': 100,
                'year': year,
                'month': month,
                'breakdown': {},
                'is_new_user': True,
            })

        score_data = get_yuntaek_score(request.user, year, month)

        return Response({
            'total_score': score_data.get('total_score', 0),
            'max_score': 100,
            'year': year,
            'month': month,
            'breakdown': score_data.get('breakdown', {}),
            'is_new_user': False,
        })


class MonthlyReportView(APIView):
    """
    월간 AI 분석 리포트 조회 API
    GET /api/users/yuntaek-report/?year=YYYY&month=MM&refresh=false

    캐싱 메커니즘:
    1. 캐시된 리포트 확인
    2. 캐시가 있고 refresh=false이면 캐시 반환
    3. 캐시가 없거나 refresh=true이면 새로 생성
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from .models import MonthlyReport
        from external.gemini.client import GeminiClient

        year, month = get_target_month(
            request.query_params.get('year'),
            request.query_params.get('month'),
        )
        refresh = request.query_params.get('refresh', 'false').lower() == 'true'

        # 캐시된 리포트 확인
        cached_report = MonthlyReport.objects.filter(
            user=request.user, year=year, month=month
        ).first()

        if cached_report and not refresh:
            return Response({
                'year': year,
                'month': month,
                'report': cached_report.report_content,
                'generated_at': cached_report.created_at,
                'cached': True,
                'is_new_user': 'guide' in cached_report.report_content,
            })

        # 신규 사용자 처리
        if is_new_user_for_month(request.user, year, month):
            default_report = get_new_user_default_report(year, month)
            saved = save_report_cache(request.user, year, month, default_report)
            return Response({
                'year': year,
                'month': month,
                'report': default_report,
                'generated_at': saved.updated_at,
                'cached': False,
                'is_new_user': True,
            })

        # 데이터 수집 + AI 리포트 생성
        try:
            report_data = collect_report_data(request.user, year, month)
            client = GeminiClient(purpose="analysis")
            ai_result = client.generate_monthly_report(report_data)

            if not ai_result or not isinstance(ai_result, dict):
                return Response(
                    {'error': '리포트 형식이 올바르지 않습니다.'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

            # 리포트 저장 + 페르소나 업데이트
            saved, report_content = save_report_and_persona(
                request.user, year, month, ai_result
            )
        except Exception as e:
            logger.error(f"월간 리포트 생성 중 오류: {e}", exc_info=True)
            return Response(
                {'error': f'리포트 생성 중 오류가 발생했습니다: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response({
            'year': year,
            'month': month,
            'report': report_content,
            'generated_at': saved.updated_at,
            'cached': False,
            'is_new_user': False,
        })

class GameRewardView(APIView):
    """
    게임 보상 API
    POST /api/users/game-reward/ - 게임에서 획득한 포인트를 적립
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        points = request.data.get('points', 0)

        # 포인트 유효성 검증
        if not isinstance(points, int) or points < 0:
            return Response(
                {'error': '유효하지 않은 포인트 값입니다.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 최대 적립 제한 (악용 방지: 한 번에 최대 300포인트)
        if points > 300:
            points = 300

        if points == 0:
            return Response({
                'success': True,
                'earned_points': 0,
                'total_points': request.user.points,
            })

        try:
            with transaction.atomic():
                user = request.user
                user.points += points
                user.total_points_earned += points
                user.save(update_fields=['points', 'total_points_earned'])

                return Response({
                    'success': True,
                    'earned_points': points,
                    'total_points': user.points,
                })
        except Exception as e:
            logger.error(f"게임 보상 적립 중 오류: {e}", exc_info=True)
            return Response(
                {'error': '포인트 적립 중 오류가 발생했습니다.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

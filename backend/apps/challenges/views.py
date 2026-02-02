from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from django.utils import timezone
from django.db.models import Sum, OuterRef, Subquery

from .models import ChallengeTemplate, UserChallenge, ChallengeDailyLog
from .serializers import (
    ChallengeTemplateSerializer, ChallengeTemplateListSerializer,
    UserChallengeSerializer, UserChallengeListSerializer,
    UserChallengeCreateSerializer, CustomChallengeCreateSerializer,
    ChallengeDailyLogSerializer,
    UserPointsSerializer,
    AIChallengGenerateSerializer, AIChallengePreviewSerializer, AIChallengeStartSerializer,
    CoachingChallengeGenerateSerializer, CoachingChallengePreviewSerializer, CoachingChallengeStartSerializer
)
from external.gemini.client import GeminiClient


class ChallengeTemplateViewSet(viewsets.ReadOnlyModelViewSet):
    """
    챌린지 템플릿 조회 API
    
    GET /api/challenges/templates/ - 템플릿 목록 (탭별 필터링)
    GET /api/challenges/templates/<id>/ - 템플릿 상세
    """
    queryset = ChallengeTemplate.objects.filter(is_active=True)
    permission_classes = [IsAuthenticated]
    
    def get_serializer_class(self):
        if self.action == 'list':
            return ChallengeTemplateListSerializer
        return ChallengeTemplateSerializer
    
    def get_queryset(self):
        queryset = super().get_queryset()
        tab = self.request.query_params.get('tab')
        
        if tab == 'duduk':
            queryset = queryset.filter(source_type='duduk')
        elif tab == 'event':
            queryset = queryset.filter(source_type='event')
            # 이벤트 챌린지는 현재 활성 상태인 것만
            now = timezone.now()
            queryset = queryset.filter(
                event_start_at__lte=now,
                event_end_at__gte=now
            )
        
        # 사용자별 챌린지 정보 Annotate
        if self.request.user.is_authenticated:
            latest_challenge = UserChallenge.objects.filter(
                user=self.request.user,
                template=OuterRef('pk')
            ).order_by('-created_at')

            queryset = queryset.annotate(
                my_challenge_id=Subquery(latest_challenge.values('id')[:1]),
                my_challenge_status=Subquery(latest_challenge.values('status')[:1])
            )

        return queryset.order_by('display_order', '-created_at')


class UserChallengeViewSet(viewsets.ModelViewSet):
    """
    사용자 챌린지 관리 API
    
    GET /api/challenges/my/ - 내 챌린지 목록
    GET /api/challenges/my/<id>/ - 내 챌린지 상세
    POST /api/challenges/my/ - 템플릿 기반 챌린지 시작
    POST /api/challenges/my/<id>/cancel/ - 챌린지 취소
    POST /api/challenges/my/<id>/retry/ - 챌린지 재도전
    """
    permission_classes = [IsAuthenticated]
    
    def get_serializer_class(self):
        if self.action == 'list':
            return UserChallengeListSerializer
        elif self.action == 'create':
            return UserChallengeCreateSerializer
        elif self.action == 'create_custom':
            return CustomChallengeCreateSerializer
        return UserChallengeSerializer
    
    def get_queryset(self):
        queryset = UserChallenge.objects.filter(user=self.request.user)
        status_filter = self.request.query_params.get('status')
        source_type = self.request.query_params.get('source_type')
        
        if status_filter == 'active':
            queryset = queryset.filter(status='active')
        elif status_filter == 'completed':
            queryset = queryset.filter(status='completed')
        elif status_filter == 'failed':
            queryset = queryset.filter(status='failed')
        elif status_filter == 'finished':
            queryset = queryset.filter(status__in=['completed', 'failed'])
        
        if source_type:
            queryset = queryset.filter(source_type=source_type)
        
        return queryset.order_by('-started_at')

    def create(self, request, *args, **kwargs):
        """템플릿 기반 챌린지 시작"""
        serializer = UserChallengeCreateSerializer(
            data=request.data,
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        user_challenge = serializer.save()
        
        return Response(
            UserChallengeSerializer(user_challenge).data,
            status=status.HTTP_201_CREATED
        )

    @action(detail=False, methods=['post'])
    def create_custom(self, request):
        """사용자 커스텀 챌린지 생성"""
        serializer = CustomChallengeCreateSerializer(
            data=request.data,
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        user_challenge = serializer.save()

        return Response(
            UserChallengeSerializer(user_challenge).data,
            status=status.HTTP_201_CREATED
        )

    @action(detail=False, methods=['post'])
    def generate_ai(self, request):
        """
        AI 챌린지 생성 (미리보기)

        사용자가 입력한 제목, 상세내용, 난이도를 바탕으로
        Gemini가 챌린지를 생성합니다. 저장되지 않고 미리보기만 반환합니다.
        """
        serializer = AIChallengGenerateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        details = serializer.validated_data['details']
        difficulty = serializer.validated_data['difficulty']

        # 사용자 지출 요약 생성
        user_spending_summary = self._get_user_spending_summary(request.user)

        # Gemini로 챌린지 생성
        gemini_client = GeminiClient()
        generated_challenge = gemini_client.generate_challenge(
            details=details,
            difficulty=difficulty,
            user_spending_summary=user_spending_summary
        )

        if not generated_challenge:
            return Response(
                {'error': 'AI 챌린지 생성에 실패했습니다. 다시 시도해주세요.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        # 미리보기 데이터 직렬화
        preview_serializer = AIChallengePreviewSerializer(data=generated_challenge)
        if preview_serializer.is_valid():
            return Response(preview_serializer.data, status=status.HTTP_200_OK)
        else:
            # 유효성 검사 실패해도 원본 데이터 반환
            return Response(generated_challenge, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'])
    def start_ai(self, request):
        """
        AI 챌린지 시작 (수정 후 저장)
        generate_ai로 생성된 챌린지를 사용자가 수정한 후 시작합니다.
        """
        serializer = AIChallengeStartSerializer(
            data=request.data,
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        user_challenge = serializer.save()

        return Response(
            UserChallengeSerializer(user_challenge).data,
            status=status.HTTP_201_CREATED
        )

    def _get_user_spending_summary(self, user):
        """사용자 최근 지출 요약 생성"""
        try:
            from apps.transactions.models import Transaction
            from django.db.models import Sum
            from datetime import timedelta

            now = timezone.now()
            month_ago = now - timedelta(days=30)

            # 최근 30일 카테고리별 지출
            transactions = Transaction.objects.filter(
                user=user,
                date__gte=month_ago
            ).values('category').annotate(
                total=Sum('amount')
            ).order_by('-total')[:5]

            if not transactions:
                return None

            summary_lines = ["최근 30일 주요 지출:"]
            for t in transactions:
                category = t['category'] or '기타'
                total = t['total'] or 0
                summary_lines.append(f"- {category}: {total:,}원")

            return "\n".join(summary_lines)
        except Exception:
            return None

    @action(detail=False, methods=['post'])
    def generate_from_coaching(self, request):
        """
        코칭 기반 AI 챌린지 생성

        생성된 코칭 카드를 바탕으로 Gemini가 챌린지를 생성합니다.
        저장되지 않고 미리보기만 반환합니다.
        """
        serializer = CoachingChallengeGenerateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        coaching_id = serializer.validated_data['coaching_id']
        difficulty = serializer.validated_data['difficulty']

        # 코칭 데이터 조회
        from apps.coaching.models import Coaching
        try:
            coaching = Coaching.objects.get(id=coaching_id, user=request.user)
        except Coaching.DoesNotExist:
            return Response(
                {'error': '코칭을 찾을 수 없습니다.'},
                status=status.HTTP_404_NOT_FOUND
            )

        # 코칭 데이터를 dict로 변환
        coaching_data = {
            'id': coaching.id,
            'title': coaching.title,
            'subject': coaching.subject,
            'analysis': coaching.analysis,
            'coaching_content': coaching.coaching_content
        }

        # Gemini로 챌린지 생성
        gemini_client = GeminiClient()
        generated_challenge = gemini_client.generate_challenge_from_coaching(
            coaching_data=coaching_data,
            difficulty=difficulty
        )

        if not generated_challenge:
            return Response(
                {'error': 'AI 챌린지 생성에 실패했습니다. 다시 시도해주세요.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        # 미리보기 데이터 직렬화
        preview_serializer = CoachingChallengePreviewSerializer(data=generated_challenge)
        if preview_serializer.is_valid():
            return Response(preview_serializer.data, status=status.HTTP_200_OK)
        else:
            return Response(generated_challenge, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'])
    def start_from_coaching(self, request):
        """
        코칭 기반 AI 챌린지 시작 (수정 후 저장)

        generate_from_coaching으로 생성된 챌린지를 사용자가 수정한 후 시작합니다.
        """
        serializer = CoachingChallengeStartSerializer(
            data=request.data,
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        user_challenge = serializer.save()

        return Response(
            UserChallengeSerializer(user_challenge).data,
            status=status.HTTP_201_CREATED
        )

    @action(detail=True, methods=['post'])
    def start(self, request, pk=None):
        """저장된 챌린지 시작"""
        user_challenge = self.get_object()
        
        if user_challenge.status != 'ready':
            return Response(
                {'error': '대기 중인 챌린지만 시작할 수 있습니다.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        from datetime import timedelta
        now = timezone.now()
        user_challenge.status = 'active'
        user_challenge.started_at = now
        user_challenge.ends_at = now + timedelta(days=user_challenge.duration_days)
        user_challenge.save()
        
        return Response(
            UserChallengeSerializer(user_challenge).data,
            status=status.HTTP_200_OK
        )

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """챌린지 취소 - 레코드 삭제"""
        user_challenge = self.get_object()
        
        if user_challenge.status != 'active':
            return Response(
                {'error': '진행 중인 챌린지만 취소할 수 있습니다.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # 취소 시 레코드 삭제
        user_challenge.delete()
        
        return Response({'message': '챌린지가 취소되었습니다.'})

    @action(detail=True, methods=['post'])
    def retry(self, request, pk=None):
        """챌린지 재도전"""
        user_challenge = self.get_object()

        if user_challenge.status == 'active':
            return Response(
                {'error': '이미 진행 중인 챌린지입니다.'},
                status=status.HTTP_400_BAD_REQUEST
            )


        user_challenge.daily_logs.all().delete()

        # 챌린지 상태 초기화
        now = timezone.now()
        duration_days = user_challenge.duration_days

        user_challenge.status = 'active'
        user_challenge.started_at = now
        user_challenge.ends_at = now + timezone.timedelta(days=duration_days)
        user_challenge.attempt_number += 1
        user_challenge.final_spent = None
        user_challenge.earned_points = 0
        user_challenge.penalty_points = 0
        user_challenge.bonus_earned = False
        user_challenge.completed_at = None

        # progress 초기화
        user_challenge.progress = self._create_retry_progress(user_challenge)

        # 랜덤 예산 챌린지: 새 랜덤 예산 생성
        display_config = user_challenge.display_config or {}
        if display_config.get('progress_type') == 'random_budget':
            import random
            new_budget = random.randint(30000, 100000)
            system_values = user_challenge.system_generated_values or {}
            system_values['random_budget'] = new_budget
            user_challenge.system_generated_values = system_values
            user_challenge.progress['target'] = new_budget
            user_challenge.progress['remaining'] = new_budget

        user_challenge.save()

        return Response(
            UserChallengeSerializer(user_challenge).data,
            status=status.HTTP_200_OK
        )

    def _create_retry_progress(self, user_challenge):
        """재도전 시 초기 progress 생성"""
        display_config = user_challenge.display_config or {}
        progress_type = display_config.get('progress_type', 'amount')
        success_conditions = user_challenge.success_conditions or {}

        if progress_type == 'amount':
            target = user_challenge.user_input_values.get('target_amount') or \
                     success_conditions.get('target_amount', 0)
            return {
                "type": "amount",
                "current": 0,
                "target": target,
                "percentage": 0,
                "is_on_track": True,
                "remaining": target
            }
        elif progress_type == 'zero_spend':
            return {
                "type": "zero_spend",
                "current": 0,
                "target_categories": success_conditions.get('categories', []),
                "is_violated": False,
                "violation_amount": 0,
                "is_on_track": True
            }
        elif progress_type == 'daily_check':
            return {
                "type": "daily_check",
                "checked_days": 0,
                "total_days": user_challenge.duration_days,
                "percentage": 0,
                "daily_status": [],
                "is_on_track": True
            }
        elif progress_type == 'photo':
            required = user_challenge.duration_days if user_challenge.photo_frequency == 'daily' else 1
            return {
                "type": "photo",
                "photo_count": 0,
                "required_count": required,
                "percentage": 0,
                "photos": [],
                "is_on_track": True
            }
        elif progress_type == 'compare':
            compare_base = success_conditions.get('compare_base', 0)
            return {
                "type": "compare",
                "current": 0,
                "compare_base": compare_base,
                "target": compare_base,
                "compare_label": success_conditions.get('compare_label', '비교 기준'),
                "difference": 0,
                "percentage": 0,
                "is_on_track": True
            }
        elif progress_type == 'daily_rule':
            return {
                "type": "daily_rule",
                "daily_status": [],
                "passed_days": 0,
                "total_days": user_challenge.duration_days,
                "is_on_track": True,
                "has_violation": False
            }
        elif progress_type == 'random_budget':
            return {
                "type": "random_budget",
                "current": 0,
                "target": 0,
                "percentage": 0,
                "is_on_track": True,
                "remaining": 0,
                "potential_points": 0,
                "jackpot_eligible": False,
                "difference_percent": 100
            }
        else:
            return {"type": progress_type, "is_on_track": True}

    @action(detail=True, methods=['get'])
    def daily_logs(self, request, pk=None):
        """일별 로그 조회"""
        user_challenge = self.get_object()
        logs = user_challenge.daily_logs.order_by('-log_date')
        serializer = ChallengeDailyLogSerializer(logs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def check_daily(self, request, pk=None):
        """일일 체크"""
        user_challenge = self.get_object()
        
        if user_challenge.status != 'active':
            return Response(
                {'error': '진행 중인 챌린지만 체크할 수 있습니다.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not user_challenge.requires_daily_check:
            return Response(
                {'error': '일일 체크가 필요한 챌린지가 아닙니다.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        today = timezone.now().date()
        log, created = ChallengeDailyLog.objects.get_or_create(
            user_challenge=user_challenge,
            log_date=today,
            defaults={'is_checked': True, 'checked_at': timezone.now()}
        )
        
        if not created and log.is_checked:
            return Response(
                {'error': '오늘은 이미 체크했습니다.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not log.is_checked:
            log.is_checked = True
            log.checked_at = timezone.now()
            log.save()
        
        # progress 업데이트
        self._update_daily_check_progress(user_challenge)
        
        return Response({
            'message': '체크 완료!',
            'log': ChallengeDailyLogSerializer(log).data,
            'progress': user_challenge.progress
        })

    @action(detail=True, methods=['post'])
    def upload_photo(self, request, pk=None):
        """사진 인증 업로드"""
        user_challenge = self.get_object()
        
        if user_challenge.status != 'active':
            return Response(
                {'error': '진행 중인 챌린지만 사진 인증할 수 있습니다.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not user_challenge.requires_photo:
            return Response(
                {'error': '사진 인증이 필요한 챌린지가 아닙니다.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        photo_url = request.data.get('photo_url')
        if not photo_url:
            return Response(
                {'error': '사진 URL이 필요합니다.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        today = timezone.now().date()
        log, _ = ChallengeDailyLog.objects.get_or_create(
            user_challenge=user_challenge,
            log_date=today
        )
        
        # 사진 URL 추가
        photo_urls = log.photo_urls or []
        photo_urls.append({
            'url': photo_url,
            'uploaded_at': timezone.now().isoformat(),
            'verified': False
        })
        log.photo_urls = photo_urls
        log.save()
        
        # progress 업데이트
        self._update_photo_progress(user_challenge)
        
        return Response({
            'message': '사진 업로드 완료!',
            'log': ChallengeDailyLogSerializer(log).data,
            'progress': user_challenge.progress
        })

    def _update_daily_check_progress(self, user_challenge):
        """일일 체크 progress 업데이트"""
        checked_count = user_challenge.daily_logs.filter(is_checked=True).count()
        total_days = user_challenge.duration_days
        percentage = round((checked_count / total_days) * 100, 1) if total_days > 0 else 0
        
        daily_status = list(
            user_challenge.daily_logs.order_by('log_date').values(
                'log_date', 'is_checked', 'spent_amount'
            )
        )
        
        progress = {
            "type": "daily_check",
            "checked_days": checked_count,
            "total_days": total_days,
            "percentage": percentage,
            "daily_status": [
                {
                    "date": str(d['log_date']),
                    "checked": d['is_checked'],
                    "amount": d['spent_amount']
                }
                for d in daily_status
            ],
            "is_on_track": checked_count > 0
        }
        
        user_challenge.update_progress(progress)

    def _update_photo_progress(self, user_challenge):
        """사진 인증 progress 업데이트"""
        total_photos = 0
        photos = []
        
        for log in user_challenge.daily_logs.order_by('log_date'):
            for photo in (log.photo_urls or []):
                total_photos += 1
                photos.append({
                    "date": str(log.log_date),
                    "url": photo.get('url'),
                    "verified": photo.get('verified', False)
                })
        
        required_count = user_challenge.duration_days if user_challenge.photo_frequency == 'daily' else 1
        percentage = round((total_photos / required_count) * 100, 1) if required_count > 0 else 0
        
        progress = {
            "type": "photo",
            "photo_count": total_photos,
            "required_count": required_count,
            "percentage": min(100, percentage),
            "photos": photos,
            "is_on_track": total_photos > 0
        }
        
        user_challenge.update_progress(progress)


class UserPointsView(APIView):
    """
    사용자 포인트 조회 API
    
    GET /api/challenges/points/ - 내 포인트 조회
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        user = request.user
        data = {
            'points': user.points,
            'total_points_earned': user.total_points_earned,
            'total_points_used': user.total_points_used
        }
        serializer = UserPointsSerializer(data)
        return Response(serializer.data)


class ChallengeDailyLogViewSet(viewsets.ModelViewSet):
    """
    챌린지 일별 로그 API
    """
    serializer_class = ChallengeDailyLogSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return ChallengeDailyLog.objects.filter(
            user_challenge__user=self.request.user
        )


class ChallengeStatsView(APIView):
    """
    챌린지 통계 API
    
    GET /api/challenges/stats/ - 챌린지 통계
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        user = request.user
        challenges = UserChallenge.objects.filter(user=user)
        
        stats = {
            'total': challenges.count(),
            'active': challenges.filter(status='active').count(),
            'completed': challenges.filter(status='completed').count(),
            'failed': challenges.filter(status='failed').count(),
            'total_points_earned': challenges.aggregate(
                total=Sum('earned_points')
            )['total'] or 0,
            'success_rate': 0,
            'by_source_type': {
                'duduk': challenges.filter(source_type='duduk').count(),
                'event': challenges.filter(source_type='event').count(),
                'custom': challenges.filter(source_type='custom').count(),
                'ai': challenges.filter(source_type='ai').count(),
            }
        }
        
        finished = stats['completed'] + stats['failed']
        if finished > 0:
            stats['success_rate'] = round((stats['completed'] / finished) * 100, 1)
        
        return Response(stats)

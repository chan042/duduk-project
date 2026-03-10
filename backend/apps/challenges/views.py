from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from django.utils import timezone
from django.db.models import Sum, OuterRef, Subquery
from datetime import datetime, time, timedelta

from .models import ChallengeTemplate, UserChallenge, ChallengeDailyLog
from .services.photo_verification import PhotoVerificationService
from .constants import (
    CONDITION_TYPE_AMOUNT_RANGE,
    CONDITION_TYPE_PHOTO_VERIFICATION,
    COMPARE_TYPE_LAST_MONTH_WEEK,
)
from .signals import _evaluate_success, _update_photo_progress
from .serializers import (
    ChallengeTemplateSerializer, ChallengeTemplateListSerializer,
    UserChallengeSerializer, UserChallengeListSerializer,
    UserChallengeCreateSerializer, CustomChallengeCreateSerializer,
    ChallengeDailyLogSerializer,
    UserPointsSerializer,
    AIChallengGenerateSerializer, AIChallengePreviewSerializer, AIChallengeStartSerializer,
    CoachingChallengeGenerateSerializer, CoachingChallengePreviewSerializer, CoachingChallengeStartSerializer,
    _get_template_availability
)
from external.ai.client import AIClient


def _get_template_queryset_for_user(user, tab=None):
    queryset = ChallengeTemplate.objects.filter(is_active=True)

    if tab == 'duduk':
        queryset = queryset.filter(source_type='duduk')
    elif tab == 'event':
        now = timezone.now()
        queryset = queryset.filter(
            source_type='event',
            event_start_at__lte=now,
            event_end_at__gte=now,
        )

    latest_challenge = UserChallenge.objects.filter(
        user=user,
        template=OuterRef('pk')
    ).order_by('-created_at')

    return queryset.annotate(
        my_challenge_id=Subquery(latest_challenge.values('id')[:1]),
        my_challenge_status=Subquery(latest_challenge.values('status')[:1]),
    ).order_by('display_order', '-created_at')


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
        tab = self.request.query_params.get('tab')
        return _get_template_queryset_for_user(self.request.user, tab=tab)

    @action(detail=True, methods=['post'])
    def preview_input(self, request, pk=None):
        """
        도전 전 입력값 프리뷰
        - 나와의 싸움: 선택 주차 금액
        - 고정비 다이어트: 지난달 고정비
        """
        template = self.get_object()
        is_available, reason = _get_template_availability(template, request.user)
        if not is_available:
            return Response(
                {'error': reason or '도전할 수 없는 챌린지입니다.', 'is_available': False},
                status=status.HTTP_400_BAD_REQUEST
            )
        display_config = template.display_config or {}
        if display_config.get('progress_type') != 'compare':
            return Response(
                {'error': '비교형 챌린지에서만 지원됩니다.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        user_input_values = request.data.get('user_input_values') or {}
        serializer = UserChallengeCreateSerializer(context={'request': request})
        reference_dt = serializer._resolve_start_at(template, template.success_conditions or {}, timezone.now())
        compare_base = serializer._calculate_compare_base(
            user_input_values=user_input_values,
            success_conditions=template.success_conditions or {},
            reference_dt=reference_dt,
        )
        return Response({
            'compare_base': compare_base,
            'compare_type': (template.success_conditions or {}).get('compare_type'),
            'compare_week': user_input_values.get('compare_week'),
            'scheduled_start_at': reference_dt,
        })


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
        # started_at이 지난 'ready' 챌린지 자동 활성화
        UserChallenge.objects.filter(
            user=self.request.user,
            status='ready',
            started_at__lte=timezone.now()
        ).update(status='active')

        queryset = UserChallenge.objects.filter(user=self.request.user)
        status_filter = self.request.query_params.get('status')
        source_type = self.request.query_params.get('source_type')
        
        if status_filter == 'active':
            queryset = queryset.filter(status='active')
        elif status_filter == 'ready':
            queryset = queryset.filter(status='ready')
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
        ai_client = AIClient(purpose="coaching")
        generated_challenge = ai_client.generate_challenge(
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
        ai_client = AIClient(purpose="coaching")
        generated_challenge = ai_client.generate_challenge_from_coaching(
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
        
        if user_challenge.status not in {'ready', 'saved'}:
            return Response(
                {'error': '대기/저장 상태 챌린지만 시작할 수 있습니다.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        from datetime import timedelta
        now = timezone.now()
        if user_challenge.status == 'ready':
            start_at = self._resolve_retry_start_at(user_challenge, now)
        else:
            start_at = now
        user_challenge.status = 'active' if start_at <= now else 'ready'
        user_challenge.started_at = start_at
        user_challenge.ends_at = start_at + timedelta(days=user_challenge.duration_days - 1)
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

        # 챌린지 상태 초기화
        now = timezone.now()
        duration_days = user_challenge.duration_days
        start_at = self._resolve_retry_start_at(user_challenge, now)

        user_challenge.status = 'active' if start_at <= now else 'ready'
        user_challenge.started_at = start_at
        user_challenge.ends_at = start_at + timezone.timedelta(days=duration_days - 1)
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

    @action(detail=True, methods=['post'])
    def claim_reward(self, request, pk=None):
        """보상 수령 - 포인트 지급 후 다시 도전 가능 상태로 전환"""
        user_challenge = self.get_object()

        if user_challenge.status != 'completed':
            return Response(
                {'error': '완료된 챌린지만 보상을 받을 수 있습니다.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        earned_points = user_challenge.earned_points
        user_challenge.claim_reward()

        # 보상받기 후 UserChallenge 삭제 → 챌린지가 다시 '도전하기' 상태로 표시됨
        user_challenge.daily_logs.all().delete()
        user_challenge.delete()

        return Response({
            'message': f'{earned_points}P가 지급되었습니다!',
            'earned_points': earned_points,
            'user_points': request.user.points
        })

    def _resolve_retry_start_at(self, user_challenge, now):
        success_conditions = user_challenge.success_conditions or {}
        if success_conditions.get('compare_type') != COMPARE_TYPE_LAST_MONTH_WEEK:
            return now

        weekday = now.weekday()
        days_until_monday = (7 - weekday) % 7
        if days_until_monday == 0:
            return now
        start_date = (now + timezone.timedelta(days=days_until_monday)).date()
        return timezone.make_aware(
            datetime.combine(start_date, time.min),
            timezone.get_current_timezone()
        )

    def _create_retry_progress(self, user_challenge):
        """재도전 시 초기 progress 생성"""
        display_config = user_challenge.display_config or {}
        progress_type = display_config.get('progress_type', 'amount')
        success_conditions = user_challenge.success_conditions or {}

        if progress_type == 'amount':
            target = user_challenge.user_input_values.get('target_amount') or \
                     success_conditions.get('target_amount', 0)
            progress = {
                "type": "amount",
                "current": 0,
                "target": target,
                "percentage": 0,
                "is_on_track": True,
                "remaining": target
            }
            if success_conditions.get('type') == CONDITION_TYPE_AMOUNT_RANGE and target:
                tolerance_percent = success_conditions.get('tolerance_percent', 10)
                progress['lower_limit'] = int(target * (1 - tolerance_percent / 100))
                progress['upper_limit'] = int(target * (1 + tolerance_percent / 100))
            return progress
        elif progress_type == 'zero_spend':
            return {
                "type": "zero_spend",
                "current": 0,
                "target_categories": success_conditions.get('categories', []),
                "is_violated": False,
                "violation_amount": 0,
                "is_on_track": True,
                "elapsed_days": 0,
                "total_days": user_challenge.duration_days,
                "percentage": 0,
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
            mode = user_challenge.photo_frequency or 'once'
            required = user_challenge.duration_days if user_challenge.photo_frequency == 'daily' else 1
            if mode == 'on_purchase':
                required = 0
            return {
                "type": "photo",
                "photo_count": 0,
                "required_count": required,
                "percentage": 0,
                "photos": [],
                "is_on_track": True,
                "mode": mode,
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
                "has_violation": False,
                "daily_rules": success_conditions.get('daily_rules', {}),
                "percentage": 0,
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
                "difference_percent": 100,
                "mask_target": True,
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
        
        image_base64 = request.data.get('image_base64')
        photo_url = request.data.get('photo_url')
        mime_type = request.data.get('mime_type', 'image/jpeg')
        captured_at = request.data.get('captured_at')

        if not image_base64 and not photo_url:
            return Response(
                {'error': 'image_base64 또는 photo_url이 필요합니다.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        today = timezone.now().date()
        log, _ = ChallengeDailyLog.objects.get_or_create(
            user_challenge=user_challenge,
            log_date=today
        )
        
        verification_service = PhotoVerificationService()
        verification = verification_service.verify(
            user_challenge=user_challenge,
            image_base64=image_base64,
            photo_url=photo_url,
            mime_type=mime_type,
            log_date=today,
        )

        if not verification.get('passed'):
            return Response(
                {
                    'error': verification.get('reason_message', '사진 검증에 실패했습니다.'),
                    'error_code': 'PHOTO_VERIFICATION_FAILED',
                    'verification': verification,
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # 검증 통과한 사진만 저장
        photo_urls = log.photo_urls or []
        photo_urls.append({
            'url': photo_url or '',
            'uploaded_at': timezone.now().isoformat(),
            'captured_at': captured_at,
            'verified': True,
            'verification_meta': {
                'reason_code': verification.get('reason_code'),
                'confidence': verification.get('confidence', 0),
                'evidence': verification.get('evidence', {}),
            },
        })
        log.photo_urls = photo_urls
        log.save(update_fields=['photo_urls', 'updated_at'])
        
        success_conditions = user_challenge.success_conditions or {}
        # progress 업데이트
        _update_photo_progress(user_challenge, success_conditions)

        # photo_verification + once 타입은 즉시 완료 처리
        if success_conditions.get('type') == CONDITION_TYPE_PHOTO_VERIFICATION and user_challenge.photo_frequency in (None, 'once'):
            progress = user_challenge.progress or {}
            if _evaluate_success(user_challenge, progress, success_conditions):
                user_challenge.complete_challenge(True, progress.get('current', 0))
        
        return Response({
            'message': '사진 인증 완료!',
            'log': ChallengeDailyLogSerializer(log).data,
            'progress': user_challenge.progress,
            'verification': verification,
        })


class ChallengeDashboardView(APIView):
    """
    챌린지 대시보드 통합 API
    - 템플릿/진행중/완료/실패/사용자 챌린지를 한 번에 반환
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        UserChallenge.objects.filter(
            user=user,
            status='ready',
            started_at__lte=timezone.now()
        ).update(status='active')

        templates_duduk = _get_template_queryset_for_user(user, tab='duduk')
        templates_event = _get_template_queryset_for_user(user, tab='event')

        user_challenges = UserChallenge.objects.filter(user=user).order_by('-started_at')
        active = user_challenges.filter(status='active')
        ready = user_challenges.filter(status='ready')
        ongoing = user_challenges.filter(status__in=['active', 'ready'])
        completed = user_challenges.filter(status='completed')
        failed = user_challenges.filter(status='failed')
        custom_ai = user_challenges.filter(source_type__in=['custom', 'ai'])

        challenge_serializer_kwargs = {'many': True}
        template_serializer_kwargs = {'many': True, 'context': {'request': request}}

        return Response({
            'points': UserPointsSerializer({
                'points': user.points,
                'total_points_earned': user.total_points_earned,
                'total_points_used': user.total_points_used,
            }).data,
            'templates': {
                'duduk': ChallengeTemplateListSerializer(templates_duduk, **template_serializer_kwargs).data,
                'event': ChallengeTemplateListSerializer(templates_event, **template_serializer_kwargs).data,
            },
            'challenges': {
                'active': UserChallengeListSerializer(active, **challenge_serializer_kwargs).data,
                'ready': UserChallengeListSerializer(ready, **challenge_serializer_kwargs).data,
                'ongoing': UserChallengeListSerializer(ongoing, **challenge_serializer_kwargs).data,
                'completed': UserChallengeListSerializer(completed, **challenge_serializer_kwargs).data,
                'failed': UserChallengeListSerializer(failed, **challenge_serializer_kwargs).data,
                'user': UserChallengeListSerializer(custom_ai, **challenge_serializer_kwargs).data,
            }
        })

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

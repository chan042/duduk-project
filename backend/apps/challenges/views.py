"""
- 템플릿 조회
- User Chanllenge CRUD
- AI 생성 미리보기/저장
- 사진 업로드
- 대시보드 API
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone
from django.db.models import Sum, OuterRef, Subquery
from django.db import transaction
from datetime import timedelta

from .models import ChallengeTemplate, UserChallenge, ChallengeDailyLog
from .services.photo_verification import PhotoVerificationService
from .services.finalization import refresh_user_challenge_states
from .services.lifecycle import resolve_challenge_start_at
from .services.restart import restart_user_challenge
from .constants import (
    CONDITION_TYPE_PHOTO_VERIFICATION,
)
from .signals import _evaluate_success, _update_challenge_progress
from .serializers import (
    ChallengeTemplateSerializer, ChallengeTemplateListSerializer,
    UserChallengeSerializer, UserChallengeListSerializer,
    UserChallengeCreateSerializer,
    ChallengeDailyLogSerializer,
    UserPointsSerializer,
    RestartChallengeSerializer,
    AIChallengGenerateSerializer, AIChallengePreviewSerializer, AIChallengeStartSerializer,
    CoachingChallengeGenerateSerializer, CoachingChallengePreviewSerializer, CoachingChallengeStartSerializer,
    _get_template_availability
)
from external.ai.client import AIClient


def _get_template_queryset_for_user(user, tab=None):
    queryset = ChallengeTemplate.objects.filter(is_active=True, source_type='duduk')

    if tab == 'duduk':
        pass
    elif tab:
        queryset = queryset.none()

    latest_challenge = UserChallenge.objects.filter(
        user=user,
        template=OuterRef('pk'),
        is_current_attempt=True,
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
        reference_dt = resolve_challenge_start_at(template.success_conditions or {}, timezone.now())
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
    POST /api/challenges/my/<id>/restart/ - 챌린지 재도전
    """
    permission_classes = [IsAuthenticated]
    
    def get_serializer_class(self):
        if self.action == 'list':
            return UserChallengeListSerializer
        elif self.action == 'create':
            return UserChallengeCreateSerializer
        elif self.action == 'restart':
            return RestartChallengeSerializer
        return UserChallengeSerializer
    
    def get_queryset(self):
        refresh_user_challenge_states(self.request.user)

        queryset = UserChallenge.objects.filter(user=self.request.user)
        if self.action == 'list':
            queryset = queryset.filter(is_current_attempt=True)
        status_filter = self.request.query_params.get('status')
        source_type = self.request.query_params.get('source_type')
        
        if status_filter == 'active':
            queryset = queryset.filter(status='active')
            ordering = '-started_at'
        elif status_filter == 'ready':
            queryset = queryset.filter(status='ready')
            ordering = '-started_at'
        elif status_filter == 'saved':
            queryset = queryset.filter(status='saved')
            ordering = '-created_at'
        elif status_filter == 'completed':
            queryset = queryset.filter(status='completed')
            ordering = '-started_at'
        elif status_filter == 'failed':
            queryset = queryset.filter(status='failed')
            ordering = '-started_at'
        elif status_filter == 'finished':
            queryset = queryset.filter(status__in=['completed', 'failed'])
            ordering = '-started_at'
        else:
            ordering = '-started_at'
        
        if source_type:
            queryset = queryset.filter(source_type=source_type)
        
        return queryset.order_by(ordering, '-created_at')

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

    def update(self, request, *args, **kwargs):
        user_challenge = self.get_object()
        if user_challenge.source_type in {'custom', 'coaching'}:
            return Response(
                {'error': 'custom/coaching 챌린지는 수정할 수 없습니다. 재생성 또는 삭제 후 다시 만들어주세요.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        return Response(
            {'error': '이 챌린지는 수정할 수 없습니다.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    def partial_update(self, request, *args, **kwargs):
        return self.update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        challenge = self.get_object()

        with transaction.atomic():
            user_challenge = UserChallenge.objects.select_for_update().get(
                pk=challenge.pk,
                user=request.user,
            )

            if user_challenge.source_type not in {'custom', 'coaching'}:
                return Response(
                    {'error': 'custom/coaching 챌린지만 삭제할 수 있습니다.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            if user_challenge.status != 'saved':
                return Response(
                    {'error': '저장된 custom/coaching 챌린지만 삭제할 수 있습니다.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            source_coaching_id = user_challenge.source_coaching_id
            user_challenge.delete()

            if source_coaching_id:
                from apps.coaching.models import Coaching

                has_remaining = UserChallenge.objects.filter(source_coaching_id=source_coaching_id).exists()
                if not has_remaining:
                    Coaching.objects.filter(pk=source_coaching_id).update(has_generated_challenge=False)

        return Response(status=status.HTTP_204_NO_CONTENT)

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

        if coaching.has_generated_challenge:
            return Response(
                {'error': '이미 챌린지가 생성된 코칭 카드입니다.'},
                status=status.HTTP_400_BAD_REQUEST
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
        코칭 기반 AI 챌린지 시작
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
        
        now = timezone.now()
        if user_challenge.status == 'ready':
            start_at = resolve_challenge_start_at(user_challenge.success_conditions or {}, now)
        else:
            start_at = now
        user_challenge.status = 'active' if start_at <= now else 'ready'
        user_challenge.started_at = start_at
        user_challenge.ends_at = start_at + timedelta(days=user_challenge.duration_days - 1)
        user_challenge.save()
        if user_challenge.status == 'active':
            _update_challenge_progress(user_challenge, reference=start_at)
        
        return Response(
            UserChallengeSerializer(user_challenge).data,
            status=status.HTTP_200_OK
        )

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """챌린지 취소"""
        user_challenge = self.get_object()
        
        if user_challenge.status != 'active':
            return Response(
                {'error': '진행 중인 챌린지만 취소할 수 있습니다.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if user_challenge.source_type in {'custom', 'coaching'}:
            user_challenge.revert_to_saved()
        else:
            # 템플릿 기반 챌린지는 기존처럼 취소 시 레코드 삭제
            user_challenge.delete()
        
        return Response({'message': '챌린지가 취소되었습니다.'})

    @action(detail=True, methods=['post'])
    def restart(self, request, pk=None):
        """챌린지 재도전"""
        user_challenge = self.get_object()
        serializer = RestartChallengeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            restarted = restart_user_challenge(
                source_challenge=user_challenge,
                request=request,
                user_input_values=serializer.validated_data.get('user_input_values', {}),
            )
        except (DjangoValidationError, DRFValidationError) as exc:
            detail = getattr(exc, 'detail', None)
            message = detail if detail is not None else exc.messages if hasattr(exc, 'messages') else str(exc)
            return Response(
                {'error': message},
                status=status.HTTP_400_BAD_REQUEST
            )

        return Response(
            UserChallengeSerializer(restarted).data,
            status=status.HTTP_201_CREATED
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

        if user_challenge.reward_claimed_at:
            return Response(
                {'error': '이미 보상을 받은 챌린지입니다.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        earned_points = user_challenge.earned_points
        if not user_challenge.claim_reward():
            return Response(
                {'error': '보상 수령 처리에 실패했습니다. 잠시 후 다시 시도해주세요.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        request.user.refresh_from_db(fields=['points', 'total_points_earned'])

        return Response({
            'message': f'{earned_points}P가 지급되었습니다!',
            'earned_points': earned_points,
            'user_points': request.user.points
        })

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
        _update_challenge_progress(user_challenge)

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

        refresh_user_challenge_states(user)

        templates_duduk = _get_template_queryset_for_user(user, tab='duduk')

        user_challenges = UserChallenge.objects.filter(
            user=user,
            is_current_attempt=True,
        ).order_by('-started_at')
        active = user_challenges.filter(status='active')
        ready = user_challenges.filter(status='ready')
        ongoing = user_challenges.filter(status__in=['active', 'ready'])
        completed = user_challenges.filter(status='completed')
        failed = user_challenges.filter(status='failed')
        custom_and_coaching = user_challenges.filter(source_type__in=['custom', 'coaching'])

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
            },
            'challenges': {
                'active': UserChallengeListSerializer(active, **challenge_serializer_kwargs).data,
                'ready': UserChallengeListSerializer(ready, **challenge_serializer_kwargs).data,
                'ongoing': UserChallengeListSerializer(ongoing, **challenge_serializer_kwargs).data,
                'completed': UserChallengeListSerializer(completed, **challenge_serializer_kwargs).data,
                'failed': UserChallengeListSerializer(failed, **challenge_serializer_kwargs).data,
                'user': UserChallengeListSerializer(custom_and_coaching, **challenge_serializer_kwargs).data,
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
        refresh_user_challenge_states(user)
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
                'custom': challenges.filter(source_type='custom').count(),
                'coaching': challenges.filter(source_type='coaching').count(),
            }
        }
        
        finished = stats['completed'] + stats['failed']
        if finished > 0:
            stats['success_rate'] = round((stats['completed'] / finished) * 100, 1)
        
        return Response(stats)

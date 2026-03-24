import logging
import uuid

from django.db import models, transaction
from django.db.models import F, Value
from django.db.models.functions import Greatest
from django.conf import settings
from django.utils import timezone
from apps.challenges.services.failure_reason import infer_failure_reason
from apps.challenges.services.lifecycle import get_remaining_days
from apps.challenges.services.safe_formula import FormulaEvaluationError, evaluate_formula


logger = logging.getLogger(__name__)


class ChallengeTemplate(models.Model):
    """
    챌린지 템플릿
    - 두둑 챌린지: 플랫폼에서 제공하는 기본 챌린지
    """
    SOURCE_TYPE_CHOICES = [
        ('duduk', '두둑 챌린지'),
        ('event', '이벤트 챌린지'),
    ]
    
    DIFFICULTY_CHOICES = [
        ('easy', '쉬움'),
        ('normal', '보통'),
        ('hard', '어려움'),
    ]
    
    # 기본 정보
    name = models.CharField(max_length=100, verbose_name='챌린지 이름')
    description = models.TextField(verbose_name='상세 설명')
    
    source_type = models.CharField(
        max_length=20, 
        choices=SOURCE_TYPE_CHOICES, 
        default='duduk',
        verbose_name='챌린지 출처'
    )
    difficulty = models.CharField(
        max_length=10, 
        choices=DIFFICULTY_CHOICES, 
        default='normal',
        verbose_name='난이도'
    )
    
    # 보상
    base_points = models.IntegerField(default=0, verbose_name='기본 포인트')
    points_formula = models.CharField(max_length=200, blank=True, null=True, verbose_name='포인트 공식')
    max_points = models.IntegerField(blank=True, null=True, verbose_name='최대 포인트')
    has_penalty = models.BooleanField(default=False, verbose_name='패널티 여부')
    penalty_formula = models.CharField(max_length=200, blank=True, null=True, verbose_name='패널티 공식')
    max_penalty = models.IntegerField(blank=True, null=True, verbose_name='최대 패널티')
    bonus_condition = models.JSONField(blank=True, null=True, verbose_name='보너스 조건')
    bonus_points = models.IntegerField(blank=True, null=True, verbose_name='보너스 포인트')
    
    # 기간
    duration_days = models.IntegerField(default=7, verbose_name='기본 기간(일)')
    
    # 검증 조건 (백엔드용) - JSONB
    success_conditions = models.JSONField(verbose_name='성공 조건')

    
    # 사용자 입력 정의
    user_inputs = models.JSONField(blank=True, null=True, verbose_name='사용자 입력 정의')

    # 추가 검증
    requires_daily_check = models.BooleanField(default=False, verbose_name='일일 체크 필요')
    requires_photo = models.BooleanField(default=False, verbose_name='사진 인증 필요')
    photo_frequency = models.CharField(max_length=20, blank=True, null=True, verbose_name='사진 인증 빈도')
    photo_description = models.CharField(max_length=200, blank=True, null=True, verbose_name='사진 인증 설명')
    
    success_description = models.JSONField(
        default=list, blank=True,
        help_text="성공 조건 리스트 (예: ['3일 연속 진행', '매일 0원 지출'])"
    )

    # 프론트 표시 설정 - JSONB
    display_config = models.JSONField(verbose_name='프론트 표시 설정', default=dict, blank=True)

    # 이벤트 전용
    event_start_at = models.DateTimeField(blank=True, null=True, verbose_name='이벤트 시작일')
    event_end_at = models.DateTimeField(blank=True, null=True, verbose_name='이벤트 종료일')
    event_banner_url = models.CharField(max_length=500, blank=True, null=True, verbose_name='이벤트 배너 URL')
    
    is_active = models.BooleanField(default=True, verbose_name='활성화 여부')
    display_order = models.IntegerField(default=0, verbose_name='표시 순서')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['display_order', '-created_at']
        verbose_name = '챌린지 템플릿'
        verbose_name_plural = '챌린지 템플릿 목록'

    def __str__(self):
        return f"[{self.get_source_type_display()}] {self.name}"

    @property
    def is_event_active(self):
        if self.source_type != 'event':
            return False

        now = timezone.now()
        if self.event_start_at and self.event_start_at > now:
            return False
        if self.event_end_at and self.event_end_at < now:
            return False

        return True

    @property
    def remaining_event_time(self):
        if not self.is_event_active or not self.event_end_at:
            return None

        remaining = self.event_end_at - timezone.now()
        return remaining if remaining.total_seconds() > 0 else None


class UserChallenge(models.Model):
    """
    사용자 챌린지 (모든 유형 통합)
    - 두둑 챌린지: 템플릿 기반
    - custom 챌린지: 챌린지 페이지에서 AI 생성
    - coaching 챌린지: 코칭 카드 기반 AI 생성
    """
    SOURCE_TYPE_CHOICES = [
        ('duduk', '두둑 챌린지'),
        ('custom', '사용자 챌린지'),
        ('coaching', '코칭 챌린지'),
    ]
    
    DIFFICULTY_CHOICES = [
        ('easy', '쉬움'),
        ('normal', '보통'),
        ('hard', '어려움'),
    ]
    
    STATUS_CHOICES = [
        ('saved', '저장됨'),
        ('ready', '시작 대기'),
        ('active', '진행 중'),
        ('completed', '완료'),
        ('failed', '실패'),
    ]
    
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='user_challenges',
        verbose_name='사용자'
    )
    
    source_type = models.CharField(
        max_length=20,
        choices=SOURCE_TYPE_CHOICES,
        default='duduk',
        verbose_name='챌린지 유형'
    )
    template = models.ForeignKey(
        ChallengeTemplate,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='user_challenges',
        verbose_name='템플릿'
    )
    source_coaching = models.ForeignKey(
        'coaching.Coaching',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='generated_challenges',
        verbose_name='원본 코칭'
    )
    
    # 챌린지 정보
    name = models.CharField(max_length=100, verbose_name='챌린지 이름', default='챌린지')
    description = models.TextField(blank=True, null=True, verbose_name='상세 설명')
    difficulty = models.CharField(
        max_length=10,
        choices=DIFFICULTY_CHOICES,
        default='normal',
        verbose_name='난이도'
    )
    
    # 기간
    duration_days = models.IntegerField(verbose_name='기간(일)', default=7)
    started_at = models.DateTimeField(verbose_name='시작일시', null=True, blank=True)
    ends_at = models.DateTimeField(verbose_name='종료일시', null=True, blank=True)
    
    # 검증 조건 (백엔드용)
    success_conditions = models.JSONField(verbose_name='성공 조건', default=dict)
    
    # 사용자 입력값
    user_input_values = models.JSONField(default=dict, blank=True, verbose_name='사용자 입력값')
    
    # 시스템 생성값
    system_generated_values = models.JSONField(default=dict, blank=True, verbose_name='시스템 생성값')
    
    # 추가 검증
    requires_daily_check = models.BooleanField(default=False, verbose_name='일일 체크 필요')
    requires_photo = models.BooleanField(default=False, verbose_name='사진 인증 필요')
    photo_frequency = models.CharField(max_length=20, blank=True, null=True, verbose_name='사진 인증 빈도')
    photo_description = models.CharField(max_length=200, blank=True, null=True, verbose_name='사진 인증 설명')

    # 보상
    base_points = models.IntegerField(default=0, verbose_name='기본 포인트')
    points_formula = models.CharField(max_length=200, blank=True, null=True, verbose_name='포인트 공식')
    max_points = models.IntegerField(blank=True, null=True, verbose_name='최대 포인트')
    has_penalty = models.BooleanField(default=False, verbose_name='패널티 여부')
    penalty_formula = models.CharField(max_length=200, blank=True, null=True, verbose_name='패널티 공식')
    max_penalty = models.IntegerField(blank=True, null=True, verbose_name='최대 패널티')
    bonus_condition = models.JSONField(blank=True, null=True, verbose_name='보너스 조건')
    bonus_points = models.IntegerField(blank=True, null=True, verbose_name='보너스 포인트')
    
    success_description = models.JSONField(
        default=list, blank=True,
        verbose_name='성공 조건 설명',
        help_text='성공 조건 리스트'
    )

    # 프론트 표시 설정
    display_config = models.JSONField(verbose_name='프론트 표시 설정', default=dict, blank=True)
    
    # 상태
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='active',
        verbose_name='상태'
    )
    
    # 프론트용 진행 상황
    progress = models.JSONField(default=dict, blank=True, verbose_name='진행 상황')

    
    # 결과
    final_spent = models.IntegerField(blank=True, null=True, verbose_name='최종 지출')
    earned_points = models.IntegerField(default=0, verbose_name='획득 포인트')
    penalty_points = models.IntegerField(default=0, verbose_name='패널티 포인트')
    bonus_earned = models.BooleanField(default=False, verbose_name='보너스 획득')
    completed_at = models.DateTimeField(blank=True, null=True, verbose_name='완료일시')
    reward_claimed_at = models.DateTimeField(blank=True, null=True, verbose_name='보상 수령일시')
    
    # 재도전
    attempt_number = models.IntegerField(default=1, verbose_name='시도 횟수')
    attempt_group_id = models.UUIDField(default=uuid.uuid4, editable=False, verbose_name='시도 그룹 ID')
    is_current_attempt = models.BooleanField(default=True, verbose_name='현재 시도 여부')
    previous_attempt = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='retries',
        verbose_name='이전 시도'
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-started_at']
        verbose_name = '사용자 챌린지'
        verbose_name_plural = '사용자 챌린지 목록'
        indexes = [
            models.Index(fields=['user', 'status']),
            models.Index(fields=['user', 'status', 'is_current_attempt'], name='chal_usr_stat_curr_idx'),
            models.Index(fields=['attempt_group_id'], name='chal_attempt_grp_idx'),
            models.Index(fields=['ends_at']),
        ]

    def __str__(self):
        return f"{self.user.username} - {self.name} ({self.get_status_display()})"

    @property
    def remaining_days(self):
        """남은 일수 계산"""
        return get_remaining_days(self)

    def update_progress(self, progress_data):
        """진행 상황 업데이트"""
        self.progress = progress_data
        self.save(update_fields=['progress', 'updated_at'])

    def complete_challenge(self, is_success: bool, final_spent: int = None, failure_reason: str = None):
        """챌린지 완료 처리"""
        notify_reason = failure_reason

        with transaction.atomic():
            locked = UserChallenge.objects.select_for_update().select_related('user').get(pk=self.pk)
            if locked.status in {'completed', 'failed'}:
                self.refresh_from_db()
                return

            locked.status = 'completed' if is_success else 'failed'
            locked.completed_at = timezone.now()
            if final_spent is not None:
                locked.final_spent = int(final_spent)

            if is_success:
                locked.penalty_points = 0
                locked.earned_points = locked._calculate_points()
                if locked._check_bonus_condition():
                    locked.bonus_earned = True
                    locked.earned_points += locked.bonus_points or 0
                else:
                    locked.bonus_earned = False
            else:
                user_model = locked.user.__class__
                locked.earned_points = 0
                locked.bonus_earned = False
                if locked.has_penalty:
                    locked.penalty_points = locked._calculate_penalty()
                    if locked.penalty_points:
                        user_model.objects.filter(pk=locked.user_id).update(
                            points=Greatest(F('points') - locked.penalty_points, Value(0)),
                        )
                else:
                    locked.penalty_points = 0

                # 실패 확정 즉시 daily_logs 삭제
                locked.daily_logs.all().delete()

            locked._handle_completion_side_effects(is_success)

            if not is_success and not notify_reason:
                notify_reason = infer_failure_reason(locked, final_spent=locked.final_spent)

            locked.save(update_fields=[
                'status',
                'completed_at',
                'final_spent',
                'earned_points',
                'penalty_points',
                'bonus_earned',
                'progress',
                'updated_at',
            ])

            transaction.on_commit(
                lambda challenge_id=locked.id, success=is_success, reason=notify_reason:
                UserChallenge._send_result_notification_after_commit(challenge_id, success, reason)
            )

        self.refresh_from_db()

    @staticmethod
    def _send_result_notification_after_commit(challenge_id: int, is_success: bool, failure_reason: str = None):
        """트랜잭션 커밋 이후 챌린지 결과 알림 발송"""
        try:
            from apps.notifications.services import create_challenge_result_notification

            challenge = UserChallenge.objects.select_related('user').get(pk=challenge_id)

            create_challenge_result_notification(
                user_challenge=challenge,
                is_success=is_success,
                failure_reason=failure_reason,
            )
        except Exception:
            logger.exception(
                "Challenge result notification failed (challenge_id=%s, is_success=%s)",
                challenge_id,
                is_success,
            )

    def claim_reward(self):
        """보상 수령 처리 - 포인트 지급 및 완료 챌린지 아카이브"""
        with transaction.atomic():
            locked = UserChallenge.objects.select_for_update().select_related('user').get(pk=self.pk)

            if locked.status != 'completed' or locked.reward_claimed_at:
                self.refresh_from_db()
                return False

            earned_points = int(locked.earned_points or 0)
            user_model = locked.user.__class__

            if earned_points:
                user_model.objects.filter(pk=locked.user_id).update(
                    points=F('points') + earned_points,
                    total_points_earned=F('total_points_earned') + earned_points,
                )

            locked.reward_claimed_at = timezone.now()
            locked.is_current_attempt = False
            locked.progress = {}
            locked.daily_logs.all().delete()
            locked.save(update_fields=[
                'reward_claimed_at',
                'is_current_attempt',
                'progress',
                'updated_at',
            ])

        self.refresh_from_db()
        return True

    def _handle_completion_side_effects(self, is_success: bool):
        """완료 시 부가 처리"""
        success_conditions = self.success_conditions or {}
        if success_conditions.get('type') != 'random_budget':
            return

        random_budget = int((self.system_generated_values or {}).get('random_budget') or 0)
        if random_budget <= 0:
            return

        progress = self.progress or {}
        progress['mask_target'] = False
        progress['target'] = random_budget
        self.progress = progress

        spent = self.final_spent if self.final_spent is not None else progress.get('current', 0)
        detail = (
            f"숨겨진 예산은 {random_budget:,}원이었어요. "
            f"최종 지출은 {int(spent):,}원입니다."
        )
        progress["result_detail"] = detail
        self.progress = progress

    def _calculate_points(self):
        """포인트 계산
        
        points_formula 지원 변수:
        - {spent}: 최종 지출 금액
        - {target}: 목표 금액
        - {saved}: 절약 금액 (target - spent)
        - {base}: 기본 포인트
        
        """
        if not self.points_formula:
            return self.base_points

        try:
            result = evaluate_formula(self.points_formula, self._build_formula_variables())
            if self.max_points:
                result = min(result, self.max_points)

            return max(0, int(result))
        except FormulaEvaluationError:
            logger.warning(
                "Invalid points_formula on challenge id=%s: %s",
                self.id,
                self.points_formula,
            )
            return self.base_points

    def _calculate_penalty(self):
        """패널티 계산
        
        penalty_formula 지원 변수:
        - {spent}: 최종 지출 금액
        - {target}: 목표 금액
        - {over}: 초과 금액 (spent - target)
        
        """
        if not self.penalty_formula:
            return 0

        try:
            result = evaluate_formula(self.penalty_formula, self._build_formula_variables())
            if self.max_penalty:
                result = min(result, self.max_penalty)

            return max(0, int(result))
        except FormulaEvaluationError:
            logger.warning(
                "Invalid penalty_formula on challenge id=%s: %s",
                self.id,
                self.penalty_formula,
            )
            return 0

    def _build_formula_variables(self):
        success_conditions = self.success_conditions or {}
        target = int(
            success_conditions.get('target_amount')
            or (self.user_input_values or {}).get('target_amount')
            or 0
        )
        spent = int(self.final_spent or 0)
        random_budget = int((self.system_generated_values or {}).get('random_budget') or 0)

        return {
            'spent': spent,
            'target': target,
            'saved': max(0, target - spent),
            'over': max(0, spent - target),
            'base': int(self.base_points or 0),
            'actual_spent': spent,
            'random_budget': random_budget,
        }

    def _check_bonus_condition(self):
        """보너스 조건 체크
        
        bonus_condition 지원 타입:
        - under_target_percent: 목표 대비 일정 % 이하 지출 시 보너스
        - zero_spend: 무지출 달성 시 보너스
        - streak: 연속 성공 일수 달성 시 보너스
        """
        if not self.bonus_condition:
            return False
        
        try:
            condition_type = self.bonus_condition.get('type')
            
            if condition_type == 'under_target_percent':
                threshold_percent = self.bonus_condition.get('threshold', 50)
                target = self.success_conditions.get('target_amount', 0)
                spent = self.final_spent or 0
                
                if target > 0:
                    spent_percent = (spent / target) * 100
                    return spent_percent <= threshold_percent
            
            elif condition_type == 'zero_spend':
                return (self.final_spent or 0) == 0
            
            elif condition_type == 'streak':
                required_streak = self.bonus_condition.get('days', 3)
                logs = self.daily_logs.filter(condition_met=True).order_by('log_date')
                streak = 0
                for log in logs:
                    if log.condition_met:
                        streak += 1
                    else:
                        streak = 0
                return streak >= required_streak
            elif condition_type == 'jackpot':
                random_budget = int((self.system_generated_values or {}).get('random_budget') or 0)
                spent = self.final_spent or 0
                if random_budget <= 0 or spent > random_budget:
                    return False
                threshold = float(self.bonus_condition.get('difference_percent', 5))
                difference_percent = abs(random_budget - spent) / random_budget * 100
                return difference_percent <= threshold
            
            return False
        except Exception:
            return False


class ChallengeDailyLog(models.Model):
    """
    일별 챌린지 로그
    - 자동 지출 집계
    - 사용자 체크
    - 사진 인증
    """
    user_challenge = models.ForeignKey(
        UserChallenge,
        on_delete=models.CASCADE,
        related_name='daily_logs',
        verbose_name='사용자 챌린지'
    )
    log_date = models.DateField(verbose_name='기록 날짜')
    
    # 자동 집계
    spent_amount = models.IntegerField(default=0, verbose_name='지출 금액')
    transaction_count = models.IntegerField(default=0, verbose_name='거래 건수')
    spent_by_category = models.JSONField(default=dict, blank=True, verbose_name='카테고리별 지출')
    
    # 사용자 체크
    is_checked = models.BooleanField(default=False, verbose_name='체크 여부')
    checked_at = models.DateTimeField(blank=True, null=True, verbose_name='체크 일시')
    
    # 사진 인증
    photo_urls = models.JSONField(default=list, blank=True, verbose_name='사진 URL')
    
    # 조건 충족
    condition_met = models.BooleanField(blank=True, null=True, verbose_name='조건 충족')
    condition_detail = models.JSONField(blank=True, null=True, verbose_name='조건 상세')
    
    note = models.TextField(blank=True, null=True, verbose_name='메모')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['user_challenge', 'log_date']
        ordering = ['-log_date']
        verbose_name = '일별 챌린지 로그'
        verbose_name_plural = '일별 챌린지 로그 목록'

    def __str__(self):
        return f"{self.user_challenge.name} - {self.log_date}"

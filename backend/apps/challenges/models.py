from django.db import models
from django.conf import settings
from django.utils import timezone


class ChallengeTemplate(models.Model):
    """
    챌린지 템플릿 (두둑/이벤트)
    - 두둑 챌린지: 플랫폼에서 제공하는 기본 챌린지
    - 이벤트 챌린지: 기간 한정 특별 챌린지
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
    
    success_description = models.TextField(verbose_name='성공 조건 설명')
    
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
        """이벤트 챌린지가 현재 활성 상태인지 확인"""
        if self.source_type != 'event':
            return True
        now = timezone.now()
        if self.event_start_at and self.event_end_at:
            return self.event_start_at <= now <= self.event_end_at
        return False


class UserChallenge(models.Model):
    """
    사용자 챌린지 (모든 유형 통합)
    - 두둑 챌린지: 템플릿 기반
    - 이벤트 챌린지: 템플릿 기반
    - 사용자 커스텀 챌린지: 직접 설정
    - AI 맞춤 챌린지: 코칭 기반 자동 생성
    """
    SOURCE_TYPE_CHOICES = [
        ('duduk', '두둑 챌린지'),
        ('event', '이벤트 챌린지'),
        ('custom', '사용자 커스텀'),
        ('ai', 'AI 맞춤'),
    ]
    
    DIFFICULTY_CHOICES = [
        ('easy', '쉬움'),
        ('normal', '보통'),
        ('hard', '어려움'),
    ]
    
    STATUS_CHOICES = [
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
    
    success_description = models.TextField(blank=True, null=True, verbose_name='성공 조건 설명')
    
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
    
    # 재도전
    attempt_number = models.IntegerField(default=1, verbose_name='시도 횟수')
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
            models.Index(fields=['ends_at']),
        ]

    def __str__(self):
        return f"{self.user.username} - {self.name} ({self.get_status_display()})"

    @property
    def remaining_days(self):
        """남은 일수 계산"""
        if self.ends_at is None:
            return self.duration_days or 0
        now = timezone.now()
        if now >= self.ends_at:
            return 0
        delta = self.ends_at - now
        return max(0, delta.days + 1)

    def update_progress(self, progress_data):
        """진행 상황 업데이트"""
        self.progress = progress_data
        self.save(update_fields=['progress', 'updated_at'])

    def complete_challenge(self, is_success: bool, final_spent: int = None):
        """챌린지 완료 처리"""
        self.status = 'completed' if is_success else 'failed'
        self.completed_at = timezone.now()
        if final_spent is not None:
            self.final_spent = final_spent
        
        if is_success:
            # 포인트 계산
            self.earned_points = self._calculate_points()
            # 보너스 체크
            if self._check_bonus_condition():
                self.bonus_earned = True
                self.earned_points += self.bonus_points or 0
            # 사용자 포인트 적립
            self.user.points += self.earned_points
            self.user.total_points_earned += self.earned_points
            self.user.save(update_fields=['points', 'total_points_earned'])
        else:
            # 패널티 계산
            if self.has_penalty:
                self.penalty_points = self._calculate_penalty()
                self.user.points = max(0, self.user.points - self.penalty_points)
                self.user.save(update_fields=['points'])
        
        self.save()

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
            target = self.success_conditions.get('target_amount', 0)
            spent = self.final_spent or 0
            saved = max(0, target - spent)
            
            formula = self.points_formula
            formula = formula.replace('{spent}', str(spent))
            formula = formula.replace('{target}', str(target))
            formula = formula.replace('{saved}', str(saved))
            formula = formula.replace('{base}', str(self.base_points))
            
            result = eval(formula)
            
            if self.max_points:
                result = min(result, self.max_points)
            
            return max(0, int(result))
        except Exception:
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
            target = self.success_conditions.get('target_amount', 0)
            spent = self.final_spent or 0
            over = max(0, spent - target)
            
            formula = self.penalty_formula
            formula = formula.replace('{spent}', str(spent))
            formula = formula.replace('{target}', str(target))
            formula = formula.replace('{over}', str(over))
            
            result = eval(formula)
            
            if self.max_penalty:
                result = min(result, self.max_penalty)
            
            return max(0, int(result))
        except Exception:
            return 0

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

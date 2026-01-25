from django.db import models
from django.conf import settings
from django.utils import timezone


class Challenge(models.Model):
    """
    - 두둑 챌린지: 플랫폼에서 제공하는 기본 챌린지
    - 이벤트 챌린지: 기간 한정 특별 챌린지
    - AI 맞춤 챌린지: 사용자별로 AI가 생성한 개인화 챌린지
    """
    DIFFICULTY_CHOICES = [
        ('EASY', '쉬움'),
        ('MEDIUM', '보통'),
        ('HARD', '어려움'),
    ]
    
    SOURCE_CHOICES = [
        ('DUDUK', '두둑 챌린지'),
        ('EVENT', '이벤트 챌린지'),
        ('USER', '사용자 챌린지'),
    ]
    
    KEYWORD_CHOICES = [
        ('TOP_SAVING', '최고 절약'),
        ('POPULAR_SUCCESS', '인기 성공'),
        ('MANY_FAIL', '다수 실패'),
    ]
    
    source = models.CharField(max_length=20, choices=SOURCE_CHOICES, default='DUDUK')  # 챌린지 출처
    name = models.CharField(max_length=100)  # 챌린지 이름
    description = models.TextField()  # 상세 설명
    icon = models.CharField(max_length=50, blank=True, default='sparkles')  # 아이콘 식별자
    icon_color = models.CharField(max_length=20, blank=True, default='#6366F1')  # 아이콘 배경색
    
    points = models.IntegerField(default=0)  # 완료 시 포인트
    difficulty = models.CharField(max_length=20, choices=DIFFICULTY_CHOICES, default='MEDIUM')
    keyword = models.CharField(max_length=50, choices=KEYWORD_CHOICES, blank=True)
    
    # 챌린지 조건
    duration_days = models.IntegerField(default=7)  # 기본 기간 (일)
    target_amount = models.IntegerField(null=True, blank=True)  # 목표 금액 (예: 0원 = 무지출)
    target_category = models.CharField(max_length=50, blank=True)  # 대상 카테고리 (예: 카페, 편의점)
    
    # 이벤트 챌린지용 (source='EVENT'일 때만 사용)
    event_start = models.DateTimeField(null=True, blank=True)
    event_end = models.DateTimeField(null=True, blank=True)
    
    # 사용자 챌린지용 (source='USER'일 때만 사용)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name='custom_challenges'
    )
    
    is_active = models.BooleanField(default=True)  # 챌린지 활성화 여부
    created_at = models.DateTimeField(auto_now_add=True)  # 생성 날짜
    updated_at = models.DateTimeField(auto_now=True)  # 수정 날짜

    class Meta:
        ordering = ['-created_at']
        verbose_name = '챌린지'
        verbose_name_plural = '챌린지 목록'

    def __str__(self):
        return f"[{self.get_source_display()}] {self.name}"

    @property
    def is_template(self):
        """재사용 가능한 템플릿인지"""
        return self.source in ['DUDUK', 'EVENT']
    
    @property
    def is_user_created(self):
        """사용자가 생성한 개인화 챌린지인지"""
        return self.source == 'USER'

    @property
    def is_event_active(self):
        """이벤트 챌린지가 현재 활성 상태인지 확인"""
        if self.source != 'EVENT':
            return True
        now = timezone.now()
        if self.event_start and self.event_end:
            return self.event_start <= now <= self.event_end
        return False


class UserChallenge(models.Model):
    """
    사용자가 참여 중인 챌린지
    - 챌린지 시작, 진행 상황 추적, 성공/실패 판정
    """
    STATUS_CHOICES = [
        ('IN_PROGRESS', '진행 중'),
        ('SUCCESS', '성공'),
        ('FAILED', '실패'),
        ('CANCELLED', '취소'),
    ]
    
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE,
        related_name='user_challenges'
    )
    challenge = models.ForeignKey(
        Challenge,
        on_delete=models.CASCADE,
        related_name='participants'
    )
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='IN_PROGRESS') # 챌린지 상태
    
    started_at = models.DateTimeField(auto_now_add=True) # 시작 날짜
    end_date = models.DateField()  # 종료 예정일
    completed_at = models.DateTimeField(null=True, blank=True) # 종료 날짜
    
    # 진행 상황 (금액 기반 챌린지용)
    target_amount = models.IntegerField(default=0)  # 목표 금액 (예: 특정 카테고리 제한 금액)
    current_spent = models.IntegerField(default=0)  # 현재까지 지출
    
    # 포인트
    points_earned = models.IntegerField(default=0)  # 획득 포인트
    
    created_at = models.DateTimeField(auto_now_add=True) # 생성 날짜
    updated_at = models.DateTimeField(auto_now=True) # 수정 날짜

    class Meta:
        ordering = ['-started_at']
        verbose_name = '사용자 챌린지'
        verbose_name_plural = '사용자 챌린지 목록'

    def __str__(self):
        challenge_name = self.challenge.name if self.challenge else '알 수 없음'
        return f"{self.user.username} - {challenge_name} ({self.get_status_display()})"

    @property
    def remaining_days(self):
        """남은 일수 계산"""
        today = timezone.now().date()
        delta = self.end_date - today
        return max(0, delta.days)

    @property
    def remaining_amount(self):
        """남은 금액 계산 (목표 - 현재 지출)"""
        return max(0, self.target_amount - self.current_spent)

    @property
    def progress_percent(self):
        """진행률 계산"""
        if self.target_amount <= 0:
            return 100 if self.current_spent == 0 else 0
        # 무지출 챌린지의 경우: 지출이 없으면 100%, 있으면 0%
        if self.target_amount == 0:
            return 100 if self.current_spent == 0 else 0
        # 금액 제한 챌린지: 남은 비율
        spent_ratio = (self.current_spent / self.target_amount) * 100
        return max(0, min(100, 100 - spent_ratio))

    def update_progress(self, spent_amount):
        """진행 상황 업데이트 (Transaction과 연동)"""
        self.current_spent += spent_amount
        self.save()

    def check_and_complete(self):
        """챌린지 종료 여부 확인 및 처리"""
        today = timezone.now().date()
        
        if self.status != 'IN_PROGRESS':
            return
        
        # 기한 만료 확인
        if today > self.end_date:
            # 성공 조건: 목표 금액 이하로 지출
            if self.current_spent <= self.target_amount:
                self.status = 'SUCCESS'
                self.points_earned = self.challenge.points if self.challenge else 0
                # 사용자 포인트 적립
                self.user.points = getattr(self.user, 'points', 0) + self.points_earned
                self.user.save()
            else:
                self.status = 'FAILED'
            
            self.completed_at = timezone.now()
            self.save()


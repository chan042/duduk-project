from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """
    Custom User model for Duduk project.
    Email remains unique and is used as the primary login identifier for
    email/password authentication. Social providers are linked separately
    through SocialAccount.
    """

    email = models.EmailField(unique=True, verbose_name='이메일')
    username = models.CharField(max_length=150, verbose_name='사용자명')

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    job = models.CharField(max_length=100, blank=True, null=True)
    hobbies = models.TextField(blank=True, null=True)
    self_development_field = models.CharField(max_length=100, blank=True, null=True)

    MARITAL_STATUS_CHOICES = [
        ('SINGLE', '미혼'),
        ('MARRIED', '기혼'),
    ]
    marital_status = models.CharField(max_length=10, choices=MARITAL_STATUS_CHOICES, default='SINGLE')
    birth_date = models.DateField(null=True, blank=True)

    CHARACTER_TYPE_CHOICES = [
        ('char_cat', '고양이'),
        ('char_dog', '강아지'),
        ('char_ham', '햄스터'),
        ('char_sheep', '양'),
    ]
    character_type = models.CharField(
        max_length=20,
        choices=CHARACTER_TYPE_CHOICES,
        default='char_cat',
        verbose_name='캐릭터 타입',
    )
    character_name = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        verbose_name='캐릭터 이름',
    )

    profile_image = models.ImageField(
        upload_to='profile_images/',
        null=True,
        blank=True,
        verbose_name='프로필 이미지',
    )

    age = models.IntegerField(null=True, blank=True, verbose_name='나이')
    monthly_budget = models.DecimalField(
        max_digits=12,
        decimal_places=0,
        null=True,
        blank=True,
        verbose_name='월 예산',
    )
    spending_to_improve = models.TextField(
        null=True,
        blank=True,
        verbose_name='개선하고 싶은 소비',
    )
    is_profile_complete = models.BooleanField(default=False, verbose_name='프로필 완성 여부')

    ai_persona_summary = models.TextField(
        blank=True,
        default='',
        verbose_name='AI 소비 성향 요약',
        help_text='월간 리포트 분석을 통해 누적된 사용자의 소비 성향 요약 데이터',
    )

    points = models.IntegerField(default=0, verbose_name='현재 포인트')
    total_points_earned = models.IntegerField(default=0, verbose_name='총 적립 포인트')
    total_points_used = models.IntegerField(default=0, verbose_name='총 사용 포인트')

    # Legacy social login fields kept for backward compatibility with existing data.
    auth_provider = models.CharField(
        max_length=50,
        default='email',
        choices=[
            ('email', 'Email'),
            ('google', 'Google'),
            ('kakao', 'Kakao'),
            ('naver', 'Naver'),
        ],
        verbose_name='인증 제공자',
    )
    social_id = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        verbose_name='소셜 로그인 ID',
    )

    def __str__(self):
        return self.username


class SocialAccount(models.Model):
    class Provider(models.TextChoices):
        GOOGLE = 'google', 'Google'
        KAKAO = 'kakao', 'Kakao'
        NAVER = 'naver', 'Naver'

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='social_accounts',
    )
    provider = models.CharField(max_length=20, choices=Provider.choices)
    provider_user_id = models.CharField(max_length=255)
    email = models.EmailField(blank=True, null=True)
    email_verified = models.BooleanField(default=False)
    display_name = models.CharField(max_length=255, blank=True, default='')
    profile_image_url = models.URLField(blank=True, default='')
    raw_profile = models.JSONField(default=dict, blank=True)
    last_login_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['provider', 'provider_user_id'],
                name='uniq_social_provider_user_id',
            ),
            models.UniqueConstraint(
                fields=['user', 'provider'],
                name='uniq_social_user_provider',
            ),
        ]

    def __str__(self):
        return f'{self.user_id}:{self.provider}'


class MonthlyReport(models.Model):
    """
    AI 월간 분석 리포트 캐시 모델.
    사용자별, 연월별로 하나의 리포트만 저장된다.
    """

    class ScoreStatus(models.TextChoices):
        PENDING = 'PENDING', '대기'
        READY = 'READY', '완료'
        FAILED = 'FAILED', '실패'

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='monthly_reports')
    year = models.IntegerField(verbose_name='연도')
    month = models.IntegerField(verbose_name='월')
    score_snapshot = models.JSONField(verbose_name='윤택지수 스냅샷', default=dict, blank=True)
    score_generated_at = models.DateTimeField(null=True, blank=True, verbose_name='점수 생성 시각')
    score_status = models.CharField(
        max_length=20,
        choices=ScoreStatus.choices,
        default=ScoreStatus.PENDING,
        verbose_name='점수 상태',
    )
    score_error = models.TextField(blank=True, default='', verbose_name='점수 생성 오류')
    report_content = models.JSONField(verbose_name='리포트 내용', default=dict)
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='생성 시각')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='수정 시각')

    class Meta:
        unique_together = ('user', 'year', 'month')
        ordering = ['-year', '-month']
        verbose_name = '월간 리포트'
        verbose_name_plural = '월간 리포트들'

    def __str__(self):
        return f'{self.user.username} - {self.year}년 {self.month}월 리포트'

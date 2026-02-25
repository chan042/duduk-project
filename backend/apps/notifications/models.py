from django.db import models
from django.conf import settings
from django.utils import timezone
from datetime import timedelta


class Notification(models.Model):
    """
    사용자 알림 모델
    - 코칭 생성 알림
    - 월간 리포트 생성 알림 (윤택지수 + AI 리포트)
    """
    class NotificationType(models.TextChoices):
        COACHING = 'COACHING', '코칭 생성'
        MONTHLY_REPORT = 'MONTHLY_REPORT', '월간 리포트 생성'
        CHALLENGE = 'CHALLENGE', '챌린지'
    
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications'
    )
    notification_type = models.CharField(max_length=20, choices=NotificationType.choices)
    title = models.CharField(max_length=200)
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    
    # 관련 데이터 (코칭 ID, 년/월 정보 등)
    related_id = models.IntegerField(null=True, blank=True)
    related_year = models.IntegerField(null=True, blank=True)
    related_month = models.IntegerField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'is_read']),
            models.Index(fields=['user', '-created_at']),
        ]
        verbose_name = '알림'
        verbose_name_plural = '알림 목록'
    
    def __str__(self):
        return f"{self.user.username} - {self.get_notification_type_display()} ({self.created_at})"
    
    @property
    def is_expired(self):
        """알림이 만료되었는지 확인 (생성 후 90일)"""
        expiration_date = self.created_at + timedelta(days=90)
        return timezone.now() > expiration_date
    
    def get_redirect_url(self):
        """알림 클릭 시 이동할 URL 반환"""
        return {
            self.NotificationType.COACHING: '/coaching',
            self.NotificationType.MONTHLY_REPORT: '/yuntaek-index',
            self.NotificationType.CHALLENGE: '/challenge',
        }.get(self.notification_type, '/')

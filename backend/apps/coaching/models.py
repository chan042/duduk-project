from django.db import models
from django.conf import settings

class Coaching(models.Model):
    """
    AI가 생성한 코칭 카드 데이터
    """
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='coachings')
    title = models.CharField(max_length=100, default="소비 코칭") # 코칭 제목 (분석 요약)
    subject = models.CharField(max_length=50) # 주제: 행동 변화 제안, 누수 소비, 위치 기반 대안, 키워드 기반 대안
    analysis = models.TextField() # 소비 분석
    coaching_content = models.TextField() # 코칭 내용
    estimated_savings = models.IntegerField(default=0) # 예상 절약액
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user} - {self.subject} ({self.created_at})"

class CoachingFeedback(models.Model):
    """
    AI 코칭에 대한 사용자의 피드백 (좋아요/싫어요 및 이유)
    """
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='feedbacks')
    coaching = models.ForeignKey(
        Coaching,
        on_delete=models.CASCADE,
        related_name='feedbacks',
        verbose_name='코칭',
        null=True,
        blank=True
    )
    is_liked = models.BooleanField(default=True)  # True: 좋아요, False: 싫어요
    dislike_reason = models.TextField(blank=True, null=True)  # 싫어요 선택 시 이유
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = '코칭 피드백'
        verbose_name_plural = '코칭 피드백 목록'

    def __str__(self):
        coaching_title = self.coaching.title if self.coaching else '알 수 없음'
        return f"{self.user.username} - {coaching_title} - {'좋아요' if self.is_liked else '싫어요'}"

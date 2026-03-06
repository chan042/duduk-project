from django.db import models
from django.conf import settings

class ChatSession(models.Model):
    """
    각 사용자의 '두두' AI 상담사 대화 세션을 관리합니다.
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="chat_sessions",
        help_text="대화를 진행 중인 사용자",
    )
    created_at = models.DateTimeField(auto_now_add=True, help_text="세션 생성 시간")
    updated_at = models.DateTimeField(auto_now=True, help_text="마지막 대화 발생 시간")

    class Meta:
        db_table = "chatbot_chat_session"
        verbose_name = "챗봇 세션"
        verbose_name_plural = "챗봇 세션 목록"

    def __str__(self):
        return f"ChatSession(user={self.user.username}, id={self.id})"


class ChatMessage(models.Model):
    """
    하나의 대화 세션 내에서 오고 간 개별 메시지를 관리합니다.
    (사용자 메시지 및 AI의 응답 데이터)
    """
    ROLE_CHOICES = (
        ("user", "사용자"),
        ("assistant", "두두(AI)"),
    )

    session = models.ForeignKey(
        ChatSession,
        on_delete=models.CASCADE,
        related_name="messages",
        help_text="소속된 대화 세션",
    )
    role = models.CharField(
        max_length=20,
        choices=ROLE_CHOICES,
        help_text="메시지 작성자 (user 또는 assistant)",
    )
    content = models.TextField(help_text="메시지 본문")
    created_at = models.DateTimeField(auto_now_add=True, help_text="메시지 기록 시간")

    class Meta:
        db_table = "chatbot_chat_message"
        verbose_name = "챗봇 메시지"
        verbose_name_plural = "챗봇 메시지 목록"
        ordering = ["created_at"]  # 시간 순 정렬

    def __str__(self):
        return f"[{self.role}] {self.content[:30]}..."

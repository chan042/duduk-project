"""
[파일 역할]
- 챗봇 앱의 URL 설정입니다.

URL 패턴:
  POST   /api/chatbot/sessions/                        → 새 세션 생성
  GET    /api/chatbot/sessions/                        → 세션 목록 조회
  GET    /api/chatbot/sessions/<session_id>/messages/  → 대화 이력 조회
  POST   /api/chatbot/sessions/<session_id>/messages/  → 메시지 전송 & AI 응답
"""
from django.urls import path
from .views import ChatSessionView, ChatHistoryView, ChatMessageView

urlpatterns = [
    path("sessions/", ChatSessionView.as_view(), name="chatbot-sessions"),
    path(
        "sessions/<int:session_id>/messages/",
        ChatMessageView.as_view(),
        name="chatbot-messages",
    ),
    path(
        "sessions/<int:session_id>/history/",
        ChatHistoryView.as_view(),
        name="chatbot-history",
    ),
]

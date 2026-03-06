"""
[파일 역할]
- 챗봇 API 뷰를 정의합니다.
- ChatSessionView: 새 대화 세션 생성 / 사용자의 세션 목록 조회
- ChatHistoryView: 특정 세션의 대화 이력 조회
- ChatMessageView: 메시지 전송 및 AI 응답 반환
"""
import logging

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404

from .models import ChatSession, ChatMessage
from .services import DuduChatService

logger = logging.getLogger(__name__)


class ChatSessionView(APIView):
    """
    POST /api/chatbot/sessions/     - 새 대화 세션 생성
    GET  /api/chatbot/sessions/     - 사용자의 세션 목록 조회 (최신순)
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        """새 챗봇 대화 세션을 생성합니다."""
        session = ChatSession.objects.create(user=request.user)
        return Response(
            {
                "id": session.id,
                "created_at": session.created_at,
                "updated_at": session.updated_at,
            },
            status=status.HTTP_201_CREATED,
        )

    def get(self, request):
        """사용자의 챗봇 세션 목록을 반환합니다."""
        sessions = ChatSession.objects.filter(user=request.user).order_by("-updated_at")
        data = [
            {
                "id": s.id,
                "created_at": s.created_at,
                "updated_at": s.updated_at,
                "message_count": s.messages.count(),
                # 마지막 메시지 미리보기
                "last_message": (
                    s.messages.last().content[:80]
                    if s.messages.exists()
                    else None
                ),
            }
            for s in sessions
        ]
        return Response(data)


class ChatHistoryView(APIView):
    """
    GET /api/chatbot/sessions/<session_id>/messages/
    - 특정 세션의 전체 대화 이력을 반환합니다 (오래된 순).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, session_id):
        session = get_object_or_404(ChatSession, id=session_id, user=request.user)
        messages = session.messages.order_by("created_at")
        data = [
            {
                "id": m.id,
                "role": m.role,
                "content": m.content,
                "created_at": m.created_at,
            }
            for m in messages
        ]
        return Response(data)


class ChatMessageView(APIView):
    """
    POST /api/chatbot/sessions/<session_id>/messages/
    - 사용자 메시지를 전송하고 두두(AI)의 응답을 반환합니다.

    Request body:
        { "content": "사용자 메시지" }

    Response:
        {
            "user_message": { "id": ..., "role": "user", "content": ..., "created_at": ... },
            "assistant_message": { "id": ..., "role": "assistant", "content": ..., "created_at": ... }
        }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, session_id):
        session = get_object_or_404(ChatSession, id=session_id, user=request.user)

        content = request.data.get("content", "").strip()
        if not content:
            return Response(
                {"error": "메시지 내용을 입력해주세요."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 메시지 길이 제한
        if len(content) > 1000:
            return Response(
                {"error": "메시지는 1,000자 이내로 입력해주세요."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            service = DuduChatService()
            user_msg, assistant_msg = service.chat(session, content)
        except Exception as e:
            logger.error(f"챗봇 메시지 처리 중 오류: {e}", exc_info=True)
            return Response(
                {"error": "메시지 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(
            {
                "user_message": {
                    "id": user_msg.id,
                    "role": user_msg.role,
                    "content": user_msg.content,
                    "created_at": user_msg.created_at,
                },
                "assistant_message": {
                    "id": assistant_msg.id,
                    "role": assistant_msg.role,
                    "content": assistant_msg.content,
                    "created_at": assistant_msg.created_at,
                },
            },
            status=status.HTTP_201_CREATED,
        )

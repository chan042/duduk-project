from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework import status
from django.contrib.auth import get_user_model
from django.utils import timezone

from apps.transactions.models import Transaction
User = get_user_model()

class CoachingAdviceView(APIView):
    """
    사용자의 코칭 카드 목록을 조회하는 뷰
    - query param으로 year, month가 주어지면 해당 월에 생성된 코칭만 반환
    - 주어지지 않으면 전체 코칭 반환 (기존 동작 유지)
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        year = request.query_params.get('year')
        month = request.query_params.get('month')

        from .models import Coaching

        # 기본: 모든 코칭 조회 (최신순)
        coachings = Coaching.objects.filter(user=user)
        
        # year/month 파라미터가 있으면 해당 월에 생성된 코칭만 필터링
        if year and month:
            coachings = coachings.filter(
                created_at__year=int(year),
                created_at__month=int(month)
            )
        
        coachings = coachings.order_by('-created_at')
        
        data = []
        for c in coachings:
            data.append({
                "id": c.id,
                "subject": c.subject,
                "title": c.title,
                "analysis": c.analysis,
                "coaching_content": c.coaching_content,
                "estimated_savings": c.estimated_savings,
                "sources": c.sources,
                "created_at": c.created_at
            })
            
        return Response(data)

class FeedbackView(APIView):
    """
    AI 조언에 대한 사용자의 피드백(좋아요/싫어요)을 저장하는 뷰
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        # 로그인한 사용자의 피드백 저장
        user = request.user

        try:
            from .models import Coaching, CoachingFeedback

            coaching_id = request.data.get('coaching_id')
            is_liked = request.data.get('is_liked', True)
            dislike_reason = request.data.get('dislike_reason', '')

            # 코칭 객체 조회
            coaching = None
            if coaching_id:
                try:
                    coaching = Coaching.objects.get(id=coaching_id, user=user)
                except Coaching.DoesNotExist:
                    return Response(
                        {"error": "코칭을 찾을 수 없습니다."},
                        status=status.HTTP_404_NOT_FOUND
                    )

            # 피드백 저장
            feedback = CoachingFeedback.objects.create(
                user=user,
                coaching=coaching,
                is_liked=is_liked,
                dislike_reason=dislike_reason
            )

            return Response({"message": "Feedback saved", "id": feedback.id}, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

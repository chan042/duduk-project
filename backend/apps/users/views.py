"""
[파일 역할]
- 사용자 프로필 관련 API 뷰를 정의합니다.
- 프로필 조회, 수정, 삭제 기능을 제공합니다.
- 로그인은 Google OAuth를 사용합니다.
"""
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.contrib.auth import get_user_model

from .serializers import UserSerializer

User = get_user_model()


class ProfileView(APIView):
    """
    사용자 프로필 조회/수정/삭제 API
    GET /api/users/profile/ - 현재 로그인한 사용자 정보 조회
    PATCH /api/users/profile/ - 사용자 정보 수정
    DELETE /api/users/profile/ - 회원 탈퇴 (관련 데이터 모두 삭제)
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)

    def patch(self, request):
        old_monthly_budget = request.user.monthly_budget
        serializer = UserSerializer(
            request.user, 
            data=request.data, 
            partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        
        # monthly_budget 변경 시 일일 권장 예산 스냅샷 재계산
        new_monthly_budget = request.user.monthly_budget
        if old_monthly_budget != new_monthly_budget:
            from django.utils import timezone
            from apps.transactions.services import recalculate_snapshots_from_date
            today = timezone.localdate()
            # 이번 달 1일부터 재계산
            first_day_of_month = today.replace(day=1)
            recalculate_snapshots_from_date(request.user, first_day_of_month)
        
        return Response(serializer.data)

    def delete(self, request):
        """
        회원 탈퇴 API
        사용자 삭제 시 관련된 모든 데이터(Transaction, Coaching 등)가 CASCADE로 자동 삭제됩니다.
        """
        user = request.user
        user_email = user.email
        
        # 사용자 삭제 (ForeignKey CASCADE로 관련 데이터 자동 삭제)
        user.delete()
        
        return Response({
            "message": f"'{user_email}' 계정이 성공적으로 삭제되었습니다."
        }, status=status.HTTP_200_OK)

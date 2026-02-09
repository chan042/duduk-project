"""
[파일 역할]
- Google OAuth 인증 처리를 담당합니다.
- Google ID 토큰을 검증하고 JWT 토큰을 발급합니다.
"""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from rest_framework_simplejwt.tokens import RefreshToken
from django.conf import settings
from django.contrib.auth import get_user_model
import requests
import os

User = get_user_model()


class GoogleLoginView(APIView):
    """
    Google OAuth 로그인 API
    POST /api/users/auth/google/
    
    요청 본문:
    {
        "credential": "Google ID Token"
    }
    
    응답:
    {
        "access": "JWT Access Token",
        "refresh": "JWT Refresh Token",
        "user": {
            "id": 1,
            "email": "user@example.com",
            "username": "사용자명"
        }
    }
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        access_token = request.data.get('access_token')
        
        if not access_token:
            return Response(
                {'error': 'access_token이 필요합니다.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            # Google UserInfo API 호출하여 토큰 검증 및 사용자 정보 가져오기
            user_info_url = "https://www.googleapis.com/oauth2/v3/userinfo"
            response = requests.get(user_info_url, params={'access_token': access_token})
            
            if not response.ok:
                return Response(
                    {'error': '유효하지 않은 구글 토큰입니다.'},
                    status=status.HTTP_401_UNAUTHORIZED
                )
            
            user_info = response.json()
            
            email = user_info.get('email')
            google_id = user_info.get('sub')
            name = user_info.get('name', email.split('@')[0]) if email else "Unknown"

            if not email:
                return Response(
                    {'error': '이메일 정보를 가져올 수 없습니다.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 사용자 조회 또는 생성
            user, created = User.objects.get_or_create(
                email=email,
                defaults={
                    'username': name,
                    'auth_provider': 'google',
                    'social_id': google_id,
                }
            )

            # 기존 사용자인 경우 OAuth 정보 업데이트
            if not created:
                if user.auth_provider != 'google':
                    user.auth_provider = 'google'
                    user.social_id = google_id
                    user.save()

            # JWT 토큰 생성
            refresh = RefreshToken.for_user(user)

            return Response({
                'access': str(refresh.access_token),
                'refresh': str(refresh),
                'user': {
                    'id': user.id,
                    'email': user.email,
                    'username': user.username,
                    'is_profile_complete': user.is_profile_complete
                }
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response(
                {'error': f'로그인 처리 중 오류가 발생했습니다: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

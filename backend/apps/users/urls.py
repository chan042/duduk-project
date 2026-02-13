"""
[파일 역할]
- 사용자 인증 관련 API URL 라우팅을 정의합니다.
- Google OAuth 로그인, 토큰 갱신, 프로필 조회 엔드포인트를 제공합니다.
"""
from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import ProfileView, YuntaekScoreView, MonthlyReportView, GameRewardView
from .oauth_views import GoogleLoginView

urlpatterns = [
    # Google OAuth 로그인
    path('auth/google/', GoogleLoginView.as_view(), name='google_login'),
    
    # 토큰 갱신
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    
    # 프로필 조회/수정/삭제
    path('profile/', ProfileView.as_view(), name='profile'),

    # 윤택지수 API
    path('yuntaek-score/', YuntaekScoreView.as_view(), name='yuntaek_score'),
    path('yuntaek-report/', MonthlyReportView.as_view(), name='yuntaek_report'),

    # 게임 보상 API
    path('game-reward/', GameRewardView.as_view(), name='game_reward'),
]

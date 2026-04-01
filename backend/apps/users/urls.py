"""
User-related API routes.
"""
from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .oauth_views import GoogleLoginView, KakaoLoginView, NaverLoginView
from .views import (
    DevYuntaekRegenerateView,
    GameRewardView,
    MonthlyReportView,
    ProfileView,
    YuntaekScoreView,
)

urlpatterns = [
    path('auth/google/', GoogleLoginView.as_view(), name='google_login'),
    path('auth/kakao/', KakaoLoginView.as_view(), name='kakao_login'),
    path('auth/naver/', NaverLoginView.as_view(), name='naver_login'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('profile/', ProfileView.as_view(), name='profile'),
    path('yuntaek-score/', YuntaekScoreView.as_view(), name='yuntaek_score'),
    path('yuntaek-report/', MonthlyReportView.as_view(), name='yuntaek_report'),
    path('yuntaek-regenerate/', DevYuntaekRegenerateView.as_view(), name='yuntaek_regenerate'),
    path('game-reward/', GameRewardView.as_view(), name='game_reward'),
]

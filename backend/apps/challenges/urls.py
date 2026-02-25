from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ChallengeTemplateViewSet,
    UserChallengeViewSet,
    ChallengeDailyLogViewSet,
    ChallengeDashboardView,
    UserPointsView,
    ChallengeStatsView,
)

router = DefaultRouter()
router.register(r'templates', ChallengeTemplateViewSet, basename='challenge-template')
router.register(r'my', UserChallengeViewSet, basename='user-challenge')
router.register(r'daily-logs', ChallengeDailyLogViewSet, basename='challenge-daily-log')

urlpatterns = [
    path('', include(router.urls)),
    path('dashboard/', ChallengeDashboardView.as_view(), name='challenge-dashboard'),
    path('points/', UserPointsView.as_view(), name='user-points'),
    path('stats/', ChallengeStatsView.as_view(), name='challenge-stats'),
]

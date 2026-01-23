from rest_framework import serializers
from django.utils import timezone
from .models import Challenge, UserChallenge, AIGeneratedChallenge


class ChallengeSerializer(serializers.ModelSerializer):
    """챌린지 목록/상세 직렬화"""
    type_display = serializers.CharField(source='get_type_display', read_only=True)
    difficulty_display = serializers.CharField(source='get_difficulty_display', read_only=True)
    keyword_display = serializers.CharField(source='get_keyword_display', read_only=True)
    remaining_event_time = serializers.SerializerMethodField()
    is_event_active = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = Challenge
        fields = [
            'id', 'type', 'type_display', 'name', 'description', 
            'icon', 'icon_color', 'points', 'difficulty', 'difficulty_display',
            'keyword', 'keyword_display', 'duration_days', 'target_amount', 
            'target_category', 'event_start', 'event_end', 
            'remaining_event_time', 'is_event_active', 'is_active'
        ]

    def get_remaining_event_time(self, obj):
        """이벤트 챌린지의 남은 시간 (초 단위)"""
        if obj.type != 'EVENT' or not obj.event_end:
            return None
        now = timezone.now()
        if now > obj.event_end:
            return 0
        delta = obj.event_end - now
        return int(delta.total_seconds())


class ChallengeListSerializer(serializers.ModelSerializer):
    """챌린지 목록용 간략 직렬화"""
    type_display = serializers.CharField(source='get_type_display', read_only=True)
    difficulty_display = serializers.CharField(source='get_difficulty_display', read_only=True)
    keyword_display = serializers.CharField(source='get_keyword_display', read_only=True)
    
    class Meta:
        model = Challenge
        fields = [
            'id', 'type', 'type_display', 'name', 'description', 'icon', 'icon_color',
            'points', 'difficulty', 'difficulty_display', 'duration_days',
            'keyword', 'keyword_display'
        ]


class UserChallengeSerializer(serializers.ModelSerializer):
    """사용자 챌린지 직렬화 (진행 상황 포함)"""
    challenge_name = serializers.SerializerMethodField()
    challenge_icon = serializers.SerializerMethodField()
    challenge_icon_color = serializers.SerializerMethodField()
    remaining_days = serializers.IntegerField(read_only=True)
    remaining_amount = serializers.IntegerField(read_only=True)
    progress_percent = serializers.FloatField(read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    
    class Meta:
        model = UserChallenge
        fields = [
            'id', 'challenge_name', 'challenge_icon', 'challenge_icon_color',
            'status', 'status_display', 'started_at', 'end_date',
            'remaining_days', 'target_amount', 'current_spent', 
            'remaining_amount', 'progress_percent', 'points_earned'
        ]

    def get_challenge_name(self, obj):
        if obj.challenge:
            return obj.challenge.name
        elif obj.ai_challenge:
            return obj.ai_challenge.name
        return '알 수 없음'

    def get_challenge_icon(self, obj):
        if obj.challenge:
            return obj.challenge.icon
        elif obj.ai_challenge:
            return obj.ai_challenge.icon
        return 'sparkles'

    def get_challenge_icon_color(self, obj):
        if obj.challenge:
            return obj.challenge.icon_color
        elif obj.ai_challenge:
            return obj.ai_challenge.icon_color
        return '#8B5CF6'


class UserChallengeCreateSerializer(serializers.Serializer):
    """챌린지 시작용 직렬화"""
    challenge_id = serializers.IntegerField(required=False)
    ai_challenge_id = serializers.IntegerField(required=False)

    def validate(self, data):
        if not data.get('challenge_id') and not data.get('ai_challenge_id'):
            raise serializers.ValidationError(
                "challenge_id 또는 ai_challenge_id 중 하나는 필수입니다."
            )
        return data


class AIGeneratedChallengeSerializer(serializers.ModelSerializer):
    """AI 맞춤 챌린지 직렬화"""
    difficulty_display = serializers.CharField(source='get_difficulty_display', read_only=True)
    coaching_title = serializers.CharField(source='coaching.title', read_only=True)
    
    class Meta:
        model = AIGeneratedChallenge
        fields = [
            'id', 'name', 'description', 'icon', 'icon_color',
            'points', 'difficulty', 'difficulty_display',
            'duration_days', 'target_amount', 'target_category',
            'coaching_title', 'is_started', 'is_active', 'created_at'
        ]


class UserPointsSerializer(serializers.Serializer):
    """사용자 포인트 정보 직렬화"""
    points = serializers.IntegerField()
    total_points_earned = serializers.IntegerField()
    total_points_used = serializers.IntegerField()

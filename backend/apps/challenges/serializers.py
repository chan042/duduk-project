from rest_framework import serializers
from django.utils import timezone
from .models import Challenge, UserChallenge


class ChallengeSerializer(serializers.ModelSerializer):
    """챌린지 목록/상세 직렬화"""
    source_display = serializers.CharField(source='get_source_display', read_only=True)
    difficulty_display = serializers.CharField(source='get_difficulty_display', read_only=True)
    keyword_display = serializers.CharField(source='get_keyword_display', read_only=True)
    remaining_event_time = serializers.SerializerMethodField()
    is_event_active = serializers.BooleanField(read_only=True)
    is_template = serializers.BooleanField(read_only=True)
    is_user_created = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = Challenge
        fields = [
            'id', 'source', 'source_display', 'name', 'description', 
            'icon', 'icon_color', 'points', 'difficulty', 'difficulty_display',
            'keyword', 'keyword_display', 'duration_days', 'target_amount', 
            'target_category', 'event_start', 'event_end', 
            'remaining_event_time', 'is_event_active', 'is_template', 'is_user_created',
            'user', 'is_active', 'created_at'
        ]

    def get_remaining_event_time(self, obj):
        """이벤트 챌린지의 남은 시간 (초 단위)"""
        if obj.source != 'EVENT' or not obj.event_end:
            return None
        now = timezone.now()
        if now > obj.event_end:
            return 0
        delta = obj.event_end - now
        return int(delta.total_seconds())


class ChallengeListSerializer(serializers.ModelSerializer):
    """챌린지 목록용 간략 직렬화"""
    source_display = serializers.CharField(source='get_source_display', read_only=True)
    difficulty_display = serializers.CharField(source='get_difficulty_display', read_only=True)
    keyword_display = serializers.CharField(source='get_keyword_display', read_only=True)
    is_template = serializers.BooleanField(read_only=True)
    is_user_created = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = Challenge
        fields = [
            'id', 'source', 'source_display', 'name', 'description', 'icon', 'icon_color',
            'points', 'difficulty', 'difficulty_display', 'duration_days',
            'keyword', 'keyword_display', 'is_template', 'is_user_created'
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
        return obj.challenge.name if obj.challenge else '알 수 없음'

    def get_challenge_icon(self, obj):
        return obj.challenge.icon if obj.challenge else 'sparkles'

    def get_challenge_icon_color(self, obj):
        return obj.challenge.icon_color if obj.challenge else '#8B5CF6'


class UserChallengeCreateSerializer(serializers.Serializer):
    """챌린지 시작용 직렬화"""
    challenge_id = serializers.IntegerField(required=True)

    def validate_challenge_id(self, value):
        try:
            Challenge.objects.get(id=value, is_active=True)
        except Challenge.DoesNotExist:
            raise serializers.ValidationError("유효하지 않은 챌린지입니다.")
        return value





class UserPointsSerializer(serializers.Serializer):
    """사용자 포인트 정보 직렬화"""
    points = serializers.IntegerField()
    total_points_earned = serializers.IntegerField()
    total_points_used = serializers.IntegerField()


class UserCreatedChallengeSerializer(serializers.ModelSerializer):
    """사용자가 직접 챌린지 생성용 직렬화"""
    class Meta:
        model = Challenge
        fields = ['name', 'description', 'icon', 'icon_color', 
                  'duration_days', 'target_amount', 'target_category']
    
    def create(self, validated_data):
        validated_data['source'] = 'USER'
        validated_data['points'] = 50  # 사용자 챌린지 기본 포인트
        return super().create(validated_data)

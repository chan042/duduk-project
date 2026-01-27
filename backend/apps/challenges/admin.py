from django.contrib import admin
from .models import ChallengeTemplate, UserChallenge, ChallengeDailyLog

"""
Challenges 관리자(Admin) 설정 파일

이 파일은 Django 관리자 페이지(Admin Site)에서 챌린지 관련 모델들을 
어떻게 표시하고 관리할지 설정합니다.
"""


@admin.register(ChallengeTemplate)
class ChallengeTemplateAdmin(admin.ModelAdmin):
    """
    챌린지 템플릿 관리 (두둑, 이벤트)
    """
    list_display = ['name', 'source_type', 'difficulty', 'base_points', 'duration_days', 'is_active', 'display_order', 'created_at']
    list_filter = ['source_type', 'difficulty', 'is_active', 'requires_daily_check', 'requires_photo']
    search_fields = ['name', 'description']
    ordering = ['display_order', '-created_at']
    list_editable = ['is_active', 'display_order']
    
    fieldsets = (
        ('기본 정보', {
            'fields': ('name', 'description', 'icon', 'icon_color', 'source_type', 'difficulty')
        }),
        ('보상', {
            'fields': ('base_points', 'points_formula', 'max_points', 'has_penalty', 'penalty_formula', 'max_penalty', 'bonus_condition', 'bonus_points')
        }),
        ('기간 및 설정', {
            'fields': ('duration_days', 'requires_daily_check', 'requires_photo', 'photo_frequency', 'photo_description')
        }),
        ('검증 조건', {
            'fields': ('success_conditions', 'user_inputs', 'success_description')
        }),
        ('프론트 표시', {
            'fields': ('display_config',)
        }),
        ('이벤트 전용', {
            'fields': ('event_start_at', 'event_end_at', 'event_banner_url'),
            'classes': ('collapse',)
        }),
        ('상태', {
            'fields': ('is_active', 'display_order')
        }),
    )


@admin.register(UserChallenge)
class UserChallengeAdmin(admin.ModelAdmin):
    """
    사용자 챌린지 참여 현황 관리
    """
    list_display = ['user', 'name', 'source_type', 'status', 'started_at', 'ends_at', 'earned_points', 'attempt_number']
    list_filter = ['status', 'source_type', 'difficulty', 'started_at']
    search_fields = ['user__username', 'user__email', 'name']
    ordering = ['-started_at']
    raw_id_fields = ['user', 'template', 'source_coaching', 'previous_attempt']
    readonly_fields = ['created_at', 'updated_at']
    
    fieldsets = (
        ('사용자 정보', {
            'fields': ('user', 'source_type', 'template', 'source_coaching')
        }),
        ('챌린지 정보', {
            'fields': ('name', 'description', 'icon', 'icon_color', 'difficulty')
        }),
        ('기간', {
            'fields': ('duration_days', 'started_at', 'ends_at')
        }),
        ('설정', {
            'fields': ('success_conditions', 'user_input_values', 'system_generated_values', 'success_description')
        }),
        ('추가 검증', {
            'fields': ('requires_daily_check', 'requires_photo', 'photo_frequency', 'photo_description')
        }),
        ('보상', {
            'fields': ('base_points', 'points_formula', 'max_points', 'has_penalty', 'penalty_formula', 'max_penalty', 'bonus_condition', 'bonus_points')
        }),
        ('프론트 표시', {
            'fields': ('display_config', 'progress')
        }),
        ('상태 및 결과', {
            'fields': ('status', 'final_spent', 'earned_points', 'penalty_points', 'bonus_earned', 'completed_at')
        }),
        ('재도전', {
            'fields': ('attempt_number', 'previous_attempt')
        }),
        ('메타', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(ChallengeDailyLog)
class ChallengeDailyLogAdmin(admin.ModelAdmin):
    """
    일별 챌린지 로그 관리
    """
    list_display = ['user_challenge', 'log_date', 'spent_amount', 'transaction_count', 'is_checked', 'condition_met']
    list_filter = ['log_date', 'is_checked', 'condition_met']
    search_fields = ['user_challenge__name', 'user_challenge__user__username']
    ordering = ['-log_date']
    raw_id_fields = ['user_challenge']
    date_hierarchy = 'log_date'

from rest_framework import serializers
from django.utils import timezone
from datetime import timedelta, datetime, time, date
from calendar import monthrange
from django.db.models import Sum
import random
from .models import ChallengeTemplate, UserChallenge, ChallengeDailyLog
from .constants import (
    CONDITION_TYPE_AMOUNT_LIMIT,
    CONDITION_TYPE_ZERO_SPEND,
    CONDITION_TYPE_COMPARE,
    CONDITION_TYPE_PHOTO_VERIFICATION,
    CONDITION_TYPE_AMOUNT_LIMIT_WITH_PHOTO,
    CONDITION_TYPE_AMOUNT_RANGE,
    CONDITION_TYPE_DAILY_RULE,
    CONDITION_TYPE_DAILY_CHECK,
    CONDITION_TYPE_RANDOM_BUDGET,
    CONDITION_TYPE_CUSTOM,
    COMPARE_TYPE_LAST_MONTH_WEEK,
    COMPARE_TYPE_FIXED_EXPENSE,
    COMPARE_TYPE_NEXT_MONTH_CATEGORY,
)


def _get_last_month_bounds(reference_dt=None):
    now = reference_dt or timezone.now()
    if now.month == 1:
        last_month_year = now.year - 1
        last_month = 12
    else:
        last_month_year = now.year
        last_month = now.month - 1
    start = date(last_month_year, last_month, 1)
    end = date(last_month_year, last_month, monthrange(last_month_year, last_month)[1])
    return start, end


def _get_template_availability(template, user, reference_dt=None):
    """
    전월 데이터가 필요한 챌린지의 가용성 판단
    """
    success_conditions = template.success_conditions or {}
    compare_type = success_conditions.get('compare_type')

    if compare_type not in {COMPARE_TYPE_LAST_MONTH_WEEK, COMPARE_TYPE_FIXED_EXPENSE}:
        return True, None

    from apps.transactions.models import Transaction

    last_month_start, last_month_end = _get_last_month_bounds(reference_dt)
    base_queryset = Transaction.objects.filter(
        user=user,
        date__date__gte=last_month_start,
        date__date__lte=last_month_end,
    )
    if compare_type == COMPARE_TYPE_FIXED_EXPENSE:
        base_queryset = base_queryset.filter(is_fixed=True)

    total = base_queryset.aggregate(total=Sum('amount'))['total'] or 0
    if total <= 0:
        return False, "전월 지출 내역이 없어 도전할 수 없습니다."

    return True, None


class ChallengeTemplateSerializer(serializers.ModelSerializer):
    """챌린지 템플릿 상세 직렬화"""
    source_type_display = serializers.CharField(source='get_source_type_display', read_only=True)
    difficulty_display = serializers.CharField(source='get_difficulty_display', read_only=True)
    is_event_active = serializers.BooleanField(read_only=True)
    remaining_event_time = serializers.SerializerMethodField()
    is_available = serializers.SerializerMethodField()
    unavailable_reason = serializers.SerializerMethodField()
    
    class Meta:
        model = ChallengeTemplate
        fields = [
            'id', 'name', 'description',
            'source_type', 'source_type_display', 'difficulty', 'difficulty_display',
            'base_points', 'max_points', 'has_penalty', 'bonus_points',
            'duration_days',
            'success_conditions', 'user_inputs', 'success_description',
            'display_config',
            'requires_daily_check', 'requires_photo', 'photo_frequency', 'photo_description',
            'event_start_at', 'event_end_at', 'event_banner_url',
            'is_event_active', 'remaining_event_time',
            'is_available', 'unavailable_reason',
            'is_active', 'display_order', 'created_at'
        ]

    def get_remaining_event_time(self, obj):
        """이벤트 챌린지의 남은 시간 (초 단위)"""
        if obj.source_type != 'event' or not obj.event_end_at:
            return None
        now = timezone.now()
        if now > obj.event_end_at:
            return 0
        delta = obj.event_end_at - now
        return int(delta.total_seconds())

    def get_is_available(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return True
        is_available, _ = _get_template_availability(obj, request.user)
        return is_available

    def get_unavailable_reason(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return None
        _, reason = _get_template_availability(obj, request.user)
        return reason


class ChallengeTemplateListSerializer(serializers.ModelSerializer):
    """챌린지 템플릿 목록용 간략 직렬화"""
    source_type_display = serializers.CharField(source='get_source_type_display', read_only=True)
    difficulty_display = serializers.CharField(source='get_difficulty_display', read_only=True)
    is_event_active = serializers.BooleanField(read_only=True)
    is_available = serializers.SerializerMethodField()
    unavailable_reason = serializers.SerializerMethodField()
    
    # 사용자별 상태 정보
    my_challenge_status = serializers.CharField(read_only=True, required=False)
    my_challenge_id = serializers.IntegerField(read_only=True, required=False)

    class Meta:
        model = ChallengeTemplate
        fields = [
            'id', 'name', 'description',
            'source_type', 'source_type_display', 'difficulty', 'difficulty_display',
            'base_points', 'duration_days',
            'requires_photo', 'requires_daily_check', 'photo_description',
            'user_inputs', 'success_description',
            'display_config', 'is_event_active', 'display_order',
            'is_available', 'unavailable_reason',
            'my_challenge_status', 'my_challenge_id'
        ]

    def get_is_available(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return True
        is_available, _ = _get_template_availability(obj, request.user)
        return is_available

    def get_unavailable_reason(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return None
        _, reason = _get_template_availability(obj, request.user)
        return reason


class UserChallengeSerializer(serializers.ModelSerializer):
    """사용자 챌린지 직렬화 (진행 상황 포함)"""
    source_type_display = serializers.CharField(source='get_source_type_display', read_only=True)
    difficulty_display = serializers.CharField(source='get_difficulty_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    remaining_days = serializers.IntegerField(read_only=True)
    template_name = serializers.SerializerMethodField()
    
    class Meta:
        model = UserChallenge
        fields = [
            'id', 'source_type', 'source_type_display', 'template', 'template_name',
            'name', 'description',
            'difficulty', 'difficulty_display',
            'duration_days', 'started_at', 'ends_at', 'remaining_days',
            'success_conditions', 'user_input_values', 'system_generated_values',
            'success_description',
            'display_config', 'progress',
            'requires_daily_check', 'requires_photo', 'photo_frequency', 'photo_description',
            'base_points', 'max_points', 'has_penalty', 'bonus_points',
            'status', 'status_display',
            'final_spent', 'earned_points', 'penalty_points', 'bonus_earned',
            'completed_at', 'attempt_number',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'progress', 'status', 'final_spent', 'earned_points',
            'penalty_points', 'bonus_earned', 'completed_at', 'attempt_number',
            'created_at', 'updated_at'
        ]

    def get_template_name(self, obj):
        return obj.template.name if obj.template else None


class UserChallengeListSerializer(serializers.ModelSerializer):
    """사용자 챌린지 목록용 간략 직렬화"""
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    difficulty_display = serializers.CharField(source='get_difficulty_display', read_only=True)
    remaining_days = serializers.IntegerField(read_only=True)

    class Meta:
        model = UserChallenge
        fields = [
            'id', 'source_type', 'template', 'name', 'description',
            'difficulty', 'difficulty_display', 'started_at', 'ends_at', 'remaining_days',
            'duration_days', 'display_config', 'progress',
            'requires_photo', 'requires_daily_check', 'photo_description',
            'success_description',
            'status', 'status_display',
            'base_points', 'earned_points', 'attempt_number',
            'completed_at'
        ]


class UserChallengeCreateSerializer(serializers.Serializer):
    """템플릿 기반 챌린지 시작용 직렬화"""
    template_id = serializers.IntegerField(required=True)
    user_input_values = serializers.JSONField(required=False, default=dict)
    
    def validate_template_id(self, value):
        try:
            template = ChallengeTemplate.objects.get(id=value, is_active=True)
            # 이벤트 챌린지는 활성 기간 확인
            if template.source_type == 'event' and not template.is_event_active:
                raise serializers.ValidationError("이벤트 기간이 아닙니다.")
            return value
        except ChallengeTemplate.DoesNotExist:
            raise serializers.ValidationError("유효하지 않은 챌린지 템플릿입니다.")
    
    def validate(self, data):
        template = ChallengeTemplate.objects.get(id=data['template_id'])
        user_inputs = template.user_inputs or []
        input_values = data.get('user_input_values', {})

        # 전월 데이터가 필요한 챌린지 가용성 체크
        is_available, reason = _get_template_availability(template, self.context['request'].user)
        if not is_available:
            raise serializers.ValidationError(reason or "도전할 수 없는 챌린지입니다.")
        
        # 필수 입력값 검증
        for user_input in user_inputs:
            if user_input.get('required') and user_input['key'] not in input_values:
                raise serializers.ValidationError(
                    {user_input['key']: f"{user_input['label']}은(는) 필수 입력 항목입니다."}
                )

        # 무00의 날: 사용자 입력 카테고리 중복 금지
        if (template.success_conditions or {}).get('type') == CONDITION_TYPE_DAILY_RULE:
            keys = ['mon_forbidden', 'tue_forbidden', 'wed_forbidden', 'thu_forbidden']
            chosen = [input_values.get(k) for k in keys if input_values.get(k)]
            if len(chosen) != len(set(chosen)):
                raise serializers.ValidationError("요일별 금지 카테고리는 중복 선택할 수 없습니다.")
        
        data['template'] = template
        return data

    def create(self, validated_data):
        user = self.context['request'].user
        template = validated_data['template']
        user_input_values = validated_data.get('user_input_values', {})

        now = timezone.now()

        # 기존 활성 챌린지 확인
        existing = UserChallenge.objects.filter(
            user=user,
            template=template,
            status='active'
        ).exists()

        if existing:
            raise serializers.ValidationError("이미 진행 중인 동일 챌린지가 있습니다.")

        # 이전 시도 횟수 확인
        previous_attempts = UserChallenge.objects.filter(
            user=user,
            template=template
        ).order_by('-attempt_number').first()

        attempt_number = 1
        previous_attempt = None
        if previous_attempts:
            attempt_number = previous_attempts.attempt_number + 1
            previous_attempt = previous_attempts

        # success_conditions에 사용자 입력값 병합
        success_conditions = template.success_conditions.copy()
        for key, value in user_input_values.items():
            if key in success_conditions:
                success_conditions[key] = value

        compare_type = success_conditions.get('compare_type')
        if compare_type == COMPARE_TYPE_NEXT_MONTH_CATEGORY:
            target_category = user_input_values.get('target_category')
            if target_category:
                success_conditions['categories'] = [target_category]

        # 무00의 날: daily_rules 선생성
        system_generated_values = {}
        if success_conditions.get('type') == CONDITION_TYPE_DAILY_RULE:
            daily_rules = self._generate_daily_rules(user_input_values, success_conditions)
            success_conditions['daily_rules'] = daily_rules
            system_generated_values['daily_rules'] = daily_rules

        start_at = self._resolve_start_at(template, success_conditions, now)
        ends_at = start_at + timedelta(days=template.duration_days - 1)
        initial_progress = self._create_initial_progress(
            template=template,
            user_input_values=user_input_values,
            success_conditions=success_conditions,
            reference_dt=start_at,
        )

        # 비교형 챌린지: compare_base 저장
        display_config = template.display_config or {}
        progress_type = display_config.get('progress_type', 'amount')

        if progress_type == 'compare':
            compare_base = initial_progress.get('compare_base', 0)
            success_conditions['compare_base'] = compare_base
            system_generated_values['compare_base'] = compare_base
            if success_conditions.get('compare_type') == COMPARE_TYPE_NEXT_MONTH_CATEGORY:
                system_generated_values['future_message_notified'] = False
                system_generated_values['challenge_start_month'] = {
                    "year": start_at.year,
                    "month": start_at.month,
                }

        # 랜덤 예산 챌린지: random_budget 저장
        if progress_type == 'random_budget':
            random_budget = initial_progress.get('target', 0)
            system_generated_values['random_budget'] = random_budget

        initial_status = 'ready' if start_at > now else 'active'

        user_challenge = UserChallenge.objects.create(
            user=user,
            source_type=template.source_type,
            template=template,
            name=template.name,
            description=template.description,
            difficulty=template.difficulty,
            duration_days=template.duration_days,
            started_at=start_at,
            ends_at=ends_at,
            success_conditions=success_conditions,
            user_input_values=user_input_values,
            system_generated_values=system_generated_values,
            requires_daily_check=template.requires_daily_check,
            requires_photo=template.requires_photo,
            photo_frequency=template.photo_frequency,
            photo_description=template.photo_description,
            base_points=template.base_points,
            points_formula=template.points_formula,
            max_points=template.max_points,
            has_penalty=template.has_penalty,
            penalty_formula=template.penalty_formula,
            max_penalty=template.max_penalty,
            bonus_condition=template.bonus_condition,
            bonus_points=template.bonus_points,
            success_description=template.success_description,
            display_config=template.display_config,
            progress=initial_progress,
            attempt_number=attempt_number,
            previous_attempt=previous_attempt,
            status=initial_status,
        )

        return user_challenge

    def _resolve_start_at(self, template, success_conditions, now=None):
        """
        특정 챌린지는 시작일을 강제
        - 나와의 싸움(last_month_week): 항상 다음 월요일 시작
        """
        now = now or timezone.now()
        compare_type = (success_conditions or {}).get('compare_type')
        if compare_type != COMPARE_TYPE_LAST_MONTH_WEEK:
            return now

        weekday = now.weekday()
        days_until_monday = (7 - weekday) % 7
        if days_until_monday == 0:
            return now
        start_date = (now + timedelta(days=days_until_monday)).date()
        start_naive = datetime.combine(start_date, time.min)
        return timezone.make_aware(start_naive, timezone.get_current_timezone())

    def _generate_daily_rules(self, user_input_values, success_conditions):
        """무00의 날: 요일별 금지 카테고리 생성"""
        # 사용자 입력값에서 요일별 금지 카테고리 추출
        daily_rules = {}

        # 월~목 사용자 입력
        weekday_map = {
            'mon': 'mon_forbidden',
            'tue': 'tue_forbidden',
            'wed': 'wed_forbidden',
            'thu': 'thu_forbidden',
        }

        for day, input_key in weekday_map.items():
            forbidden_category = user_input_values.get(input_key, '')
            if forbidden_category:
                daily_rules[day] = forbidden_category

        # 금~일: AI 랜덤 지정 (3일) - 중복 불가
        remaining_days = ['fri', 'sat', 'sun']
        used = set(daily_rules.values())
        pool = [cat for cat in ALL_CATEGORIES if cat not in used]
        if len(pool) < len(remaining_days):
            raise serializers.ValidationError("선택 가능한 카테고리가 부족합니다. 다른 카테고리를 선택해주세요.")

        picked = random.sample(pool, len(remaining_days))
        for day, category in zip(remaining_days, picked):
            daily_rules[day] = category

        return daily_rules

    def _create_initial_progress(self, template, user_input_values, success_conditions=None, reference_dt=None):
        """초기 progress 생성"""
        display_config = template.display_config
        progress_type = display_config.get('progress_type', 'amount')
        success_conditions = success_conditions or template.success_conditions
        reference_dt = reference_dt or timezone.now()

        if progress_type == 'amount':
            target = user_input_values.get('target_amount') or \
                     template.success_conditions.get('target_amount', 0)
            progress = {
                "type": "amount",
                "current": 0,
                "target": target,
                "percentage": 0,
                "is_on_track": True,
                "remaining": target
            }
            if success_conditions.get('type') == CONDITION_TYPE_AMOUNT_RANGE and target:
                tolerance_percent = success_conditions.get('tolerance_percent', 10)
                progress['lower_limit'] = int(target * (1 - tolerance_percent / 100))
                progress['upper_limit'] = int(target * (1 + tolerance_percent / 100))
            return progress
        elif progress_type == 'zero_spend':
            return {
                "type": "zero_spend",
                "current": 0,
                "target_categories": template.success_conditions.get('categories', []),
                "is_violated": False,
                "violation_amount": 0,
                "is_on_track": True,
                "elapsed_days": 0,
                "total_days": template.duration_days,
                "percentage": 0,
            }
        elif progress_type == 'daily_check':
            return {
                "type": "daily_check",
                "checked_days": 0,
                "total_days": template.duration_days,
                "percentage": 0,
                "daily_status": [],
                "is_on_track": True
            }
        elif progress_type == 'photo':
            mode = template.photo_frequency or 'once'
            required_count = template.duration_days if template.photo_frequency == 'daily' else 1
            if mode == 'on_purchase':
                required_count = 0
            return {
                "type": "photo",
                "photo_count": 0,
                "required_count": required_count,
                "percentage": 0,
                "photos": [],
                "is_on_track": True,
                "mode": mode,
            }
        elif progress_type == 'compare':
            # 비교형 챌린지
            compare_base = self._calculate_compare_base(
                user_input_values=user_input_values,
                success_conditions=success_conditions,
                reference_dt=reference_dt,
            )
            compare_label = success_conditions.get('compare_label', '비교 기준')
            progress = {
                "type": "compare",
                "current": 0,
                "compare_base": compare_base,
                "target": compare_base,
                "compare_label": compare_label,
                "difference": 0,
                "percentage": 0,
                "is_on_track": True
            }
            if success_conditions.get('compare_type') == COMPARE_TYPE_NEXT_MONTH_CATEGORY:
                progress.update({
                    "phase": "this_month",
                    "this_month_spent": compare_base,
                    "next_month_spent": 0,
                })
            return progress
        elif progress_type == 'daily_rule':
            return {
                "type": "daily_rule",
                "daily_status": [],
                "passed_days": 0,
                "total_days": template.duration_days,
                "is_on_track": True,
                "has_violation": False,
                "daily_rules": success_conditions.get('daily_rules', {}),
                "percentage": 0,
            }
        elif progress_type == 'random_budget':
            # 랜덤 예산 생성
            random_budget = random.randint(30000, 100000)
            return {
                "type": "random_budget",
                "current": 0,
                "target": random_budget,
                "percentage": 0,
                "is_on_track": True,
                "remaining": random_budget,
                "potential_points": int(random_budget * 0.08),
                "jackpot_eligible": False,
                "difference_percent": 100,
                "mask_target": True,
            }
        else:
            return {"type": progress_type, "is_on_track": True}

    def _calculate_compare_base(self, user_input_values, success_conditions, reference_dt=None):
        """비교형 챌린지의 비교 기준 계산"""
        from apps.transactions.models import Transaction

        user = self.context['request'].user
        compare_type = success_conditions.get('compare_type', '')
        now = reference_dt or timezone.now()

        if compare_type == COMPARE_TYPE_LAST_MONTH_WEEK:
            # 나와의 싸움: 지난달 특정 주차의 지출
            try:
                compare_week = int(user_input_values.get('compare_week', 1))
            except (ValueError, TypeError):
                compare_week = 1
            
            # 1~5주차로 제한
            compare_week = max(1, min(compare_week, 5))
            
            last_month = now.month - 1 if now.month > 1 else 12
            last_month_year = now.year if now.month > 1 else now.year - 1

            # 해당 주차의 시작일과 종료일 계산
            first_day = 1 + (compare_week - 1) * 7
            days_in_month = monthrange(last_month_year, last_month)[1]
            last_day = min(first_day + 6, days_in_month)

            try:
                start_date = date(last_month_year, last_month, first_day)
                end_date = date(last_month_year, last_month, last_day)

                total = Transaction.objects.filter(
                    user=user,
                    date__date__gte=start_date,
                    date__date__lte=end_date
                ).aggregate(total=Sum('amount'))['total'] or 0
                
                return total
            except ValueError:
                # 날짜 계산 오류 시 0 반환
                return 0

        elif compare_type == COMPARE_TYPE_FIXED_EXPENSE:
            # 고정비 다이어트: 지난달 고정비
            if now.month == 1:
                last_month_year = now.year - 1
                last_month = 12
            else:
                last_month_year = now.year
                last_month = now.month - 1

            last_month_start = date(last_month_year, last_month, 1)
            last_month_end = date(last_month_year, last_month, monthrange(last_month_year, last_month)[1])

            total = Transaction.objects.filter(
                user=user,
                date__date__gte=last_month_start,
                date__date__lte=last_month_end,
                is_fixed=True
            ).aggregate(total=Sum('amount'))['total'] or 0

            return total

        elif compare_type == COMPARE_TYPE_NEXT_MONTH_CATEGORY:
            # 미래의 나에게: 시작 달 카테고리 지출 (시작 시점 기준)
            target_category = user_input_values.get('target_category', '')
            first_day_of_month = date(now.year, now.month, 1)

            total = Transaction.objects.filter(
                user=user,
                date__date__gte=first_day_of_month,
                date__date__lte=now.date(),
                category=target_category
            ).aggregate(total=Sum('amount'))['total'] or 0

            return total

        return 0



ALL_CATEGORIES = [
    '식비', '생활', '카페/간식', '온라인 쇼핑', '패션/쇼핑', '뷰티/미용', 
    '교통', '자동차', '주거/통신', '의료/건강', '문화/여가', '여행/숙박', 
    '교육/학습', '자녀/육아', '반려동물', '경조/선물', '술/유흥', '기타'
]


class CustomChallengeCreateSerializer(serializers.Serializer):
    """사용자 커스텀 챌린지 생성용 직렬화"""
    name = serializers.CharField(max_length=100)
    description = serializers.CharField(required=False, allow_blank=True)
    difficulty = serializers.ChoiceField(choices=['easy', 'normal', 'hard'], default='normal')
    duration_days = serializers.IntegerField(min_value=1, max_value=365)
    
    # 검증 조건
    target_amount = serializers.IntegerField(required=False, allow_null=True)
    target_categories = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        default=list
    )

    def validate_target_categories(self, value):
        for category in value:
            if category != 'all' and category not in ALL_CATEGORIES:
                raise serializers.ValidationError(f"유효하지 않은 카테고리입니다: {category}")
        return value
    
    def create(self, validated_data):
        user = self.context['request'].user
        now = timezone.now()
        
        target_amount = validated_data.pop('target_amount', None)
        target_categories = validated_data.pop('target_categories', [])
        
        # success_conditions 생성
        success_conditions = {
            "type": CONDITION_TYPE_AMOUNT_LIMIT if target_amount else CONDITION_TYPE_ZERO_SPEND,
            "target_amount": target_amount or 0,
            "categories": target_categories or ["all"],
            "comparison": "lte"
        }
        
        # display_config 생성
        progress_type = "amount" if target_amount else "zero_spend"
        display_config = {
            "progress_type": progress_type,
            "primary_metric": {
                "label": "사용 금액",
                "unit": "원",
                "format": "currency",
                "show_target": bool(target_amount),
                "target_label": "목표"
            },
            "show_progress_bar": True
        }
        
        # 초기 progress
        if progress_type == "amount":
            progress = {
                "type": "amount",
                "current": 0,
                "target": target_amount,
                "percentage": 0,
                "is_on_track": True,
                "remaining": target_amount
            }
        else:
            progress = {
                "type": "zero_spend",
                "current": 0,
                "target_categories": target_categories,
                "is_violated": False,
                "violation_amount": 0,
                "is_on_track": True
            }
        
        user_challenge = UserChallenge.objects.create(
            user=user,
            source_type='custom',
            name=validated_data['name'],
            description=validated_data.get('description', ''),
            difficulty=validated_data.get('difficulty', 'normal'),
            duration_days=validated_data['duration_days'],
            started_at=None,
            ends_at=None,
            success_conditions=success_conditions,
            user_input_values={
                'target_amount': target_amount,
                'target_categories': target_categories
            },
            display_config=display_config,
            progress=progress,
            base_points=100,
            success_description=[f"{validated_data['duration_days']}일간 목표 금액 이하 지출"],
            status='saved',
        )

        return user_challenge


class ChallengeDailyLogSerializer(serializers.ModelSerializer):
    """일별 챌린지 로그 직렬화"""
    
    class Meta:
        model = ChallengeDailyLog
        fields = [
            'id', 'user_challenge', 'log_date',
            'spent_amount', 'transaction_count', 'spent_by_category',
            'is_checked', 'checked_at', 'photo_urls',
            'condition_met', 'condition_detail', 'note',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'spent_amount', 'transaction_count', 'spent_by_category', 'created_at', 'updated_at']


class UserPointsSerializer(serializers.Serializer):
    """사용자 포인트 정보 직렬화"""
    points = serializers.IntegerField()
    total_points_earned = serializers.IntegerField()
    total_points_used = serializers.IntegerField()


# =============================================================================
# AI 챌린지 관련 Serializers
# =============================================================================

class BaseChallengeGenerateSerializer(serializers.Serializer):
    """AI 챌린지 생성 요청 기본 클래스"""
    difficulty = serializers.ChoiceField(
        choices=['easy', 'normal', 'hard'],
        required=False,
        allow_null=True,
        default=None
    )


class AIChallengGenerateSerializer(BaseChallengeGenerateSerializer):
    """AI 챌린지 생성 요청용 직렬화"""
    details = serializers.CharField(max_length=500)


class CoachingChallengeGenerateSerializer(BaseChallengeGenerateSerializer):
    """코칭 기반 AI 챌린지 생성 요청용 직렬화"""
    coaching_id = serializers.IntegerField()


class BaseChallengePreviewSerializer(serializers.Serializer):
    """AI 챌린지 미리보기 기본 클래스"""
    name = serializers.CharField()
    description = serializers.CharField()
    difficulty = serializers.CharField()
    duration_days = serializers.IntegerField()
    base_points = serializers.IntegerField()
    success_conditions = serializers.ListField(child=serializers.CharField())
    target_amount = serializers.IntegerField(allow_null=True, required=False)
    target_categories = serializers.ListField(child=serializers.CharField(), required=False)
    target_keywords = serializers.ListField(child=serializers.CharField(), required=False)


class AIChallengePreviewSerializer(BaseChallengePreviewSerializer):
    """AI가 생성한 챌린지 미리보기 직렬화"""
    pass


class CoachingChallengePreviewSerializer(BaseChallengePreviewSerializer):
    """코칭 기반 AI 챌린지 미리보기 직렬화"""
    coaching_id = serializers.IntegerField(allow_null=True, required=False)


class BaseChallengeStartSerializer(serializers.Serializer):
    """AI 챌린지 시작 기본 클래스"""
    name = serializers.CharField(max_length=100)
    description = serializers.CharField(required=False, allow_blank=True)
    difficulty = serializers.ChoiceField(choices=['easy', 'normal', 'hard'])
    duration_days = serializers.IntegerField(min_value=1, max_value=365)
    base_points = serializers.IntegerField(min_value=0)
    success_conditions = serializers.ListField(child=serializers.CharField())
    target_amount = serializers.IntegerField(required=False, allow_null=True)
    target_categories = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        default=list
    )
    target_keywords = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        default=list
    )
    # 모든 기존 condition_type 허용
    condition_type = serializers.ChoiceField(
        choices=[
            CONDITION_TYPE_AMOUNT_LIMIT, CONDITION_TYPE_ZERO_SPEND, CONDITION_TYPE_COMPARE,
            CONDITION_TYPE_AMOUNT_RANGE, CONDITION_TYPE_DAILY_RULE, CONDITION_TYPE_RANDOM_BUDGET,
            CONDITION_TYPE_PHOTO_VERIFICATION, CONDITION_TYPE_AMOUNT_LIMIT_WITH_PHOTO,
            CONDITION_TYPE_DAILY_CHECK, CONDITION_TYPE_CUSTOM,
        ],
        required=False,
        default=CONDITION_TYPE_AMOUNT_LIMIT,
    )

    def validate_target_categories(self, value):
        for category in value:
            if category != 'all' and category not in ALL_CATEGORIES:
                raise serializers.ValidationError(f"유효하지 않은 카테고리입니다: {category}")
        return value

    def _build_success_conditions(self, target_amount, target_categories, target_keywords, success_conditions_list, condition_type=None):
        """success_conditions JSON 생성"""
        if condition_type is None:
            condition_type = CONDITION_TYPE_AMOUNT_LIMIT if target_amount else CONDITION_TYPE_CUSTOM
        
        return {
            "type": condition_type,
            "target_amount": target_amount or 0,
            "categories": target_categories or ["all"],
            "keywords": target_keywords or [],
            "comparison": "lte",
            "conditions_list": success_conditions_list
        }

    def _build_display_config(self, target_amount):
        """display_config 생성"""
        progress_type = "amount" if target_amount else "custom"
        return {
            "progress_type": progress_type,
            "primary_metric": {
                "label": "사용 금액",
                "unit": "원",
                "format": "currency",
                "show_target": bool(target_amount),
                "target_label": "목표"
            },
            "show_progress_bar": True,
        }

    def _build_initial_progress(self, target_amount):
        """초기 progress 생성"""
        if target_amount:
            return {
                "type": "amount",
                "current": 0,
                "target": target_amount,
                "percentage": 0,
                "is_on_track": True,
                "remaining": target_amount
            }
        else:
            return {
                "type": "custom",
                "current": 0,
                "percentage": 0,
                "is_on_track": True,
                "checked_conditions": []
            }

    def _create_user_challenge(self, validated_data, source_coaching=None, generated_by='gpt'):
        """UserChallenge 생성 공통 로직"""
        user = self.context['request'].user

        target_amount = validated_data.pop('target_amount', None)
        target_categories = validated_data.pop('target_categories', [])
        target_keywords = validated_data.pop('target_keywords', [])
        success_conditions_list = validated_data.pop('success_conditions', [])
        condition_type = validated_data.pop('condition_type', None)

        success_conditions = self._build_success_conditions(
            target_amount, target_categories, target_keywords, success_conditions_list, condition_type
        )
        display_config = self._build_display_config(target_amount)
        progress = self._build_initial_progress(target_amount)
        success_description = success_conditions_list

        user_challenge = UserChallenge.objects.create(
            user=user,
            source_type='ai',
            source_coaching=source_coaching,
            name=validated_data['name'],
            description=validated_data.get('description', ''),
            difficulty=validated_data.get('difficulty', 'normal'),
            duration_days=validated_data['duration_days'],
            started_at=None,
            ends_at=None,
            success_conditions=success_conditions,
            user_input_values={
                'target_amount': target_amount,
                'target_categories': target_categories,
                'target_keywords': target_keywords
            },
            system_generated_values={
                'success_conditions_list': success_conditions_list,
                'generated_by': generated_by
            },
            display_config=display_config,
            progress=progress,
            base_points=validated_data['base_points'],
            success_description=success_description,
            status='saved',
        )

        return user_challenge


class AIChallengeStartSerializer(BaseChallengeStartSerializer):
    """AI 챌린지 시작 직렬화"""

    def create(self, validated_data):
        return self._create_user_challenge(validated_data, generated_by='gpt')


class CoachingChallengeStartSerializer(BaseChallengeStartSerializer):
    """코칭 기반 AI 챌린지 시작 직렬화"""
    coaching_id = serializers.IntegerField(required=False, allow_null=True)

    def create(self, validated_data):
        user = self.context['request'].user
        coaching_id = validated_data.pop('coaching_id', None)

        # 코칭 객체 조회
        source_coaching = None
        if coaching_id:
            from apps.coaching.models import Coaching
            try:
                source_coaching = Coaching.objects.get(id=coaching_id, user=user)
            except Coaching.DoesNotExist:
                pass

        return self._create_user_challenge(
            validated_data,
            source_coaching=source_coaching,
            generated_by='gpt_coaching'
        )

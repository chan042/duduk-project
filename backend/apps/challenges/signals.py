from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone
from django.db.models import Sum
from datetime import timedelta
from apps.transactions.models import Transaction
from .models import UserChallenge, ChallengeDailyLog


def _should_track_transaction(user_challenge, transaction):
    """
    해당 지출이 챌린지에서 추적해야 하는 지출인지 판단
    
    우선순위:
    1. target_keywords가 있으면 키워드 매칭 우선
    2. target_categories만 있으면 카테고리 매칭
    3. 둘 다 없거나 "all"이면 모든 지출 추적
    """
    success_conditions = user_challenge.success_conditions or {}
    
    target_keywords = success_conditions.get('keywords', [])
    target_categories = success_conditions.get('categories', [])
    
    # 1. 키워드가 있으면 키워드 매칭 우선
    if target_keywords:
        search_text = f"{transaction.item} {transaction.store} {transaction.memo}".lower()
        for keyword in target_keywords:
            if keyword.lower() in search_text:
                return True
        return False
    
    # 2. 키워드가 없으면 카테고리 매칭
    if not target_categories or 'all' in target_categories:
        return True
    
    return transaction.category in target_categories


@receiver(post_save, sender=Transaction)
def update_challenge_progress_on_transaction(sender, instance, created, **kwargs):
    """
    새로운 Transaction 생성 시 관련 챌린지 진행 상황 자동 업데이트
    """
    if not created:
        return

    user = instance.user
    category = instance.category
    amount = instance.amount
    transaction_date = instance.date.date() if hasattr(instance.date, 'date') else instance.date

    # 진행 중인 챌린지 조회
    active_challenges = UserChallenge.objects.filter(
        user=user,
        status='active',
        started_at__date__lte=transaction_date,
        ends_at__date__gte=transaction_date
    )

    for uc in active_challenges:
        success_conditions = uc.success_conditions or {}
        compare_type = success_conditions.get('compare_type', '')
        
        if compare_type == 'fixed_expense' and not instance.is_fixed:
            continue
        
        # 챌린지 관련 지출인지 확인
        if not _should_track_transaction(uc, instance):
            continue
            
        _update_daily_log(uc, transaction_date, category, amount)
        _update_challenge_progress(uc)
        _check_auto_judgement(uc, transaction_date, category, amount)


def _update_daily_log(user_challenge, log_date, category, amount):
    """일별 로그 업데이트"""
    log, created = ChallengeDailyLog.objects.get_or_create(
        user_challenge=user_challenge,
        log_date=log_date,
        defaults={
            'spent_amount': 0,
            'transaction_count': 0,
            'spent_by_category': {}
        }
    )
    
    # 지출 합산
    log.spent_amount += amount
    log.transaction_count += 1
    
    # 카테고리별 지출
    spent_by_category = log.spent_by_category or {}
    spent_by_category[category] = spent_by_category.get(category, 0) + amount
    log.spent_by_category = spent_by_category
    
    log.save()


def _update_challenge_progress(user_challenge, transaction_date=None, category=None, amount=None):
    """챌린지 progress 업데이트"""
    display_config = user_challenge.display_config or {}
    progress_type = display_config.get('progress_type', 'amount')
    success_conditions = user_challenge.success_conditions or {}
    condition_type = success_conditions.get('type', 'amount_limit')

    # 전체 지출 합계
    total_spent = user_challenge.daily_logs.aggregate(
        total=Sum('spent_amount')
    )['total'] or 0

    if progress_type == 'amount':
        _update_amount_progress(user_challenge, total_spent, success_conditions)
    elif progress_type == 'zero_spend':
        _update_zero_spend_progress(user_challenge, total_spent, success_conditions)
    elif progress_type == 'compare':
        _update_compare_progress(user_challenge, total_spent, success_conditions)
    elif progress_type == 'daily_check':
        _update_daily_check_progress(user_challenge)
    elif progress_type == 'daily_rule':
        _update_daily_rule_progress(user_challenge, success_conditions)
    elif progress_type == 'photo':
        _update_photo_progress(user_challenge, success_conditions)
    elif progress_type == 'random_budget':
        _update_random_budget_progress(user_challenge, total_spent, success_conditions)
    else:
        # 기본: amount 타입으로 처리
        _update_amount_progress(user_challenge, total_spent, success_conditions)


def _update_amount_progress(user_challenge, total_spent, success_conditions):
    """amount 타입 progress 업데이트"""
    target = int(success_conditions.get('target_amount', 0))
    
    if target > 0:
        percentage = round((total_spent / target) * 100, 1)
        remaining = max(0, target - total_spent)
        is_on_track = total_spent <= target
    else:
        percentage = 0 if total_spent == 0 else 100
        remaining = 0
        is_on_track = total_spent == 0
    
    progress = {
        "type": "amount",
        "current": total_spent,
        "target": target,
        "percentage": min(100, percentage),
        "is_on_track": is_on_track,
        "remaining": remaining
    }
    
    user_challenge.update_progress(progress)


def _update_zero_spend_progress(user_challenge, total_spent, success_conditions):
    """zero_spend 타입 progress 업데이트"""
    target_categories = success_conditions.get('categories', [])
    
    # 대상 카테고리 지출 합계
    violation_amount = 0
    if target_categories and 'all' not in target_categories:
        for log in user_challenge.daily_logs.all():
            for cat, amt in (log.spent_by_category or {}).items():
                if cat in target_categories:
                    violation_amount += amt
    else:
        violation_amount = total_spent
    
    progress = {
        "type": "zero_spend",
        "current": violation_amount,
        "target_categories": target_categories,
        "is_violated": violation_amount > 0,
        "violation_amount": violation_amount,
        "is_on_track": violation_amount == 0
    }
    
    user_challenge.update_progress(progress)


def _update_compare_progress(user_challenge, total_spent, success_conditions):
    """compare 타입 progress 업데이트"""
    compare_base = int(success_conditions.get('compare_base', 0))
    compare_label = success_conditions.get('compare_label', '비교 기준')
    
    difference = total_spent - compare_base
    percentage = round((total_spent / compare_base) * 100, 1) if compare_base > 0 else 0
    is_on_track = total_spent < compare_base
    
    progress = {
        "type": "compare",
        "current": total_spent,
        "compare_base": compare_base,
        "target": compare_base,
        "compare_label": compare_label,
        "difference": difference,
        "percentage": percentage,
        "is_on_track": is_on_track
    }
    
    user_challenge.update_progress(progress)


def _update_daily_check_progress(user_challenge):
    """daily_check 타입 progress 업데이트"""
    checked_count = user_challenge.daily_logs.filter(is_checked=True).count()
    total_days = user_challenge.duration_days
    percentage = round((checked_count / total_days) * 100, 1) if total_days > 0 else 0
    
    daily_status = []
    for log in user_challenge.daily_logs.order_by('log_date'):
        daily_status.append({
            "date": str(log.log_date),
            "checked": log.is_checked,
            "amount": log.spent_amount
        })
    
    progress = {
        "type": "daily_check",
        "checked_days": checked_count,
        "total_days": total_days,
        "percentage": percentage,
        "daily_status": daily_status,
        "is_on_track": True
    }
    
    user_challenge.update_progress(progress)


def _update_daily_rule_progress(user_challenge, success_conditions):
    """daily_rule 타입 progress 업데이트 (무00의 날)"""
    rules = success_conditions.get('daily_rules', {})

    passed_days = 0
    total_days = 0
    daily_status = []
    has_violation = False

    for log in user_challenge.daily_logs.order_by('log_date'):
        weekday = log.log_date.strftime('%a').lower()
        forbidden_category = rules.get(weekday)

        if forbidden_category:
            total_days += 1
            category_spent = (log.spent_by_category or {}).get(forbidden_category, 0)
            passed = category_spent == 0

            if passed:
                passed_days += 1
            else:
                has_violation = True

            daily_status.append({
                "date": str(log.log_date),
                "weekday": weekday,
                "forbidden": forbidden_category,
                "spent": category_spent,
                "passed": passed
            })

    progress = {
        "type": "daily_rule",
        "daily_status": daily_status,
        "passed_days": passed_days,
        "total_days": total_days,
        "is_on_track": not has_violation,
        "has_violation": has_violation
    }

    user_challenge.update_progress(progress)


def _check_auto_judgement(user_challenge, transaction_date=None, category=None, amount=None):
    """
    각 챌린지 유형별 즉시 실패 조건 체크
    딕셔너리+함수 매핑으로 condition_type별 핸들러 호출
    """
    progress = user_challenge.progress or {}
    success_conditions = user_challenge.success_conditions or {}

    now = timezone.now()

    # 기한 만료 확인
    if now >= user_challenge.ends_at:
        is_success = _evaluate_success(user_challenge, progress, success_conditions)
        final_spent = progress.get('current', 0)
        user_challenge.complete_challenge(is_success, final_spent)
        return

    # 챌린지 유형별 즉시 실패 조건 확인
    condition_type = success_conditions.get('type', 'amount_limit')
    
    # 딕셔너리에서 핸들러 조회 후 실행
    handler = IMMEDIATE_FAILURE_HANDLERS.get(condition_type)
    if handler:
        handler(user_challenge, progress, success_conditions, transaction_date, category)


# ============================================================
# 즉시 실패 조건 체크 핸들러 함수들
# ============================================================

def _check_amount_limit_failure(user_challenge, progress, success_conditions, transaction_date=None, category=None):
    """amount_limit 타입 즉시 실패 체크 (예: 3만원의 행복)"""
    target = int(success_conditions.get('target_amount', 0))
    current = progress.get('current', 0)
    
    if target > 0:
        # 목표 금액이 있는 경우: 초과 시 즉시 실패
        if current > target:
            user_challenge.complete_challenge(False, current)
    else:
        # 목표 금액이 0인 경우 (무지출 챌린지): 지출 발생 시 즉시 실패
        if current > 0:
            user_challenge.complete_challenge(False, current)


def _check_compare_failure(user_challenge, progress, success_conditions, transaction_date=None, category=None):
    """compare 타입 즉시 실패 체크 (예: 나와의 싸움, 고정비 다이어트)"""
    compare_type = success_conditions.get('compare_type', '')
    compare_base = int(success_conditions.get('compare_base', 0))
    current = progress.get('current', 0)

    if compare_type == 'last_month_week':
        # 지난달 주차 지출보다 초과하면 즉시 실패
        if compare_base > 0 and current > compare_base:
            user_challenge.complete_challenge(False, current)
    elif compare_type == 'fixed_expense':
        # 고정비 다이어트 - 이번주 고정비 >= 이전 고정비면 즉시 실패
        if compare_base > 0 and current >= compare_base:
            user_challenge.complete_challenge(False, current)
    elif compare_type == 'next_month_category':
        # 미래의 나에게 - (a+1)달 카테고리 지출이 a달 초과 시 즉시 실패
        if compare_base > 0 and current > compare_base:
            user_challenge.complete_challenge(False, current)


def _check_zero_spend_failure(user_challenge, progress, success_conditions, transaction_date=None, category=None):
    """zero_spend 타입 즉시 실패 체크 (예: 3일 연속 무지출, 외식/배달 X)"""
    if progress.get('is_violated', False):
        user_challenge.complete_challenge(False, progress.get('violation_amount', 0))


def _check_amount_limit_with_photo_failure(user_challenge, progress, success_conditions, transaction_date=None, category=None):
    """amount_limit_with_photo 타입 즉시 실패 체크 (예: 현금 챌린지)"""
    target = user_challenge.user_input_values.get('target_amount', 0)
    if target:
        target = int(target)
        current = progress.get('current', 0)
        if current > target:
            user_challenge.complete_challenge(False, current)
            return

    # 하루라도 사진 미인증 시 즉시 실패 (전날까지 체크)
    if transaction_date:
        _check_photo_missing_failure(user_challenge, transaction_date)


def _check_photo_verification_failure(user_challenge, progress, success_conditions, transaction_date=None, category=None):
    """photo_verification 타입 즉시 실패 체크 (예: 원플원 러버)"""
    photo_condition = success_conditions.get('photo_condition', '')
    if '1+1' in photo_condition:
        # 편의점 지출이 있으면 당일 사진 인증 체크
        if category and '편의점' in category:
            _check_one_plus_one_failure(user_challenge, transaction_date)


def _check_amount_range_failure(user_challenge, progress, success_conditions, transaction_date=None, category=None):
    """amount_range 타입 즉시 실패 체크 (예: 내 소비 맞추기)"""
    target = user_challenge.user_input_values.get('target_amount', 0)
    if target:
        target = int(target)
        tolerance_percent = success_conditions.get('tolerance_percent', 10)
        upper_limit = target * (1 + tolerance_percent / 100)
        current = progress.get('current', 0)
        if current > upper_limit:
            user_challenge.complete_challenge(False, current)


def _check_daily_rule_failure(user_challenge, progress, success_conditions, transaction_date=None, category=None):
    """daily_rule 타입 즉시 실패 체크 (예: 무00의 날)"""
    if progress.get('has_violation', False):
        user_challenge.complete_challenge(False, progress.get('current', 0))


def _check_random_budget_failure(user_challenge, progress, success_conditions, transaction_date=None, category=None):
    """random_budget 타입 즉시 실패 체크 (예: 두근두근 데스게임)"""
    random_budget = user_challenge.system_generated_values.get('random_budget', 0)
    if random_budget:
        random_budget = int(random_budget)
        current = progress.get('current', 0)
        if current > random_budget:
            user_challenge.complete_challenge(False, current)


def _check_custom_failure(user_challenge, progress, success_conditions, transaction_date=None, category=None):
    """custom 타입 즉시 실패 체크 (AI/커스텀 챌린지)"""
    target = int(success_conditions.get('target_amount', 0))
    current = progress.get('current', 0)
    
    if target > 0:
        # 목표 금액이 있는 경우: 초과 시 즉시 실패
        if current > target:
            user_challenge.complete_challenge(False, current)
    else:
        # 목표 금액이 0인 경우 (zero_spend 스타일): 지출 발생 시 즉시 실패
        if progress.get('is_violated', False) or current > 0:
            user_challenge.complete_challenge(False, current)


# condition_type별 즉시 실패 체크 핸들러 매핑
IMMEDIATE_FAILURE_HANDLERS = {
    'amount_limit': _check_amount_limit_failure,
    'compare': _check_compare_failure,
    'zero_spend': _check_zero_spend_failure,
    'amount_limit_with_photo': _check_amount_limit_with_photo_failure,
    'photo_verification': _check_photo_verification_failure,
    'amount_range': _check_amount_range_failure,
    'daily_rule': _check_daily_rule_failure,
    'random_budget': _check_random_budget_failure,
    'custom': _check_custom_failure,
    'daily_check': None,  # daily_check는 즉시 실패 조건 없음
}



def _check_photo_missing_failure(user_challenge, current_date):
    """현금 챌린지: 전날까지 사진 미인증 체크"""
    start_date = user_challenge.started_at.date()
    yesterday = current_date - timedelta(days=1)

    if yesterday >= start_date:
        # 시작일부터 어제까지 사진 인증 확인
        date_iter = start_date
        while date_iter <= yesterday:
            log = user_challenge.daily_logs.filter(log_date=date_iter).first()
            if not log or not log.photo_urls:
                user_challenge.complete_challenge(False, user_challenge.progress.get('current', 0))
                return
            date_iter += timedelta(days=1)


def _check_one_plus_one_failure(user_challenge, transaction_date):
    """원플원 러버: 편의점 지출 당일 1+1 미인증 체크"""
    # 전날까지의 편의점 지출에 대해 사진 인증 확인
    start_date = user_challenge.started_at.date()
    yesterday = transaction_date - timedelta(days=1)

    if yesterday >= start_date:
        for log in user_challenge.daily_logs.filter(log_date__gte=start_date, log_date__lte=yesterday):
            spent_by_category = log.spent_by_category or {}
            convenience_spent = spent_by_category.get('편의점', 0)
            if convenience_spent > 0:
                # 편의점 지출이 있는데 사진 인증이 없으면 실패
                if not log.photo_urls:
                    user_challenge.complete_challenge(False, user_challenge.progress.get('current', 0))
                    return


def _update_photo_progress(user_challenge, success_conditions):
    """photo 타입 progress 업데이트"""
    total_photos = 0
    photos = []

    for log in user_challenge.daily_logs.order_by('log_date'):
        for photo in (log.photo_urls or []):
            total_photos += 1
            photos.append({
                "date": str(log.log_date),
                "url": photo.get('url'),
                "verified": photo.get('verified', False)
            })

    required_count = success_conditions.get('required_photos', 1)
    if user_challenge.photo_frequency == 'daily':
        required_count = user_challenge.duration_days

    percentage = round((total_photos / required_count) * 100, 1) if required_count > 0 else 0

    progress = {
        "type": "photo",
        "photo_count": total_photos,
        "required_count": required_count,
        "percentage": min(100, percentage),
        "photos": photos,
        "is_on_track": total_photos > 0
    }

    user_challenge.update_progress(progress)


def _update_random_budget_progress(user_challenge, total_spent, success_conditions):
    """random_budget 타입 progress 업데이트 (두근두근 데스게임)"""
    import random

    # 랜덤 예산이 없으면 생성
    random_budget = user_challenge.system_generated_values.get('random_budget')
    if not random_budget:
        # 30,000 ~ 100,000 범위의 랜덤 예산 생성
        random_budget = random.randint(30000, 100000)
        system_values = user_challenge.system_generated_values or {}
        system_values['random_budget'] = random_budget
        user_challenge.system_generated_values = system_values
        user_challenge.save(update_fields=['system_generated_values'])

    random_budget = int(random_budget)
    percentage = round((total_spent / random_budget) * 100, 1) if random_budget > 0 else 0
    remaining = max(0, random_budget - total_spent)
    is_on_track = total_spent <= random_budget

    # 예상 포인트 계산
    if is_on_track:
        potential_points = int((random_budget - total_spent) * 0.08)
        potential_points = min(potential_points, 1000)
    else:
        # 초과 시 패널티
        penalty = int((total_spent - random_budget) * 0.01)
        potential_points = -min(penalty, 500)

    # 잭팟 가능 여부 (차이가 5% 이내)
    difference_percent = abs(random_budget - total_spent) / random_budget * 100 if random_budget > 0 else 100
    jackpot_eligible = difference_percent <= 5

    progress = {
        "type": "random_budget",
        "current": total_spent,
        "target": random_budget,
        "percentage": min(100, percentage),
        "is_on_track": is_on_track,
        "remaining": remaining,
        "potential_points": potential_points,
        "jackpot_eligible": jackpot_eligible,
        "difference_percent": round(difference_percent, 1)
    }

    user_challenge.update_progress(progress)


def _evaluate_success(user_challenge, progress, success_conditions):
    """성공 여부 평가"""
    condition_type = success_conditions.get('type', 'amount_limit')
    comparison = success_conditions.get('comparison', 'lte')

    if condition_type == 'amount_limit':
        target = int(success_conditions.get('target_amount', 0))
        current = progress.get('current', 0)

        if comparison == 'lte':
            return current <= target
        elif comparison == 'lt':
            return current < target
        elif comparison == 'gte':
            return current >= target
        elif comparison == 'gt':
            return current > target
        elif comparison == 'eq':
            return current == target

    elif condition_type == 'amount_limit_with_photo':
        # 현금 챌린지: 금액 + 사진 인증 모두 충족해야 성공
        target = user_challenge.user_input_values.get('target_amount', 0)
        if target:
            target = int(target)
            current = progress.get('current', 0)
            if current > target:
                return False

        # 모든 날 사진 인증 확인
        start_date = user_challenge.started_at.date()
        end_date = user_challenge.ends_at.date()
        from datetime import timedelta
        date_iter = start_date
        while date_iter <= end_date:
            log = user_challenge.daily_logs.filter(log_date=date_iter).first()
            if not log or not log.photo_urls:
                return False
            date_iter += timedelta(days=1)
        return True

    elif condition_type == 'zero_spend':
        return not progress.get('is_violated', False)

    elif condition_type == 'daily_check':
        required_days = success_conditions.get('required_days', user_challenge.duration_days)
        checked_days = progress.get('checked_days', 0)
        return checked_days >= required_days

    elif condition_type == 'photo_verification':
        required_count = success_conditions.get('required_photos', 1)
        photo_count = progress.get('photo_count', 0)
        return photo_count >= required_count

    elif condition_type == 'compare':
        return progress.get('is_on_track', False)

    elif condition_type == 'daily_rule':
        return progress.get('is_on_track', False)

    elif condition_type == 'amount_range':
        # 내 소비 맞추기: ±10% 범위 내
        target = user_challenge.user_input_values.get('target_amount', 0)
        if target:
            target = int(target)
            tolerance_percent = success_conditions.get('tolerance_percent', 10)
            lower_limit = target * (1 - tolerance_percent / 100)
            upper_limit = target * (1 + tolerance_percent / 100)
            current = progress.get('current', 0)
            return lower_limit <= current <= upper_limit
        return False

    elif condition_type == 'random_budget':
        return progress.get('is_on_track', False)

    return progress.get('is_on_track', False)

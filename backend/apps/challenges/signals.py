from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone
from django.db.models import Sum
from datetime import timedelta, date
from calendar import monthrange
from apps.transactions.models import Transaction
from .models import UserChallenge, ChallengeDailyLog
from .constants import (
    CONVENIENCE_STORE_KEYWORDS,
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
from .services.failure_reason import (
    infer_failure_reason,
    reason_amount_exceeded,
    reason_compare_exceeded,
    reason_zero_spend_violation,
    reason_photo_not_verified_yesterday,
    reason_one_plus_one_photo_missing,
    reason_amount_range_exceeded,
    reason_daily_rule_violation,
    reason_random_budget_exceeded,
)


def _contains_convenience_store_keyword(text: str) -> bool:
    lowered = (text or "").lower()
    return any(keyword in lowered for keyword in CONVENIENCE_STORE_KEYWORDS)


def _normalize_target_categories(categories):
    return list(categories) if categories else []


def _count_verified_photos(log: ChallengeDailyLog) -> int:
    return sum(1 for photo in (log.photo_urls or []) if photo.get("verified", False))


def _iter_elapsed_dates(user_challenge):
    """
    챌린지 시작일부터 현재(또는 종료일)까지의 날짜를 순회.
    """
    if not user_challenge.started_at:
        return []
    start_date = user_challenge.started_at.date()
    today = timezone.now().date()
    end_bound = user_challenge.ends_at.date() if user_challenge.ends_at else today
    end_date = min(today, end_bound)
    if end_date < start_date:
        return []

    dates = []
    cursor = start_date
    while cursor <= end_date:
        dates.append(cursor)
        cursor += timedelta(days=1)
    return dates


def _sum_convenience_spending(log: ChallengeDailyLog) -> int:
    spent_by_store = (log.condition_detail or {}).get("spent_by_store", {})
    convenience_spent = 0
    for store_name, amount in spent_by_store.items():
        if _contains_convenience_store_keyword(store_name):
            convenience_spent += amount
    return convenience_spent


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

    normalized_targets = _normalize_target_categories(target_categories)
    return transaction.category in normalized_targets


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
    store = instance.store
    transaction_date = instance.date.date() if hasattr(instance.date, 'date') else instance.date

    # started_at이 지난 'ready' 챌린지 자동 활성화
    UserChallenge.objects.filter(
        user=user,
        status='ready',
        started_at__date__lte=transaction_date
    ).update(status='active')

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
        
        if compare_type == COMPARE_TYPE_FIXED_EXPENSE and not instance.is_fixed:
            continue
        
        # 챌린지 관련 지출인지 확인
        if not _should_track_transaction(uc, instance):
            continue
            
        _update_daily_log(uc, transaction_date, category, amount, store)
        _update_challenge_progress(uc)
        _check_auto_judgement(uc, transaction_date, category, amount, store)


def _update_daily_log(user_challenge, log_date, category, amount, store=None):
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

    # 소비처 기준 누적
    detail = log.condition_detail or {}
    spent_by_store = detail.get("spent_by_store", {})
    normalized_store = (store or "").strip().lower()
    if normalized_store:
        spent_by_store[normalized_store] = spent_by_store.get(normalized_store, 0) + amount
        detail["spent_by_store"] = spent_by_store
        log.condition_detail = detail
    
    log.save()


def _update_challenge_progress(user_challenge, transaction_date=None, category=None, amount=None):
    """챌린지 progress 업데이트"""
    display_config = user_challenge.display_config or {}
    progress_type = display_config.get('progress_type', 'amount')
    success_conditions = user_challenge.success_conditions or {}
    condition_type = success_conditions.get('type', CONDITION_TYPE_AMOUNT_LIMIT)

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

    if success_conditions.get('type') == CONDITION_TYPE_AMOUNT_RANGE and target:
        tolerance_percent = success_conditions.get('tolerance_percent', 10)
        progress['lower_limit'] = int(target * (1 - tolerance_percent / 100))
        progress['upper_limit'] = int(target * (1 + tolerance_percent / 100))
    
    user_challenge.update_progress(progress)


def _update_zero_spend_progress(user_challenge, total_spent, success_conditions):
    """zero_spend 타입 progress 업데이트"""
    target_categories = success_conditions.get('categories', [])
    normalized_targets = _normalize_target_categories(target_categories)
    
    # 대상 카테고리 지출 합계
    violation_amount = 0
    if target_categories and 'all' not in target_categories:
        for log in user_challenge.daily_logs.all():
            for cat, amt in (log.spent_by_category or {}).items():
                if cat in normalized_targets:
                    violation_amount += amt
    else:
        violation_amount = total_spent

    elapsed_days = len(_iter_elapsed_dates(user_challenge))
    total_days = user_challenge.duration_days or 0
    percentage = round((elapsed_days / total_days) * 100, 1) if total_days > 0 else 0
    
    progress = {
        "type": "zero_spend",
        "current": violation_amount,
        "target_categories": target_categories,
        "is_violated": violation_amount > 0,
        "violation_amount": violation_amount,
        "is_on_track": violation_amount == 0,
        "elapsed_days": elapsed_days,
        "total_days": total_days,
        "percentage": min(100, percentage),
    }
    
    user_challenge.update_progress(progress)


def _update_compare_progress(user_challenge, total_spent, success_conditions):
    """compare 타입 progress 업데이트"""
    compare_type = success_conditions.get('compare_type', '')
    if compare_type == COMPARE_TYPE_NEXT_MONTH_CATEGORY:
        progress = _build_future_compare_progress(user_challenge, success_conditions)
        user_challenge.update_progress(progress)
        return

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


def _month_bounds(year: int, month: int):
    start = date(year, month, 1)
    end = date(year, month, monthrange(year, month)[1])
    return start, end


def _next_month(year: int, month: int):
    if month == 12:
        return year + 1, 1
    return year, month + 1


def _build_future_compare_progress(user_challenge, success_conditions):
    """
    미래의 나에게:
    - 시작 달: 이번 달 카테고리 지출 누적 표시
    - 다음 달: 다음 달/이번 달(기준) 비교 표시
    """
    target_category = user_challenge.user_input_values.get('target_category', '')
    now = timezone.now().date()
    started_at = user_challenge.started_at or timezone.now()
    start_year, start_month = started_at.year, started_at.month
    next_year, next_month = _next_month(start_year, start_month)

    start_month_start, start_month_end = _month_bounds(start_year, start_month)
    next_month_start, next_month_end = _month_bounds(next_year, next_month)

    this_month_until = min(now, start_month_end)
    this_month_spent = Transaction.objects.filter(
        user=user_challenge.user,
        category=target_category,
        date__date__gte=start_month_start,
        date__date__lte=this_month_until,
    ).aggregate(total=Sum('amount'))['total'] or 0

    this_month_final = this_month_spent
    if now > start_month_end:
        this_month_final = Transaction.objects.filter(
            user=user_challenge.user,
            category=target_category,
            date__date__gte=start_month_start,
            date__date__lte=start_month_end,
        ).aggregate(total=Sum('amount'))['total'] or 0

    phase = 'this_month'
    next_month_spent = 0
    if now >= next_month_start:
        phase = 'next_month'
        next_month_until = min(now, next_month_end)
        next_month_spent = Transaction.objects.filter(
            user=user_challenge.user,
            category=target_category,
            date__date__gte=next_month_start,
            date__date__lte=next_month_until,
        ).aggregate(total=Sum('amount'))['total'] or 0

    compare_base = this_month_final if phase == 'next_month' else this_month_spent
    current = next_month_spent if phase == 'next_month' else this_month_spent
    difference = current - compare_base
    percentage = round((current / compare_base) * 100, 1) if compare_base > 0 else 0

    if phase == 'next_month':
        is_on_track = current <= compare_base
    else:
        is_on_track = True

    ratio_percent = None
    if phase == 'next_month' and compare_base > 0:
        ratio_percent = round((next_month_spent / compare_base) * 100, 1)

    return {
        "type": "compare",
        "phase": phase,
        "current": current,
        "target": compare_base,
        "compare_base": compare_base,
        "compare_label": "이번 달 대비",
        "difference": difference,
        "percentage": percentage,
        "is_on_track": is_on_track,
        "this_month_spent": this_month_final if phase == 'next_month' else this_month_spent,
        "next_month_spent": next_month_spent,
        "ratio_percent": ratio_percent,
        "target_category": target_category,
        "start_month": f"{start_year:04d}-{start_month:02d}",
        "next_month": f"{next_year:04d}-{next_month:02d}",
    }


def _update_daily_check_progress(user_challenge):
    """daily_check 타입 progress 업데이트"""
    checked_count = 0
    daily_status = []

    for log in user_challenge.daily_logs.order_by('log_date'):
        has_spending_input = (log.transaction_count or 0) > 0
        is_done = bool(log.is_checked or has_spending_input)
        if is_done:
            checked_count += 1
        daily_status.append({
            "date": str(log.log_date),
            "checked": bool(log.is_checked),
            "has_spending_input": has_spending_input,
            "done": is_done,
            "amount": log.spent_amount
        })

    elapsed_days = len(_iter_elapsed_dates(user_challenge))
    total_days = user_challenge.duration_days
    denominator = max(1, min(total_days, elapsed_days)) if total_days > 0 else 1
    percentage = round((checked_count / denominator) * 100, 1) if denominator > 0 else 0
    
    progress = {
        "type": "daily_check",
        "checked_days": checked_count,
        "total_days": total_days,
        "elapsed_days": elapsed_days,
        "percentage": min(100, percentage),
        "daily_status": daily_status,
        "is_on_track": checked_count >= elapsed_days
    }
    
    user_challenge.update_progress(progress)


def _update_daily_rule_progress(user_challenge, success_conditions):
    """daily_rule 타입 progress 업데이트 (무00의 날)"""
    rules = success_conditions.get('daily_rules', {})

    passed_days = 0
    total_days = 0
    daily_status = []
    has_violation = False

    log_map = {
        log.log_date: log
        for log in user_challenge.daily_logs.all()
    }

    for current_date in _iter_elapsed_dates(user_challenge):
        weekday = current_date.strftime('%a').lower()
        forbidden_category = rules.get(weekday)
        if forbidden_category:
            log = log_map.get(current_date)
            total_days += 1
            category_spent = (log.spent_by_category or {}).get(forbidden_category, 0) if log else 0
            passed = category_spent == 0

            if passed:
                passed_days += 1
            else:
                has_violation = True

            daily_status.append({
                "date": str(current_date),
                "weekday": weekday,
                "forbidden": forbidden_category,
                "spent": category_spent,
                "passed": passed
            })

    percentage = round((passed_days / total_days) * 100, 1) if total_days > 0 else 0

    progress = {
        "type": "daily_rule",
        "daily_status": daily_status,
        "passed_days": passed_days,
        "total_days": total_days,
        "percentage": min(100, percentage),
        "is_on_track": not has_violation,
        "has_violation": has_violation,
        "daily_rules": rules,
    }

    user_challenge.update_progress(progress)


def _check_auto_judgement(user_challenge, transaction_date=None, category=None, amount=None, store=None):
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
        failure_reason = None if is_success else infer_failure_reason(user_challenge, final_spent=final_spent)
        user_challenge.complete_challenge(is_success, final_spent, failure_reason=failure_reason)
        return

    # 챌린지 유형별 즉시 실패 조건 확인
    condition_type = success_conditions.get('type', CONDITION_TYPE_AMOUNT_LIMIT)

    # 딕셔너리에서 핸들러 조회 후 실행
    handler = IMMEDIATE_FAILURE_HANDLERS.get(condition_type)
    if handler:
        handler(user_challenge, progress, success_conditions, transaction_date, category, store)


# ============================================================
# 즉시 실패 조건 체크 핸들러 함수들
# ============================================================

def _check_amount_limit_failure(user_challenge, progress, success_conditions, transaction_date=None, category=None, store=None):
    """amount_limit 타입 즉시 실패 체크 (예: 3만원의 행복)"""
    target = int(success_conditions.get('target_amount', 0))
    current = progress.get('current', 0)
    
    if target > 0:
        # 목표 금액이 있는 경우: 초과 시 즉시 실패
        if current > target:
            user_challenge.complete_challenge(
                False,
                current,
                failure_reason=reason_amount_exceeded(target, current),
            )
    else:
        # 목표 금액이 0인 경우 (무지출 챌린지): 지출 발생 시 즉시 실패
        if current > 0:
            user_challenge.complete_challenge(
                False,
                current,
                failure_reason=reason_zero_spend_violation(),
            )


def _check_compare_failure(user_challenge, progress, success_conditions, transaction_date=None, category=None, store=None):
    """compare 타입 즉시 실패 체크 (예: 나와의 싸움, 고정비 다이어트)"""
    compare_type = success_conditions.get('compare_type', '')
    compare_base = int(success_conditions.get('compare_base', 0))
    current = progress.get('current', 0)

    if compare_type == COMPARE_TYPE_LAST_MONTH_WEEK:
        # 지난달 주차 지출보다 초과하면 즉시 실패
        if current > compare_base:
            user_challenge.complete_challenge(
                False,
                current,
                failure_reason=reason_compare_exceeded(compare_base, current, compare_type),
            )
    elif compare_type == COMPARE_TYPE_FIXED_EXPENSE:
        # 고정비 다이어트 - 이번주 고정비 >= 이전 고정비면 즉시 실패
        if current >= compare_base and current > 0:
            user_challenge.complete_challenge(
                False,
                current,
                failure_reason=reason_compare_exceeded(compare_base, current, compare_type),
            )
    elif compare_type == COMPARE_TYPE_NEXT_MONTH_CATEGORY:
        # 미래의 나에게 - (a+1)달 카테고리 지출이 a달 초과 시 즉시 실패
        if progress.get('phase') == 'next_month' and current > compare_base:
            user_challenge.complete_challenge(
                False,
                current,
                failure_reason=reason_compare_exceeded(compare_base, current, compare_type),
            )


def _check_zero_spend_failure(user_challenge, progress, success_conditions, transaction_date=None, category=None, store=None):
    """zero_spend 타입 즉시 실패 체크 (예: 3일 연속 무지출, 외식/배달 X)"""
    if progress.get('is_violated', False):
        user_challenge.complete_challenge(
            False,
            progress.get('violation_amount', 0),
            failure_reason=reason_zero_spend_violation(),
        )


def _check_amount_limit_with_photo_failure(user_challenge, progress, success_conditions, transaction_date=None, category=None, store=None):
    """amount_limit_with_photo 타입 즉시 실패 체크 (예: 현금 챌린지)"""
    target = user_challenge.user_input_values.get('target_amount', 0)
    if target:
        target = int(target)
        current = progress.get('current', 0)
        if current > target:
            user_challenge.complete_challenge(
                False,
                current,
                failure_reason=reason_amount_exceeded(target, current),
            )
            return

    # 하루라도 사진 미인증 시 즉시 실패 (전날까지 체크)
    if transaction_date:
        _check_photo_missing_failure(user_challenge, transaction_date)


def _check_photo_verification_failure(user_challenge, progress, success_conditions, transaction_date=None, category=None, store=None):
    """photo_verification 타입 즉시 실패 체크 (예: 원플원 러버)"""
    photo_condition = success_conditions.get('photo_condition', '')
    if '1+1' in photo_condition:
        # 편의점 지출이 있으면 당일 사진 인증 체크
        if _contains_convenience_store_keyword(store or ""):
            _check_one_plus_one_failure(user_challenge, transaction_date)


def _check_amount_range_failure(user_challenge, progress, success_conditions, transaction_date=None, category=None, store=None):
    """amount_range 타입 즉시 실패 체크 (예: 내 소비 맞추기)"""
    target = user_challenge.user_input_values.get('target_amount', 0)
    if target:
        target = int(target)
        tolerance_percent = success_conditions.get('tolerance_percent', 10)
        upper_limit = target * (1 + tolerance_percent / 100)
        current = progress.get('current', 0)
        if current > upper_limit:
            user_challenge.complete_challenge(
                False,
                current,
                failure_reason=reason_amount_range_exceeded(target, tolerance_percent, current),
            )


def _check_daily_rule_failure(user_challenge, progress, success_conditions, transaction_date=None, category=None, store=None):
    """daily_rule 타입 즉시 실패 체크 (예: 무00의 날)"""
    if progress.get('has_violation', False):
        user_challenge.complete_challenge(
            False,
            progress.get('current', 0),
            failure_reason=reason_daily_rule_violation(),
        )


def _check_random_budget_failure(user_challenge, progress, success_conditions, transaction_date=None, category=None, store=None):
    """random_budget 타입 즉시 실패 체크 (예: 두근두근 데스게임)"""
    random_budget = user_challenge.system_generated_values.get('random_budget', 0)
    if random_budget:
        random_budget = int(random_budget)
        current = progress.get('current', 0)
        if current > random_budget:
            user_challenge.complete_challenge(
                False,
                current,
                failure_reason=reason_random_budget_exceeded(random_budget, current),
            )


def _check_custom_failure(user_challenge, progress, success_conditions, transaction_date=None, category=None, store=None):
    """custom 타입 즉시 실패 체크 (AI/커스텀 챌린지)"""
    target = int(success_conditions.get('target_amount', 0))
    current = progress.get('current', 0)
    
    if target > 0:
        # 목표 금액이 있는 경우: 초과 시 즉시 실패
        if current > target:
            user_challenge.complete_challenge(
                False,
                current,
                failure_reason=reason_amount_exceeded(target, current),
            )
    else:
        # 목표 금액이 0인 경우 (zero_spend 스타일): 지출 발생 시 즉시 실패
        if progress.get('is_violated', False) or current > 0:
            user_challenge.complete_challenge(
                False,
                current,
                failure_reason=reason_zero_spend_violation(),
            )


# condition_type별 즉시 실패 체크 핸들러 매핑
IMMEDIATE_FAILURE_HANDLERS = {
    CONDITION_TYPE_AMOUNT_LIMIT: _check_amount_limit_failure,
    CONDITION_TYPE_COMPARE: _check_compare_failure,
    CONDITION_TYPE_ZERO_SPEND: _check_zero_spend_failure,
    CONDITION_TYPE_AMOUNT_LIMIT_WITH_PHOTO: _check_amount_limit_with_photo_failure,
    CONDITION_TYPE_PHOTO_VERIFICATION: _check_photo_verification_failure,
    CONDITION_TYPE_AMOUNT_RANGE: _check_amount_range_failure,
    CONDITION_TYPE_DAILY_RULE: _check_daily_rule_failure,
    CONDITION_TYPE_RANDOM_BUDGET: None,
    CONDITION_TYPE_CUSTOM: _check_custom_failure,
    CONDITION_TYPE_DAILY_CHECK: None,
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
            if not log or _count_verified_photos(log) == 0:
                user_challenge.complete_challenge(
                    False,
                    user_challenge.progress.get('current', 0),
                    failure_reason=reason_photo_not_verified_yesterday(),
                )
                return
            date_iter += timedelta(days=1)


def _check_one_plus_one_failure(user_challenge, transaction_date):
    """원플원 러버: 편의점 지출 당일 1+1 미인증 체크"""
    if not transaction_date:
        return

    # 전날까지의 편의점 지출에 대해 사진 인증 확인
    start_date = user_challenge.started_at.date()
    yesterday = transaction_date - timedelta(days=1)

    if yesterday >= start_date:
        for log in user_challenge.daily_logs.filter(log_date__gte=start_date, log_date__lte=yesterday):
            convenience_spent = _sum_convenience_spending(log)
            if convenience_spent > 0:
                # 편의점 지출이 있는데 사진 인증이 없으면 실패
                if _count_verified_photos(log) == 0:
                    user_challenge.complete_challenge(
                        False,
                        user_challenge.progress.get('current', 0),
                        failure_reason=reason_one_plus_one_photo_missing(),
                    )
                    return


def _update_photo_progress(user_challenge, success_conditions):
    """photo 타입 progress 업데이트"""
    total_photos = 0
    photos = []

    for log in user_challenge.daily_logs.order_by('log_date'):
        for photo in (log.photo_urls or []):
            if not photo.get("verified", False):
                continue
            total_photos += 1
            photos.append({
                "date": str(log.log_date),
                "url": photo.get('url'),
                "verified": True
            })

    photo_condition = success_conditions.get('photo_condition', '')
    mode = user_challenge.photo_frequency or 'once'
    required_count = success_conditions.get('required_photos', 1)

    if user_challenge.photo_frequency == 'daily':
        required_count = user_challenge.duration_days
        percentage = round((total_photos / required_count) * 100, 1) if required_count > 0 else 0
    elif '중고 거래' in photo_condition:
        elapsed_days = len(_iter_elapsed_dates(user_challenge))
        total_days = user_challenge.duration_days or 1
        percentage = round((elapsed_days / total_days) * 100, 1)
    elif user_challenge.photo_frequency == 'on_purchase':
        convenience_days = 0
        for log in user_challenge.daily_logs.all():
            if _sum_convenience_spending(log) > 0:
                convenience_days += 1
        required_count = convenience_days
        if required_count > 0:
            percentage = round((total_photos / required_count) * 100, 1)
        else:
            percentage = 0
    else:
        percentage = round((total_photos / required_count) * 100, 1) if required_count > 0 else 0

    progress = {
        "type": "photo",
        "photo_count": total_photos,
        "required_count": required_count,
        "percentage": min(100, percentage),
        "photos": photos,
        "is_on_track": (total_photos > 0) or (mode == 'on_purchase' and required_count == 0),
        "mode": mode,
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
        "difference_percent": round(difference_percent, 1),
        "mask_target": user_challenge.status == 'active',
    }

    user_challenge.update_progress(progress)


def _evaluate_success(user_challenge, progress, success_conditions):
    """성공 여부 평가"""
    condition_type = success_conditions.get('type', CONDITION_TYPE_AMOUNT_LIMIT)
    comparison = success_conditions.get('comparison', 'lte')

    if condition_type == CONDITION_TYPE_AMOUNT_LIMIT:
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

    elif condition_type == CONDITION_TYPE_AMOUNT_LIMIT_WITH_PHOTO:
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
            if not log or _count_verified_photos(log) == 0:
                return False
            date_iter += timedelta(days=1)
        return True

    elif condition_type == CONDITION_TYPE_ZERO_SPEND:
        return not progress.get('is_violated', False)

    elif condition_type == CONDITION_TYPE_DAILY_CHECK:
        required_days = success_conditions.get('required_days', user_challenge.duration_days)
        checked_days = progress.get('checked_days', 0)
        return checked_days >= required_days

    elif condition_type == CONDITION_TYPE_PHOTO_VERIFICATION:
        photo_condition = success_conditions.get('photo_condition', '')
        if '1+1' in photo_condition:
            for log in user_challenge.daily_logs.all():
                if _sum_convenience_spending(log) > 0 and _count_verified_photos(log) == 0:
                    return False
            return True
        required_count = success_conditions.get('required_photos', 1)
        photo_count = progress.get('photo_count', 0)
        return photo_count >= required_count

    elif condition_type == CONDITION_TYPE_COMPARE:
        if success_conditions.get('compare_type') == COMPARE_TYPE_NEXT_MONTH_CATEGORY:
            if progress.get('phase') != 'next_month':
                return False
            return progress.get('current', 0) <= progress.get('compare_base', 0)
        return progress.get('is_on_track', False)

    elif condition_type == CONDITION_TYPE_DAILY_RULE:
        return progress.get('is_on_track', False)

    elif condition_type == CONDITION_TYPE_AMOUNT_RANGE:
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

    elif condition_type == CONDITION_TYPE_RANDOM_BUDGET:
        return progress.get('is_on_track', False)

    return progress.get('is_on_track', False)

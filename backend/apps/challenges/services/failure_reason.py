from apps.challenges.constants import (
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


def _to_int(value, default=0):
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def reason_photo_not_verified_yesterday():
    return "어제 사진 인증을 하지 않았습니다."


def reason_daily_check_missing():
    return "어제 지출 입력 또는 무지출 체크를 하지 않았습니다."


def reason_one_plus_one_photo_missing():
    return "편의점 지출이 있었지만 사진 인증을 하지 않았습니다."


def reason_amount_exceeded(target_amount, current_amount=None):
    target = _to_int(target_amount)
    current = _to_int(current_amount)
    if target <= 0:
        return "지출이 발생하여 실패했습니다."
    if current > 0:
        return f"{target:,}원을 초과하였습니다. 현재 지출은 {current:,}원입니다."
    return f"{target:,}원을 초과하였습니다."


def reason_compare_exceeded(compare_base, current_amount=None, compare_type=None):
    base = _to_int(compare_base)
    current = _to_int(current_amount)
    compare_label = "비교 기준"
    if compare_type == COMPARE_TYPE_LAST_MONTH_WEEK:
        compare_label = "지난달 선택 주차 지출"
    elif compare_type == COMPARE_TYPE_FIXED_EXPENSE:
        compare_label = "이전 고정비"
    elif compare_type == COMPARE_TYPE_NEXT_MONTH_CATEGORY:
        compare_label = "기준 월 카테고리 지출"

    return f"{compare_label} {base:,}원을 초과했습니다. 현재 지출은 {current:,}원입니다."


def reason_zero_spend_violation():
    return "지출이 발생하여 무지출 조건을 지키지 못했습니다."


def reason_amount_range_exceeded(target_amount, tolerance_percent=10, current_amount=None):
    target = _to_int(target_amount)
    tolerance = _to_int(tolerance_percent, 10)
    upper_limit = int(target * (1 + (tolerance / 100)))
    current = _to_int(current_amount)
    return (
        f"허용 상한 {upper_limit:,}원을 초과했습니다. "
        f"목표 금액은 {target:,}원, 현재 지출은 {current:,}원입니다."
    )


def reason_daily_rule_violation():
    return "요일별 금지 카테고리 지출이 발생했습니다."


def reason_random_budget_exceeded(random_budget, current_amount=None):
    budget = _to_int(random_budget)
    current = _to_int(current_amount)
    if budget <= 0:
        return "숨겨진 예산 조건을 충족하지 못했습니다."
    return f"숨겨진 예산 {budget:,}원을 초과했습니다. 현재 지출은 {current:,}원입니다."


def reason_generic_failure():
    return "성공 조건을 충족하지 못했습니다. 챌린지 상세에서 진행 내역을 확인해주세요."


def infer_failure_reason(user_challenge, final_spent=None):
    success_conditions = user_challenge.success_conditions or {}
    progress = user_challenge.progress or {}
    condition_type = success_conditions.get("type")
    current = _to_int(final_spent if final_spent is not None else progress.get("current", 0))

    if condition_type in (CONDITION_TYPE_AMOUNT_LIMIT, CONDITION_TYPE_CUSTOM):
        target = success_conditions.get("target_amount")
        if target is None:
            target = user_challenge.user_input_values.get("target_amount")
        return reason_amount_exceeded(target, current)

    if condition_type == CONDITION_TYPE_COMPARE:
        return reason_compare_exceeded(
            compare_base=success_conditions.get("compare_base", progress.get("compare_base", 0)),
            current_amount=current,
            compare_type=success_conditions.get("compare_type"),
        )

    if condition_type == CONDITION_TYPE_ZERO_SPEND:
        return reason_zero_spend_violation()

    if condition_type == CONDITION_TYPE_AMOUNT_LIMIT_WITH_PHOTO:
        target = user_challenge.user_input_values.get("target_amount")
        if _to_int(target) > 0 and current > _to_int(target):
            return reason_amount_exceeded(target, current)
        return reason_photo_not_verified_yesterday()

    if condition_type == CONDITION_TYPE_PHOTO_VERIFICATION:
        return reason_one_plus_one_photo_missing()

    if condition_type == CONDITION_TYPE_AMOUNT_RANGE:
        target = user_challenge.user_input_values.get("target_amount")
        tolerance = success_conditions.get("tolerance_percent", 10)
        return reason_amount_range_exceeded(target, tolerance, current)

    if condition_type == CONDITION_TYPE_DAILY_RULE:
        return reason_daily_rule_violation()

    if condition_type == CONDITION_TYPE_DAILY_CHECK:
        return reason_daily_check_missing()

    if condition_type == CONDITION_TYPE_RANDOM_BUDGET:
        return reason_random_budget_exceeded(
            user_challenge.system_generated_values.get("random_budget"),
            current,
        )

    return reason_generic_failure()

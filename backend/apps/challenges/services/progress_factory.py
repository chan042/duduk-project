import random

from apps.challenges.constants import (
    COMPARE_TYPE_NEXT_MONTH_CATEGORY,
    CONDITION_TYPE_AMOUNT_RANGE,
)


def build_initial_progress(
    *,
    progress_type,
    duration_days,
    success_conditions=None,
    user_input_values=None,
    photo_frequency=None,
    compare_base=0,
    random_budget=None,
):
    success_conditions = success_conditions or {}
    user_input_values = user_input_values or {}
    duration_days = int(duration_days or 0)

    if progress_type == "amount":
        target = user_input_values.get("target_amount") or success_conditions.get("target_amount", 0)
        progress = {
            "type": "amount",
            "current": 0,
            "target": target,
            "percentage": 0,
            "is_on_track": True,
            "remaining": target,
        }
        if success_conditions.get("type") == CONDITION_TYPE_AMOUNT_RANGE and target:
            tolerance_percent = success_conditions.get("tolerance_percent", 10)
            progress["lower_limit"] = int(target * (1 - tolerance_percent / 100))
            progress["upper_limit"] = int(target * (1 + tolerance_percent / 100))
        return progress

    if progress_type == "zero_spend":
        return {
            "type": "zero_spend",
            "current": 0,
            "target_categories": success_conditions.get("categories", []),
            "is_violated": False,
            "violation_amount": 0,
            "is_on_track": True,
            "elapsed_days": 0,
            "total_days": duration_days,
            "percentage": 0,
        }

    if progress_type == "daily_check":
        return {
            "type": "daily_check",
            "checked_days": 0,
            "total_days": duration_days,
            "percentage": 0,
            "daily_status": [],
            "is_on_track": True,
        }

    if progress_type == "photo":
        mode = photo_frequency or "once"
        required_count = duration_days if photo_frequency == "daily" else 1
        if mode == "on_purchase":
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

    if progress_type == "compare":
        progress = {
            "type": "compare",
            "current": 0,
            "compare_base": compare_base,
            "target": compare_base,
            "compare_label": success_conditions.get("compare_label", "비교 기준"),
            "difference": 0,
            "percentage": 0,
            "is_on_track": True,
        }
        if success_conditions.get("compare_type") == COMPARE_TYPE_NEXT_MONTH_CATEGORY:
            progress.update(
                {
                    "phase": "this_month",
                    "this_month_spent": compare_base,
                    "next_month_spent": 0,
                }
            )
        return progress

    if progress_type == "daily_rule":
        return {
            "type": "daily_rule",
            "daily_status": [],
            "passed_days": 0,
            "total_days": duration_days,
            "is_on_track": True,
            "has_violation": False,
            "daily_rules": success_conditions.get("daily_rules", {}),
            "percentage": 0,
        }

    if progress_type == "random_budget":
        budget = int(random_budget or random.randint(30000, 100000))
        return {
            "type": "random_budget",
            "current": 0,
            "target": budget,
            "percentage": 0,
            "is_on_track": True,
            "remaining": budget,
            "potential_points": int(budget * 0.08),
            "jackpot_eligible": False,
            "difference_percent": 100,
            "mask_target": True,
        }

    return {"type": progress_type, "is_on_track": True}


def build_initial_progress_for_template(
    template,
    *,
    user_input_values=None,
    success_conditions=None,
    compare_base=0,
    random_budget=None,
):
    display_config = template.display_config or {}
    return build_initial_progress(
        progress_type=display_config.get("progress_type", "amount"),
        duration_days=template.duration_days,
        success_conditions=success_conditions or template.success_conditions,
        user_input_values=user_input_values or {},
        photo_frequency=template.photo_frequency,
        compare_base=compare_base,
        random_budget=random_budget,
    )


def build_initial_progress_for_user_challenge(user_challenge, *, random_budget=None):
    display_config = user_challenge.display_config or {}
    success_conditions = user_challenge.success_conditions or {}
    system_generated_values = user_challenge.system_generated_values or {}

    return build_initial_progress(
        progress_type=display_config.get("progress_type", "amount"),
        duration_days=user_challenge.duration_days,
        success_conditions=success_conditions,
        user_input_values=user_challenge.user_input_values or {},
        photo_frequency=user_challenge.photo_frequency,
        compare_base=success_conditions.get("compare_base", 0),
        random_budget=random_budget or system_generated_values.get("random_budget"),
    )

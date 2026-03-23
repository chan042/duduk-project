from apps.challenges.constants import CONDITION_TYPE_DAILY_CHECK
from apps.challenges.models import UserChallenge
from apps.challenges.services.daily_check_sync import (
    ensure_daily_check_logs,
    sync_daily_check_logs_from_confirmations,
)
from apps.challenges.services.failure_reason import infer_failure_reason
from apps.challenges.services.lifecycle import (
    get_challenge_end_date,
    get_challenge_start_date,
    has_challenge_started,
    is_challenge_expired,
    resolve_reference_date,
)


def finalize_expired_challenge(user_challenge, reference=None, dry_run=False):
    if getattr(user_challenge, "status", None) != "active":
        return False

    if not is_challenge_expired(user_challenge, reference):
        return False

    if dry_run:
        return True

    success_conditions = user_challenge.success_conditions or {}
    from apps.challenges.signals import _evaluate_success, _update_challenge_progress

    if success_conditions.get("type") == CONDITION_TYPE_DAILY_CHECK:
        start_date = get_challenge_start_date(user_challenge)
        end_date = get_challenge_end_date(user_challenge)
        if start_date and end_date:
            ensure_daily_check_logs(user_challenge, end_date)
            sync_daily_check_logs_from_confirmations(user_challenge, start_date, end_date)

    _update_challenge_progress(user_challenge)

    if user_challenge.status != "active":
        return True

    progress = user_challenge.progress or {}
    is_success = _evaluate_success(user_challenge, progress, success_conditions)
    final_spent = progress.get("current", 0)
    failure_reason = None if is_success else infer_failure_reason(user_challenge, final_spent=final_spent)
    user_challenge.complete_challenge(is_success, final_spent, failure_reason=failure_reason)

    return True


def activate_started_ready_challenges_for_user(user, reference=None, dry_run=False):
    today = resolve_reference_date(reference)
    ready_challenges = UserChallenge.objects.filter(user=user, status="ready").select_related("user")

    ready_ids = [
        user_challenge.pk
        for user_challenge in ready_challenges
        if has_challenge_started(user_challenge, today)
    ]
    if ready_ids and not dry_run:
        UserChallenge.objects.filter(pk__in=ready_ids).update(status="active")

    return len(ready_ids)


def finalize_expired_challenges_for_user(user, reference=None, dry_run=False):
    today = resolve_reference_date(reference)
    active_challenges = UserChallenge.objects.filter(user=user, status="active").select_related("user")

    finalized_count = 0
    for user_challenge in active_challenges:
        if finalize_expired_challenge(user_challenge, reference=today, dry_run=dry_run):
            finalized_count += 1

    return finalized_count


def refresh_user_challenge_states(user, reference=None, dry_run=False):
    today = resolve_reference_date(reference)
    activated_count = activate_started_ready_challenges_for_user(user, reference=today, dry_run=dry_run)
    finalized_count = finalize_expired_challenges_for_user(user, reference=today, dry_run=dry_run)
    return {
        "activated": activated_count,
        "finalized": finalized_count,
    }

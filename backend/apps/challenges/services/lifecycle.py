from datetime import date, datetime, time, timedelta

from django.utils import timezone

from apps.challenges.constants import COMPARE_TYPE_LAST_MONTH_WEEK


def get_local_date(value):
    if value is None:
        return None

    if isinstance(value, datetime):
        if timezone.is_aware(value):
            return timezone.localtime(value).date()
        return value.date()

    if isinstance(value, date):
        return value

    raise TypeError(f"Unsupported date value type: {type(value)!r}")


def resolve_reference_date(reference=None):
    if reference is None:
        return timezone.localdate()

    return get_local_date(reference)


def get_challenge_start_date(user_challenge):
    started_at = getattr(user_challenge, "started_at", None)
    if not started_at:
        return None
    return get_local_date(started_at)


def resolve_challenge_start_at(success_conditions=None, reference=None):
    reference_dt = reference or timezone.now()
    if timezone.is_naive(reference_dt):
        reference_dt = timezone.make_aware(reference_dt, timezone.get_current_timezone())

    compare_type = (success_conditions or {}).get("compare_type")
    if compare_type != COMPARE_TYPE_LAST_MONTH_WEEK:
        return reference_dt

    weekday = reference_dt.weekday()
    days_until_monday = (7 - weekday) % 7
    if days_until_monday == 0:
        return reference_dt

    start_date = (reference_dt + timedelta(days=days_until_monday)).date()
    return timezone.make_aware(
        datetime.combine(start_date, time.min),
        timezone.get_current_timezone(),
    )


def get_challenge_end_date(user_challenge):
    start_date = get_challenge_start_date(user_challenge)
    duration_days = int(getattr(user_challenge, "duration_days", 0) or 0)

    if start_date and duration_days > 0:
        return start_date + timedelta(days=duration_days - 1)

    ends_at = getattr(user_challenge, "ends_at", None)
    if not ends_at:
        return None
    return get_local_date(ends_at)


def has_challenge_started(user_challenge, reference=None):
    start_date = get_challenge_start_date(user_challenge)
    if start_date is None:
        return False
    return resolve_reference_date(reference) >= start_date


def is_challenge_expired(user_challenge, reference=None):
    end_date = get_challenge_end_date(user_challenge)
    if end_date is None:
        return False
    return resolve_reference_date(reference) > end_date


def get_remaining_days(user_challenge, reference=None):
    start_date = get_challenge_start_date(user_challenge)
    end_date = get_challenge_end_date(user_challenge)
    duration_days = int(getattr(user_challenge, "duration_days", 0) or 0)

    if start_date is None or end_date is None:
        return max(0, duration_days)

    today = resolve_reference_date(reference)

    if today < start_date:
        return max(0, duration_days)

    if today > end_date:
        return 0

    return (end_date - today).days + 1

from django.utils import timezone

from apps.challenges.constants import CONDITION_TYPE_DAILY_CHECK
from apps.challenges.models import UserChallenge, ChallengeDailyLog
from apps.transactions.models import DailySpendingConfirmation


def _get_daily_check_challenges_for_date(user, target_date):
    return UserChallenge.objects.filter(
        user=user,
        status__in=["active", "ready"],
        started_at__date__lte=target_date,
        ends_at__date__gte=target_date,
        success_conditions__type=CONDITION_TYPE_DAILY_CHECK,
    )


def sync_daily_check_log_with_confirmation(user, target_date, is_no_spending):
    """
    무지출 확인 변경사항을 특정 날짜의 daily_check 로그에 반영한다.
    """
    for challenge in _get_daily_check_challenges_for_date(user, target_date):
        log, _ = ChallengeDailyLog.objects.get_or_create(
            user_challenge=challenge,
            log_date=target_date,
            defaults={
                "spent_amount": 0,
                "transaction_count": 0,
                "spent_by_category": {},
            },
        )

        if is_no_spending:
            if not log.is_checked:
                log.is_checked = True
                log.checked_at = timezone.now()
                log.save(update_fields=["is_checked", "checked_at", "updated_at"])
            continue

        if log.is_checked and (log.transaction_count or 0) == 0:
            log.is_checked = False
            log.checked_at = None
            log.save(update_fields=["is_checked", "checked_at", "updated_at"])


def sync_daily_check_logs_from_confirmations(user_challenge, start_date, end_date):
    """
    기간 내 무지출 확인 데이터와 daily_check 로그를 동기화한다.
    - 거래가 있는 날은 is_checked를 덮어쓰지 않는다.
    """
    if end_date < start_date:
        return

    confirmed_dates = set(
        DailySpendingConfirmation.objects.filter(
            user=user_challenge.user,
            is_no_spending=True,
            date__gte=start_date,
            date__lte=end_date,
        ).values_list("date", flat=True)
    )

    if not confirmed_dates:
        user_challenge.daily_logs.filter(
            log_date__gte=start_date,
            log_date__lte=end_date,
            transaction_count=0,
            is_checked=True,
        ).update(is_checked=False, checked_at=None, updated_at=timezone.now())
        return

    now = timezone.now()
    user_challenge.daily_logs.filter(
        log_date__in=confirmed_dates,
        transaction_count=0,
        is_checked=False,
    ).update(is_checked=True, checked_at=now, updated_at=now)

    user_challenge.daily_logs.filter(
        log_date__gte=start_date,
        log_date__lte=end_date,
        transaction_count=0,
        is_checked=True,
    ).exclude(log_date__in=confirmed_dates).update(
        is_checked=False,
        checked_at=None,
        updated_at=timezone.now(),
    )


def is_no_spending_confirmed(user_id, check_date):
    return DailySpendingConfirmation.objects.filter(
        user_id=user_id,
        date=check_date,
        is_no_spending=True,
    ).exists()

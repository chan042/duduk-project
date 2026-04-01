from calendar import monthrange
from datetime import date, datetime

from django.utils import timezone


def get_previous_month(year, month):
    if month == 1:
        return year - 1, 12
    return year, month - 1


def get_next_month(year, month):
    if month == 12:
        return year + 1, 1
    return year, month + 1


def get_last_day_of_month(year, month):
    return monthrange(year, month)[1]


def get_month_date_bounds(year, month):
    return date(year, month, 1), date(year, month, get_last_day_of_month(year, month))


def get_month_datetime_range(year, month, tzinfo=None):
    tzinfo = tzinfo or timezone.get_current_timezone()
    next_year, next_month = get_next_month(year, month)
    start = timezone.make_aware(datetime(year, month, 1), tzinfo)
    end = timezone.make_aware(datetime(next_year, next_month, 1), tzinfo)
    return start, end


def get_month_end_datetime(year, month, tzinfo=None):
    tzinfo = tzinfo or timezone.get_current_timezone()
    return timezone.make_aware(
        datetime(year, month, get_last_day_of_month(year, month), 23, 59, 59),
        tzinfo,
    )

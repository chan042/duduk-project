from django.utils import timezone
from collections import defaultdict
from datetime import timedelta, datetime
import calendar
from .models import MonthlyLog, DailyBudgetSnapshot, DailySpendingConfirmation

def get_daily_status(user, year, month, transactions):
    """
    Transactions 쿼리셋을 받아 일별 지출 상태 및 통계를 계산하여 반환
    - 지출 내역이 없는 날은 무지출 확인 여부에 따라 상태 표시
    """
    daily_stats = defaultdict(int)

    for t in transactions:
        local_date = timezone.localtime(t.date).date()
        date_str = local_date.strftime('%Y-%m-%d')
        daily_stats[date_str] += t.amount

    # 무지출 확인 날짜 조회
    confirmations = DailySpendingConfirmation.objects.filter(
        user=user, date__year=year, date__month=month, is_no_spending=True
    ).values_list('date', flat=True)
    confirmed_dates = set(d.strftime('%Y-%m-%d') for d in confirmations)

    # 두둑 상태 계산
    daily_status_data = {}
    
    today = timezone.localdate()
    target_year = int(year) if year else today.year
    target_month = int(month) if month else today.month
    
    # 해당 월의 마지막 날짜 구하기
    _, last_day = calendar.monthrange(target_year, target_month)
    
    # 1일부터 말일까지 순회하며 상태 계산
    for day in range(1, last_day + 1):
        # 날짜 객체 생성
        current_date = datetime(target_year, target_month, day).date()
        date_str = current_date.strftime('%Y-%m-%d')
        
        # 미래 날짜는 상태 계산 안함
        if current_date > today:
            continue
        
        # 지출액
        total_spent = daily_stats.get(date_str, 0)
        
        # 지출이 없는 경우
        if total_spent == 0:
            # 무지출 확인된 경우에만 상태 표시
            if date_str in confirmed_dates:
                daily_budget = get_daily_budget_for_date(user, current_date)
                daily_status_data[date_str] = {
                    "total_spent": 0,
                    "status": "money",
                    "daily_budget": daily_budget
                }
            # 확인되지 않은 경우 상태 표시X
            continue
        
        # 해당 날짜의 일일 권장 예산 가져오기
        daily_budget = get_daily_budget_for_date(user, current_date)
        
        # 상태 계산 로직
        status_value = 'money'
        
        if daily_budget <= 0:
            status_value = 'angry' if total_spent > 0 else 'money'
        else:
            ratio = total_spent / daily_budget
            if ratio <= 0.5:
                status_value = 'money'
            elif ratio <= 1.0:
                status_value = 'happy'
            elif ratio <= 1.5:
                status_value = 'sad'
            else:
                status_value = 'angry'
                
        daily_status_data[date_str] = {
            "total_spent": total_spent,
            "status": status_value,
            "daily_budget": daily_budget
        }

    # 오늘 날짜 예산 또는 조회 월의 예산을 반환
    representative_daily_budget = 0
    if target_year == today.year and target_month == today.month:
        representative_daily_budget = get_daily_budget_for_date(user, today)
    else:
        monthly_budget_val = 0 
        is_past = (target_year < today.year) or (target_year == today.year and target_month < today.month)
        if is_past:
            try:
                log = MonthlyLog.objects.get(user=user, year=target_year, month=target_month)
                monthly_budget_val = log.monthly_budget
            except MonthlyLog.DoesNotExist:
                monthly_budget_val = user.monthly_budget if user.monthly_budget else 0
        else:
            monthly_budget_val = user.monthly_budget if user.monthly_budget else 0
            
        total_spent_month = sum(daily_stats.values())
        
        # 오늘 날짜의 지출 금액 추출
        today_str = today.strftime('%Y-%m-%d')
        today_spent_amount = daily_stats.get(today_str, 0)
        
        representative_daily_budget = calculate_target_daily_budget(
            monthly_budget_val, target_year, target_month, total_spent_month, today_spent_amount
        )

    return daily_status_data, representative_daily_budget


def ensure_today_snapshot(user):
    """
    오늘 날짜의 일일 권장 예산 스냅샷이 없으면 생성
    """
    today = timezone.localdate()
    # 이미 존재하면 패스
    if DailyBudgetSnapshot.objects.filter(user=user, date=today).exists():
        return
    
    create_daily_budget_snapshot(user, today)


def create_daily_budget_snapshot(user, target_date):
    """
    특정 날짜의 일일 권장 예산 스냅샷 생성 및 저장
    해당 날짜 기준으로 이전까지의 지출만 계산
    """
    year = target_date.year
    month = target_date.month
    today = timezone.localdate()
    
    monthly_budget = 0
    # 과거/현재 판단
    is_past = (year < today.year) or (year == today.year and month < today.month)
    
    if is_past:
        try:
            log = MonthlyLog.objects.get(user=user, year=year, month=month)
            monthly_budget = log.monthly_budget
        except MonthlyLog.DoesNotExist:
            monthly_budget = user.monthly_budget if user.monthly_budget else 0
    else:
        monthly_budget = user.monthly_budget if user.monthly_budget else 0
        

    # 해당 날짜 이전까지의 지출 계산 (그 날 기준)
    from .models import Transaction
    range_start = datetime(year, month, 1).date()
    
    # 1. 어제까지의 지출 (권장 예산 계산용)
    transactions_yesterday = Transaction.objects.filter(
        user=user, 
        date__date__gte=range_start,
        date__date__lt=target_date
    )
    spent_until_yesterday = sum(t.amount for t in transactions_yesterday)

    # 2. 오늘(target_date) 지출 (초과 여부 확인용)
    transactions_today = Transaction.objects.filter(
        user=user,
        date__date=target_date
    )
    spent_today = sum(t.amount for t in transactions_today)
    
    # 남은 일수 (해당 날짜 포함)
    _, last_day_of_month = calendar.monthrange(year, month)
    remaining_days = last_day_of_month - target_date.day + 1
    if remaining_days < 1: remaining_days = 1
    
    # 하이브리드 계산 로직
    total_spent_including_today = spent_until_yesterday + spent_today
    
    if monthly_budget - total_spent_including_today < 0:
        # 초과 시: 전체 초과액(음수) 반환 (오늘 지출 포함)
        daily_budget = monthly_budget - total_spent_including_today
        remaining_budget = daily_budget
    else:
        # 정상 시: 어제 기준 권장 예산 (오늘 지출 제외)
        remaining_budget = monthly_budget - spent_until_yesterday
        daily_budget = int(remaining_budget / remaining_days)
    
    # 저장
    DailyBudgetSnapshot.objects.update_or_create(
        user=user,
        date=target_date,
        defaults={
            'daily_budget': daily_budget,
            'monthly_budget': monthly_budget,
            'remaining_budget': remaining_budget,
            'remaining_days': remaining_days
        }
    )


def recalculate_snapshots_from_date(user, from_date):
    """
    특정 날짜부터 오늘까지의 스냅샷을 재계산
    지출 내역이 추가/수정/삭제될 때 호출
    """
    today = timezone.localdate()
    current_date = from_date
    
    # from_date가 이번 달인 경우에만 재계산
    if from_date.year != today.year or from_date.month != today.month:
        # 지난 달 지출 변경은 현재 달에 영향 없음
        return
    
    while current_date <= today:
        create_daily_budget_snapshot(user, current_date)
        current_date += timedelta(days=1)


def get_daily_budget_for_date(user, target_date):
    """
    특정 날짜의 일일 권장 예산 조회
    1. 스냅샷 확인
    2. 없으면 그 날 기준으로 동적 계산
    """
    try:
        snapshot = DailyBudgetSnapshot.objects.get(user=user, date=target_date)
        return snapshot.daily_budget
    except DailyBudgetSnapshot.DoesNotExist:
        # 스냅샷이 없음 -> 그 날 기준으로 동적 계산
        year, month = target_date.year, target_date.month
        today = timezone.localdate()
        
        monthly_budget = 0
        is_past = (year < today.year) or (year == today.year and month < today.month)
        if is_past:
            try:
                log = MonthlyLog.objects.get(user=user, year=year, month=month)
                monthly_budget = log.monthly_budget
            except MonthlyLog.DoesNotExist:
                monthly_budget = user.monthly_budget if user.monthly_budget else 0
        else:
            monthly_budget = user.monthly_budget if user.monthly_budget else 0
        
        # 그 날 기준으로 이전까지의 지출만 계산
        from .models import Transaction
        range_start = datetime(year, month, 1).date()
        # 1. 어제까지의 지출
        transactions_yesterday = Transaction.objects.filter(
            user=user, 
            date__date__gte=range_start,
            date__date__lt=target_date
        )
        spent_until_yesterday = sum(t.amount for t in transactions_yesterday)

        # 2. 오늘 지출
        transactions_today = Transaction.objects.filter(
            user=user,
            date__date=target_date
        )
        spent_today = sum(t.amount for t in transactions_today)
        
        # 남은 일수
        _, last_day = calendar.monthrange(year, month)
        remaining_days = last_day - target_date.day + 1
        if remaining_days < 1:
            remaining_days = 1
        
        # 하이브리드 계산 로직
        total_spent_including_today = spent_until_yesterday + spent_today
        
        if monthly_budget - total_spent_including_today < 0:
            return monthly_budget - total_spent_including_today
        else:
            remaining_budget = monthly_budget - spent_until_yesterday
            return int(remaining_budget / remaining_days)


def calculate_target_daily_budget(monthly_budget, year, month, total_spent_month, today_spent_amount=0):
    """
    월 전체의 일일 예산 계산 (하이브리드 로직 적용)
    """
    today = timezone.localdate()
    _, last_day = calendar.monthrange(year, month)
    
    # 이번 달인 경우: 잔여 예산 / 잔여 일수
    if year == today.year and month == today.month:
        remaining_days = last_day - today.day + 1
        if remaining_days < 1: remaining_days = 1

        # 이번 달 전체 지출 (오늘 포함)
        current_total_spent = total_spent_month
        
        # 어제까지의 지출 (전체 - 오늘)
        spent_until_yesterday = total_spent_month - today_spent_amount

        if monthly_budget - current_total_spent < 0:
            # 초과 시: 전체 초과액(음수) 반환
            return monthly_budget - current_total_spent
        else:
            # 정상 시: 어제 기준 권장 예산
            remaining_budget = monthly_budget - spent_until_yesterday
            daily_budget = int(remaining_budget / remaining_days)
            return daily_budget
    else:
        # 과거/미래인 경우: 월 예산 / 전체 일수
        daily_budget = int(monthly_budget / last_day)
        return daily_budget


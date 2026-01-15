from django.utils import timezone
from collections import defaultdict
import calendar
from .models import MonthlyLog, DailyBudgetSnapshot

def get_daily_status(user, year, month, transactions):
    """
    Transactions 쿼리셋을 받아 일별 지출 상태 및 통계를 계산하여 반환
    """
    daily_stats = defaultdict(int)

    for t in transactions:
        local_date = timezone.localtime(t.date).date()
        date_str = local_date.strftime('%Y-%m-%d')
        daily_stats[date_str] += t.amount

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
        current_date = timezone.datetime(target_year, target_month, day).date()
        date_str = current_date.strftime('%Y-%m-%d')
        
        # 지출액 (없으면 0)
        total_spent = daily_stats.get(date_str, 0)
        
        # 해당 날짜의 일일 권장 예산 가져오기 (스냅샷 우선)
        daily_budget = get_daily_budget_for_date(user, current_date)
        
        # 상태 계산 로직
        status_value = 'money' # 기본값
        
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
        pass
    
    # 각 날짜별 예산을 개별 조회
    for date_str, total in daily_stats.items():
        # date_str을 date 객체로 변환
        year_str, month_str, day_str = map(int, date_str.split('-'))
        current_date = timezone.datetime(year_str, month_str, day_str).date()
        
        daily_budget = get_daily_budget_for_date(user, current_date)
        
        status_value = 'money'
        if daily_budget <= 0:
            status_value = 'angry' if total > 0 else 'money'
        else:
            ratio = total / daily_budget
            if ratio <= 0.5:
                status_value = 'money'
            elif ratio <= 1.0:
                status_value = 'happy'
            elif ratio <= 1.5:
                status_value = 'sad'
            else:
                status_value = 'angry'
                
        daily_status_data[date_str] = {
            "total_spent": total,
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
        representative_daily_budget = calculate_target_daily_budget(
            monthly_budget_val, target_year, target_month, total_spent_month
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
        

    # 어제까지의 지출 계산
    from .models import Transaction
    range_start = timezone.datetime(year, month, 1).date()
    
    transactions = Transaction.objects.filter(
        user=user, 
        date__date__gte=range_start,
        date__date__lt=target_date
    )
    spent_until_yesterday = sum(t.amount for t in transactions)
    
    # 남은 일수 (오늘 포함)
    _, last_day_of_month = calendar.monthrange(year, month)
    remaining_days = last_day_of_month - target_date.day + 1
    if remaining_days < 1: remaining_days = 1
    
    remaining_budget = monthly_budget - spent_until_yesterday
    daily_budget = int(remaining_budget / remaining_days)
    
    # 저장
    DailyBudgetSnapshot.objects.create(
        user=user,
        date=target_date,
        daily_budget=daily_budget,
        monthly_budget=monthly_budget,
        remaining_budget=remaining_budget,
        remaining_days=remaining_days
    )


def get_daily_budget_for_date(user, target_date):
    """
    특정 날짜의 일일 권장 예산 조회
    1. 스냅샷 확인
    2. 없으면 동적 계산 (과거 데이터가 없으면 현재 기준으로라도 계산해야 함)
    """
    try:
        snapshot = DailyBudgetSnapshot.objects.get(user=user, date=target_date)
        return snapshot.daily_budget
    except DailyBudgetSnapshot.DoesNotExist:
        # 스냅샷이 없음 -> 동적 계산

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
        
        # 해당 월 전체 지출
        from .models import Transaction
        txs = Transaction.objects.filter(user=user, date__year=year, date__month=month)
        total_spent = sum(t.amount for t in txs)
        
        return calculate_target_daily_budget(monthly_budget, year, month, total_spent)


def calculate_target_daily_budget(monthly_budget, year, month, total_spent_month):
    """
    권장 일일 예산 계산
    """
    today = timezone.localdate()
    _, last_day = calendar.monthrange(year, month)
    
    # 이번 달인 경우: 잔여 예산 / 잔여 일수
    if year == today.year and month == today.month:
        remaining_days = last_day - today.day + 1
        if remaining_days < 1: remaining_days = 1

        remaining_budget = monthly_budget - total_spent_month
        return int(remaining_budget / remaining_days)
    else:
        # 과거/미래인 경우: 월 예산 / 전체 일수
        return int(monthly_budget / last_day)

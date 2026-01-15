from django.db import models
from django.conf import settings
import django.utils.timezone

class Transaction(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='transactions')
    category = models.CharField(max_length=20)   # AI가 분류한 카테고리
    item = models.CharField(max_length=100, default='')     # 품목 (예: 아메리카노)
    store = models.CharField(max_length=100, default='')    # 소비처 (예: 스타벅스)
    amount = models.IntegerField()               # 금액
    memo = models.CharField(max_length=255, blank=True)
    
    date = models.DateTimeField() # 실제 소비 날짜 (사용자 수정 가능)
    is_fixed = models.BooleanField(default=False) # 고정 지출 여부 (예: 구독, 월세). 만약 사용자가 변경하면, 다음부터는 관련 지출은 변경에 따라 기본 설정으로 적용
    
    # 확장성 (위치 기반)
    address = models.CharField(max_length=255, blank=True, null=True) # 소비 위치
    
    created_at = models.DateTimeField(auto_now_add=True) # 데이터 생성 시간

    def __str__(self):
        return f"{self.user} - {self.item} ({self.amount}원)"

class MonthlyLog(models.Model):
    """
    지난 달의 예산 등을 스냅샷 형태로 저장하는 모델
    """
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='monthly_logs')
    year = models.IntegerField()
    month = models.IntegerField()
    monthly_budget = models.IntegerField(default=0) # 해당 월의 예산 스냅샷
    
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'year', 'month')

    def __str__(self):
        return f"{self.user} - {self.year}/{self.month}"

class DailyBudgetSnapshot(models.Model):
    """
    일일 권장 예산 스냅샷
    - 해당 날짜의 자정 기준으로 계산된 일일 권장 예산을 저장
    - 한 번 저장되면 변경되지 않음
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name='daily_budget_snapshots'
    )
    date = models.DateField()  # 스냅샷 날짜
    daily_budget = models.IntegerField()  # 해당 날짜의 일일 권장 예산
    monthly_budget = models.IntegerField()  # 계산 시점의 월 예산
    remaining_budget = models.IntegerField()  # 계산 시점의 잔여 예산
    remaining_days = models.IntegerField()  # 계산 시점의 잔여 일수
    
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'date')
        ordering = ['-date']

    def __str__(self):
        return f"{self.user} - {self.date}: {self.daily_budget}원"

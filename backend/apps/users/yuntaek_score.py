"""
윤택지수(Yuntaek Score) 산출 알고리즘

총 65점 만점:
- 예산 달성률: 35점
- 대안 행동 실현도: 20점
- 소비 일관성: 7점  
- 챌린지 성공: 3점
"""

from decimal import Decimal
from datetime import date, timedelta
from django.db.models import Sum, Avg
import statistics


class YuntaekScoreCalculator:
    """윤택지수 계산기"""
    
    # 점수 가중치
    MAX_BUDGET_SCORE = 35
    MAX_ALTERNATIVE_ACTION_SCORE = 20
    MAX_CONSISTENCY_SCORE = 7
    MAX_CHALLENGE_SCORE = 3
    
    # 챌린지 생성 최소 횟수 (대안 행동 실현도 점수 반영 조건)
    MIN_CHALLENGE_COUNT_FOR_SCORE = 3
    
    def __init__(self, user, year: int, month: int):
        """
        Args:
            user: User 모델 인스턴스
            year: 대상 연도
            month: 대상 월
        """
        self.user = user
        self.year = year
        self.month = month
        
    def calculate(self) -> dict:
        """
        윤택지수 전체 계산
        
        Returns:
            dict: {
                'total_score': 총점,
                'max_score': 65,
                'breakdown': {
                    'budget_achievement': {'score': 점수, 'max': 35, 'details': {...}},
                    'alternative_action': {'score': 점수, 'max': 20, 'details': {...}},
                    'spending_consistency': {'score': 점수, 'max': 7, 'details': {...}},
                    'challenge_success': {'score': 점수, 'max': 3, 'details': {...}},
                }
            }
        """
        budget_result = self._calculate_budget_achievement()
        alternative_result = self._calculate_alternative_action()
        consistency_result = self._calculate_spending_consistency()
        challenge_result = self._calculate_challenge_success()
        
        total_score = (
            budget_result['score'] + 
            alternative_result['score'] + 
            consistency_result['score'] + 
            challenge_result['score']
        )
        
        return {
            'total_score': round(total_score, 2),
            'max_score': 65,
            'year': self.year,
            'month': self.month,
            'breakdown': {
                'budget_achievement': budget_result,
                'alternative_action': alternative_result,
                'spending_consistency': consistency_result,
                'challenge_success': challenge_result,
            }
        }
    
    def _calculate_budget_achievement(self) -> dict:
        """
        1. 예산 달성률 (35점)
        
        - 예산 내 지출: 35점 (만점)
        - 1% ~ 5% 초과: 28점
        - 5% ~ 10% 초과: 21점
        - 10% ~ 20% 초과: 14점
        - 20% 이상 초과: 0점
        """
        from apps.transactions.models import Transaction, MonthlyLog
        
        # 월예산 가져오기 (MonthlyLog 우선, 없으면 현재 user.monthly_budget)
        monthly_budget = self._get_monthly_budget()
        
        if not monthly_budget or monthly_budget <= 0:
            return {
                'score': 0,
                'max': self.MAX_BUDGET_SCORE,
                'details': {
                    'monthly_budget': 0,
                    'total_spent': 0,
                    'exceeded_percent': 0,
                    'message': '예산이 설정되지 않았습니다.'
                }
            }
        
        # 해당 월 총 지출 계산
        start_date, end_date = self._get_month_date_range()
        total_spent = Transaction.objects.filter(
            user=self.user,
            date__gte=start_date,
            date__lt=end_date
        ).aggregate(total=Sum('amount'))['total'] or 0
        
        # 초과율 계산
        if total_spent <= monthly_budget:
            exceeded_percent = 0
            score = self.MAX_BUDGET_SCORE  # 35점
        else:
            exceeded_percent = ((total_spent - monthly_budget) / monthly_budget) * 100
            score = self._get_budget_score_by_exceeded_percent(exceeded_percent)
        
        return {
            'score': score,
            'max': self.MAX_BUDGET_SCORE,
            'details': {
                'monthly_budget': float(monthly_budget),
                'total_spent': float(total_spent),
                'exceeded_percent': round(exceeded_percent, 2),
                'within_budget': total_spent <= monthly_budget
            }
        }
    
    def _get_budget_score_by_exceeded_percent(self, exceeded_percent: float) -> int:
        """초과율에 따른 예산 달성률 점수 반환"""
        if exceeded_percent <= 0:
            return 35
        elif exceeded_percent <= 5:
            return 28
        elif exceeded_percent <= 10:
            return 21
        elif exceeded_percent <= 20:
            return 14
        else:
            return 0
    
    def _calculate_alternative_action(self) -> dict:
        """
        2. 대안 행동 실현도 (20점)
        
        공식: (성공한 AI 코칭 챌린지 건수 / 챌린지 생성 AI 코칭 건수) * 20
        - 코칭 카드에서 3회 이상 챌린지 생성시 점수 반영 (3회 미만 시 0점 처리)
        """
        from apps.challenges.models import UserChallenge
        
        start_date, end_date = self._get_month_date_range()
        
        # 코칭 기반 챌린지 생성 건수
        challenges_created = UserChallenge.objects.filter(
            user=self.user,
            source_type='ai',
            created_at__gte=start_date,
            created_at__lt=end_date
        ).count()
        
        # 3회 미만 챌린지 생성 시 0점
        if challenges_created < self.MIN_CHALLENGE_COUNT_FOR_SCORE:
            return {
                'score': 0,
                'max': self.MAX_ALTERNATIVE_ACTION_SCORE,
                'details': {
                    'total_suggestions': 0,
                    'completed_actions': 0,
                    'challenges_created': challenges_created,
                    'completion_rate': 0,
                    'message': f'챌린지 생성이 {self.MIN_CHALLENGE_COUNT_FOR_SCORE}회 미만입니다.'
                }
            }
        
        # 성공한 챌린지 수
        successful_challenges = UserChallenge.objects.filter(
            user=self.user,
            source_type='ai',
            created_at__gte=start_date,
            created_at__lt=end_date,
            status='succeeded'
        ).count()
        
        # 점수 계산: (성공한 챌린지 건수 / 생성된 챌린지 건수) * 20
        completion_rate = (successful_challenges / challenges_created) * 100
        score = (successful_challenges / challenges_created) * self.MAX_ALTERNATIVE_ACTION_SCORE
        
        return {
            'score': round(score, 2),
            'max': self.MAX_ALTERNATIVE_ACTION_SCORE,
            'details': {
                'challenges_created': challenges_created,
                'successful_challenges': successful_challenges,
                'completion_rate': round(completion_rate, 2)
            }
        }
    
    def _calculate_spending_consistency(self) -> dict:
        """
        3. 소비 일관성 (7점)
        
        기준치: (월간 총 예산 / 30) * 2
        공식: Max(0, (1 - (일일 지출 표준편차 / 기준치)) * 7)
        
        표준편차가 낮을수록 점수가 높음
        """
        from apps.transactions.models import Transaction
        
        monthly_budget = self._get_monthly_budget()
        
        if not monthly_budget or monthly_budget <= 0:
            return {
                'score': 0,
                'max': self.MAX_CONSISTENCY_SCORE,
                'details': {
                    'monthly_budget': 0,
                    'threshold': 0,
                    'std_deviation': 0,
                    'daily_spending': [],
                    'message': '예산이 설정되지 않았습니다.'
                }
            }
        
        # 기준치 계산: (월예산 / 30) * 2
        threshold = (float(monthly_budget) / 30) * 2
        
        # 일일 지출 데이터 가져오기
        start_date, end_date = self._get_month_date_range()
        
        # 일별 지출 합계
        daily_spending = Transaction.objects.filter(
            user=self.user,
            date__gte=start_date,
            date__lt=end_date
        ).values('date__date').annotate(
            daily_total=Sum('amount')
        ).order_by('date__date')
        
        daily_amounts = [float(d['daily_total']) for d in daily_spending]
        
        # 지출 데이터가 없으면
        if not daily_amounts:
            return {
                'score': self.MAX_CONSISTENCY_SCORE,  # 소비가 없으면 일관성 만점
                'max': self.MAX_CONSISTENCY_SCORE,
                'details': {
                    'monthly_budget': float(monthly_budget),
                    'threshold': round(threshold, 2),
                    'std_deviation': 0,
                    'days_with_spending': 0,
                    'message': '지출 데이터가 없어 만점 처리됩니다.'
                }
            }
        
        # 표준편차 계산 (데이터가 1개면 0)
        if len(daily_amounts) == 1:
            std_deviation = 0
        else:
            std_deviation = statistics.stdev(daily_amounts)
        
        # 점수 계산: Max(0, (1 - (표준편차 / 기준치)) * 7)
        if threshold == 0:
            score = 0
        else:
            score = max(0, (1 - (std_deviation / threshold)) * self.MAX_CONSISTENCY_SCORE)
        
        return {
            'score': round(score, 2),
            'max': self.MAX_CONSISTENCY_SCORE,
            'details': {
                'monthly_budget': float(monthly_budget),
                'threshold': round(threshold, 2),
                'std_deviation': round(std_deviation, 2),
                'days_with_spending': len(daily_amounts),
                'avg_daily_spending': round(sum(daily_amounts) / len(daily_amounts), 2)
            }
        }
    
    def _calculate_challenge_success(self) -> dict:
        """
        4. 챌린지 성공 (3점)
        
        - 2회 이상 성공: 3점
        - 1회 성공: 2점
        - 0회: 0점
        """
        from apps.challenges.models import UserChallenge
        
        start_date, end_date = self._get_month_date_range()
        
        # 해당 월에 성공한 챌린지 수
        success_count = UserChallenge.objects.filter(
            user=self.user,
            status='succeeded',
            completed_at__gte=start_date,
            completed_at__lt=end_date
        ).count()
        
        # 점수 계산
        if success_count >= 2:
            score = 3
        elif success_count == 1:
            score = 2
        else:
            score = 0
        
        return {
            'score': score,
            'max': self.MAX_CHALLENGE_SCORE,
            'details': {
                'success_count': success_count,
                'required_for_full_score': 2
            }
        }
    
    def _get_monthly_budget(self):
        """해당 월의 예산 가져오기"""
        from apps.transactions.models import MonthlyLog
        
        # MonthlyLog에서 해당 월의 예산 스냅샷 확인
        monthly_log = MonthlyLog.objects.filter(
            user=self.user,
            year=self.year,
            month=self.month
        ).first()
        
        if monthly_log and monthly_log.monthly_budget:
            return Decimal(monthly_log.monthly_budget)
        
        # 없으면 현재 사용자의 월예산 사용
        return self.user.monthly_budget or Decimal(0)
    
    def _get_month_date_range(self) -> tuple:
        """해당 월의 시작일과 종료일(다음달 1일) 반환"""
        from datetime import datetime
        from django.utils import timezone
        
        start_date = timezone.make_aware(datetime(self.year, self.month, 1))
        
        # 다음 달의 1일
        if self.month == 12:
            end_date = timezone.make_aware(datetime(self.year + 1, 1, 1))
        else:
            end_date = timezone.make_aware(datetime(self.year, self.month + 1, 1))
        
        return start_date, end_date


def get_yuntaek_score(user, year: int = None, month: int = None) -> dict:
    """
    윤택지수 조회 헬퍼 함수
    
    Args:
        user: User 모델 인스턴스
        year: 대상 연도 (기본값: 현재 연도)
        month: 대상 월 (기본값: 현재 월)
    
    Returns:
        dict: 윤택지수 결과
    """
    from datetime import date
    
    if year is None:
        year = date.today().year
    if month is None:
        month = date.today().month
    
    calculator = YuntaekScoreCalculator(user, year, month)
    return calculator.calculate()

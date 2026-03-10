"""
윤택지수 산출 알고리즘

총 100점 만점:
- 예산 달성률: 35점
- 대안 행동 실현도: 20점
- 소비 일관성: 7점  
- 챌린지 성공: 3점
- 건강 점수: 15점 (AI 분석)
- 누수 지출 개선: 10점 (AI 분석)
- 성장 소비: 10점 (AI 분석)
"""

from datetime import date
import statistics

from django.db.models import Sum

from apps.transactions.models import Transaction
from apps.challenges.models import UserChallenge
from external.ai.client import AIClient
from .services import get_month_date_range, get_monthly_budget_snapshot, get_previous_month


class YuntaekScoreAnalysisError(Exception):
    """윤택지수 AI 분석 실패."""


class YuntaekScoreCalculator:
    """윤택지수 계산기"""
    
    # 알고리즘 기반 점수 가중치
    MAX_BUDGET_SCORE = 35
    MAX_ALTERNATIVE_ACTION_SCORE = 20
    MAX_CONSISTENCY_SCORE = 7
    MAX_CHALLENGE_SCORE = 3
    
    # AI 분석 기반 점수 가중치
    MAX_HEALTH_SCORE = 15
    MAX_LEAKAGE_IMPROVEMENT_SCORE = 10
    MAX_GROWTH_SCORE = 10
    
    # 챌린지 생성 최소 횟수
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
        # 캐싱
        self._date_range = None
        self._monthly_budget = None
        self._ai_client = None

    @property
    def ai_client(self):
        """AIClient lazy initialization — AI 분석 메서드에서 공유"""
        if self._ai_client is None:
            self._ai_client = AIClient(purpose="analysis")
        return self._ai_client
        
    def calculate(self) -> dict:
        """윤택지수 전체 계산"""
        # 알고리즘 기반 점수
        budget_score = self._calculate_budget_achievement()
        alternative_score = self._calculate_alternative_action()
        consistency_score = self._calculate_spending_consistency()
        challenge_score = self._calculate_challenge_success()
        
        # AI 분석 기반 점수
        health_score = self._calculate_health_score()
        leakage_score = self._calculate_leakage_improvement()
        growth_score = self._calculate_growth_consumption()
        
        total_score = (
            budget_score + 
            alternative_score + 
            consistency_score + 
            challenge_score +
            health_score +
            leakage_score +
            growth_score
        )
        
        return {
            'total_score': int(total_score),
            'max_score': 100,
            'year': self.year,
            'month': self.month,
            'breakdown': {
                'budget_achievement': budget_score,
                'alternative_action': alternative_score,
                'spending_consistency': consistency_score,
                'challenge_success': challenge_score,
                'health_score': health_score,
                'leakage_improvement': leakage_score,
                'growth_consumption': growth_score,
            }
        }
    
    def _calculate_budget_achievement(self) -> int:
        """
        1. 예산 달성률 (35점)
        
        - 예산 내 지출: 35점 (만점)
        - 1% ~ 5% 초과: 28점
        - 5% ~ 10% 초과: 21점
        - 10% ~ 20% 초과: 14점
        - 20% 이상 초과: 0점
        """
        monthly_budget = self._get_monthly_budget()
        
        if not monthly_budget or monthly_budget <= 0:
            return 0
        
        start_date, end_date = self._get_month_date_range()
        total_spent = Transaction.objects.filter(
            user=self.user,
            date__gte=start_date,
            date__lt=end_date
        ).aggregate(total=Sum('amount'))['total'] or 0
        
        monthly_budget_float = float(monthly_budget)
        
        if total_spent <= monthly_budget_float:
            score = self.MAX_BUDGET_SCORE
        else:
            exceeded_percent = ((total_spent - monthly_budget_float) / monthly_budget_float) * 100
            score = self._get_budget_score_by_exceeded_percent(exceeded_percent)
        
        return int(score)
    
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
        return 0
    
    def _calculate_alternative_action(self) -> int:
        """
        2. 대안 행동 실현도 (20점)
        
        공식: (성공한 AI 코칭 챌린지 건수 / 챌린지 생성 AI 코칭 건수) * 20
        - 코칭 카드에서 3회 이상 챌린지 생성시 점수 반영 (3회 미만 시 0점 처리)
        """
        start_date, end_date = self._get_month_date_range()
        
        # 생성 건수와 성공 건수 조회
        ai_challenges = UserChallenge.objects.filter(
            user=self.user,
            source_type='ai',
            created_at__gte=start_date,
            created_at__lt=end_date
        )
        
        challenges_created = ai_challenges.count()
        
        if challenges_created < self.MIN_CHALLENGE_COUNT_FOR_SCORE:
            return 0
        
        successful_challenges = ai_challenges.filter(status='completed').count()
        
        score = int((successful_challenges / challenges_created) * self.MAX_ALTERNATIVE_ACTION_SCORE)
        
        return int(score)
    
    def _calculate_spending_consistency(self) -> int:
        """
        3. 소비 일관성 (7점)

        기준치: (월간 총 예산 / 30) * 2
        공식: Max(0, (1 - (일일 지출 표준편차 / 기준치)) * 7)

        무지출인 날은 계산에서 제외
        """
        monthly_budget = self._get_monthly_budget()

        if not monthly_budget or monthly_budget <= 0:
            return 0

        monthly_budget_float = float(monthly_budget)
        threshold = (monthly_budget_float / 30) * 2

        start_date, end_date = self._get_month_date_range()

        # 일별 지출 합계 (무지출 제외)
        daily_spending = Transaction.objects.filter(
            user=self.user,
            date__gte=start_date,
            date__lt=end_date
        ).values('date__date').annotate(
            daily_total=Sum('amount')
        ).filter(daily_total__gt=0)

        daily_amounts = [d['daily_total'] for d in daily_spending]

        if not daily_amounts:
            return self.MAX_CONSISTENCY_SCORE
        
        # 표준편차 계산
        if len(daily_amounts) == 1:
            std_deviation = 0.0
        else:
            std_deviation = statistics.stdev([float(x) for x in daily_amounts])
        
        # 점수 계산
        if threshold == 0:
            score = 0
        else:
            raw_score = (1 - (std_deviation / threshold)) * self.MAX_CONSISTENCY_SCORE
            score = int(max(0, raw_score))
        
        return int(score)
    
    def _calculate_challenge_success(self) -> int:
        """
        4. 챌린지 성공 (3점)
        
        - 2회 이상 성공: 3점
        - 1회 성공: 2점
        - 0회: 0점
        """
        start_date, end_date = self._get_month_date_range()
        
        success_count = UserChallenge.objects.filter(
            user=self.user,
            status='completed',
            completed_at__gte=start_date,
            completed_at__lt=end_date
        ).count()
        
        if success_count >= 2:
            score = 3
        elif success_count == 1:
            score = 2
        else:
            score = 0
        
        return int(score)
    
    # ============================================================
    # AI 분석 기반 점수 계산
    # ============================================================
    
    def _calculate_health_score(self) -> int:
        """
        5. 건강 점수 (15점) - AI 분석
        
        client.py에서 사용자의 거래 내역을 분석하여 건강 점수 반환
        """
        health_score = self.ai_client.analyze_health_score(self.user.id, self.year, self.month)
        if health_score is None:
            raise YuntaekScoreAnalysisError('건강 점수 AI 분석에 실패했습니다.')
        
        # AI가 반환한 점수를 최대값으로 제한
        score = min(int(health_score), self.MAX_HEALTH_SCORE)
        
        return int(score)
    
    def _calculate_leakage_improvement(self) -> int:
        """
        6. 누수 지출 개선 (10점) - AI 분석
        
        client.py에서 이번달/지난달 누수 지출액을 반환
        공식: 1 - (이번달 누수 지출액 / 지난달 누수 지출액)
        - 감소율 90% 이상: 10점
        - 감소율 50%: 5점
        - 오히려 증가 시: 0점
        """
        # 이번 달 누수 지출액
        current_leakage = self.ai_client.analyze_leakage_spending(self.user.id, self.year, self.month)
        if current_leakage is None:
            raise YuntaekScoreAnalysisError('누수 지출 분석에 실패했습니다.')

        # 지난 달 누수 지출액
        prev_year, prev_month = get_previous_month(self.year, self.month)

        prev_leakage = self.ai_client.analyze_leakage_spending(self.user.id, prev_year, prev_month)
        if prev_leakage is None:
            raise YuntaekScoreAnalysisError('전월 누수 지출 분석에 실패했습니다.')
        
        # 점수 계산
        if prev_leakage == 0:
            score = self.MAX_LEAKAGE_IMPROVEMENT_SCORE if current_leakage == 0 else 0
        else:
            improvement_rate = 1 - (current_leakage / prev_leakage)
            
            if improvement_rate >= 0.9:
                score = 10
            elif improvement_rate >= 0.5:
                score = int(5 + (improvement_rate - 0.5) * 12.5)
            elif improvement_rate > 0:
                score = int(improvement_rate * 10)
            else:
                score = 0
        
        return int(score)
    
    def _calculate_growth_consumption(self) -> int:
        """
        7. 성장 소비 (10점) - AI 분석
        
        client.py에서 성장 지출액을 반환
        권장 비율(월 지출의 7%) 대비 실제 성장 카테고리 지출 비율
        공식: (성장 카테고리 총 지출액 / 권장 금액) * 10 (최대 10점)
        """
        start_date, end_date = self._get_month_date_range()
        
        # 월 총 지출액
        total_spent = Transaction.objects.filter(
            user=self.user,
            date__gte=start_date,
            date__lt=end_date
        ).aggregate(total=Sum('amount'))['total'] or 0
        
        if total_spent == 0:
            return 0
        
        growth_amount = self.ai_client.analyze_growth_spending(self.user.id, self.year, self.month)
        if growth_amount is None:
            raise YuntaekScoreAnalysisError('성장 소비 분석에 실패했습니다.')
        
        # 권장 금액: 월 총 지출의 7%
        recommended_amount = total_spent * 0.07
        
        # 점수 계산: (성장 지출액 / 권장 금액) * 10, 최대 10점
        if recommended_amount > 0:
            raw_score = (growth_amount / recommended_amount) * self.MAX_GROWTH_SCORE
            score = min(int(raw_score), self.MAX_GROWTH_SCORE)
        else:
            score = 0
        
        return int(score)
    
    def _get_monthly_budget(self):
        """해당 월의 예산 가져오기"""
        if self._monthly_budget is not None:
            return self._monthly_budget

        self._monthly_budget = get_monthly_budget_snapshot(self.user, self.year, self.month)
        return self._monthly_budget
    
    def _get_month_date_range(self) -> tuple:
        """해당 월의 시작일과 종료일 반환"""
        if self._date_range is not None:
            return self._date_range

        self._date_range = get_month_date_range(self.year, self.month)
        return self._date_range


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
    today = date.today()
    
    if year is None:
        year = today.year
    if month is None:
        month = today.month
    
    calculator = YuntaekScoreCalculator(user, year, month)
    return calculator.calculate()

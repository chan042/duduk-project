"""
윤택지수 관련 비즈니스 로직 서비스

views.py와 tasks.py에서 공용으로 사용하는 데이터 수집, 날짜 계산,
캐시 관리 등의 로직을 서비스 레이어로 분리합니다.
"""
import calendar
import logging

from django.utils import timezone
from django.db.models import Sum

logger = logging.getLogger(__name__)


def get_previous_month(year, month):
    """전월 (year, month) 튜플 반환"""
    if month == 1:
        return year - 1, 12
    return year, month - 1


def get_target_month(year=None, month=None):
    """
    요청된 year/month 또는 기본 전월 반환.

    query_params에서 받은 문자열도 처리 가능.
    """
    if year and month:
        return int(year), int(month)
    now = timezone.localdate()
    return get_previous_month(now.year, now.month)


def get_month_date_range(year, month):
    """해당 월의 시작/종료 aware datetime 반환"""
    _, last_day = calendar.monthrange(year, month)
    start = timezone.make_aware(timezone.datetime(year, month, 1))
    end = timezone.make_aware(timezone.datetime(year, month, last_day, 23, 59, 59))
    return start, end


def is_new_user_for_month(user, year, month):
    """
    해당 월에 대해 신규 사용자인지 판단.

    거래 내역이 없고, 조회 월이 가입 월 이전이거나 같으면 신규.
    """
    from apps.transactions.models import Transaction

    start, end = get_month_date_range(year, month)
    has_transactions = Transaction.objects.filter(
        user=user, date__gte=start, date__lte=end
    ).exists()

    if has_transactions:
        return False

    joined = user.date_joined.date()
    return (year < joined.year) or (year == joined.year and month <= joined.month)


def _get_prev_score_without_ai(user, year, month):
    """
    전월 윤택지수를 캐시된 리포트에서 가져옴 (AI 호출 없음).

    캐시가 없으면 0을 반환하여 Gemini API 호출 횟수를 절감합니다.
    """
    from apps.users.models import MonthlyReport

    cached = MonthlyReport.objects.filter(
        user=user, year=year, month=month
    ).first()

    if cached and isinstance(cached.report_content, dict):
        yuntaek = cached.report_content.get('yuntaek_analysis', {})
        score = yuntaek.get('current_score', 0)
        if score:
            return {'total_score': score, 'breakdown': {}}

    return {'total_score': 0, 'breakdown': {}}


def collect_report_data(user, year, month):
    """
    리포트 생성에 필요한 데이터 수집.

    views.py의 MonthlyReportView와 tasks.py의 배치 작업에서 공용 사용.
    """
    from apps.transactions.models import Transaction
    from apps.challenges.models import UserChallenge
    from apps.users.yuntaek_score import get_yuntaek_score

    start, end = get_month_date_range(year, month)
    prev_year, prev_month = get_previous_month(year, month)

    # 당월 거래
    transactions = Transaction.objects.filter(
        user=user, date__gte=start, date__lte=end
    )
    total_spending = transactions.aggregate(total=Sum('amount'))['total'] or 0

    # 카테고리별 지출
    category_spending = list(
        transactions.values('category')
        .annotate(total=Sum('amount'))
        .order_by('-total')
    )

    # 전월 지출
    prev_start, prev_end = get_month_date_range(prev_year, prev_month)
    prev_total = Transaction.objects.filter(
        user=user, date__gte=prev_start, date__lte=prev_end
    ).aggregate(total=Sum('amount'))['total'] or 0

    # 당월 윤택지수 (AI 호출 O)
    current_score = get_yuntaek_score(user, year, month)

    # 전월 윤택지수 (AI 호출 X)
    prev_score = _get_prev_score_without_ai(user, prev_year, prev_month)

    # 챌린지
    challenges = UserChallenge.objects.filter(
        user=user, created_at__gte=start, created_at__lte=end
    )

    return {
        'year': year,
        'month': month,
        'monthly_budget': float(user.monthly_budget) if user.monthly_budget else 0,
        'total_spending': float(total_spending),
        'prev_total_spending': float(prev_total),
        'category_spending': category_spending,
        'yuntaek_score': current_score.get('total_score', 0),
        'prev_yuntaek_score': prev_score.get('total_score', 0),
        'score_breakdown': current_score.get('breakdown', {}),
        'challenge_count': challenges.count(),
        'challenge_success_count': challenges.filter(status='completed').count(),
        # 사용자 페르소나 정보
        'job': user.job or '',
        'hobbies': user.hobbies or '',
        'marital_status': user.get_marital_status_display(),
        'has_children': user.has_children,
        'self_development_field': user.self_development_field or '',
        'ai_persona_summary': getattr(user, 'ai_persona_summary', ''),
    }


def get_new_user_default_report(year, month):
    """신규 사용자용 기본 가이드 리포트 생성"""
    now = timezone.localdate()
    if now.month == 12:
        next_month = 1
    else:
        next_month = now.month + 1

    return {
        "guide": {
            "title": "\U0001f3af 시작 가이드",
            "steps": [
                f"지출 기록하기: 이번 달 소비를 꾸준히 기록해보세요. 다음달에 분석 결과를 확인할 수 있습니다.",
                "예산 설정하기: 프로필에서 월 예산을 설정하면 더 정확한 분석이 가능합니다",
                "챌린지 참여: 작은 목표부터 시작해 건강한 소비 습관을 만들어보세요"
            ],
            "tips": [
                "작은 지출도 빠짐없이 기록하는 것이 중요합니다",
                "일주일에 한 번씩 지출을 돌아보는 습관을 들여보세요",
                "두둑의 AI 코칭을 적극 활용해보세요!",
                "매월 1일에 전월 윤택지수가 생성됩니다"
            ]
        }
    }


def save_report_cache(user, year, month, report_content):
    """리포트 캐시 저장 (update_or_create 사용)"""
    from apps.users.models import MonthlyReport

    report, _ = MonthlyReport.objects.update_or_create(
        user=user, year=year, month=month,
        defaults={'report_content': report_content}
    )
    return report


def save_report_and_persona(user, year, month, ai_result: dict):
    """
    AI 응답에서 리포트 내용과 페르소나 요약을 분리하여 각각 저장합니다.

    Args:
        user: User 인스턴스
        year: 연도
        month: 월
        ai_result: GeminiClient.generate_monthly_report()의 반환값
            - 'report': 리포트 JSON
            - 'updated_persona_summary': 업데이트된 페르소나 요약 문자열

    Returns:
        (MonthlyReport 인스턴스, report_content dict)
    """
    report_content = ai_result.get('report', ai_result)
    updated_persona = ai_result.get('updated_persona_summary', '')

    # 1) 리포트 캐시 저장
    saved = save_report_cache(user, year, month, report_content)

    # 2) 페르소나 요약 업데이트
    if updated_persona:
        user.ai_persona_summary = updated_persona
        user.save(update_fields=['ai_persona_summary'])
        logger.info(
            "사용자 %s의 ai_persona_summary 업데이트 완료 (%d자)",
            user.id, len(updated_persona),
        )

    return saved, report_content

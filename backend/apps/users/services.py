"""
윤택지수 관련 비즈니스 로직 서비스

views.py와 tasks.py에서 공용으로 사용하는 데이터 수집, 날짜 계산,
캐시 관리 등의 로직을 서비스 레이어로 분리합니다.
"""
import logging
from decimal import Decimal

from django.db.models import Sum
from django.utils import timezone
from apps.common.months import (
    get_month_datetime_range as get_month_date_range,
    get_previous_month,
)

logger = logging.getLogger(__name__)


def get_target_month(year=None, month=None):
    """
    요청된 year/month 또는 기본 전월 반환.

    query_params에서 받은 문자열도 처리 가능.
    """
    if year and month:
        return int(year), int(month)
    now = timezone.localdate()
    return get_previous_month(now.year, now.month)


def get_monthly_budget_snapshot(user, year, month):
    """대상 월의 예산 스냅샷을 반환합니다."""
    from apps.transactions.models import MonthlyLog

    monthly_log = MonthlyLog.objects.filter(
        user=user,
        year=year,
        month=month,
    ).values_list('monthly_budget', flat=True).first()

    if monthly_log is not None:
        return Decimal(monthly_log)

    return user.monthly_budget or Decimal(0)


def is_new_user_for_month(user, year, month):
    """
    해당 월에 대해 신규 사용자인지 판단.

    거래 내역이 없고, 조회 월이 가입 월 이전이거나 같으면 신규.
    """
    from apps.transactions.models import Transaction

    start, end = get_month_date_range(year, month)
    has_transactions = Transaction.objects.filter(
        user=user, date__gte=start, date__lt=end
    ).exists()

    if has_transactions:
        return False

    joined = user.date_joined.date()
    return (year < joined.year) or (year == joined.year and month <= joined.month)


def _get_prev_score_without_ai(user, year, month):
    """
    전월 윤택지수를 캐시된 리포트에서 가져옴 (AI 호출 없음).

    캐시가 없으면 0을 반환하여 AI API 호출 횟수를 절감합니다.
    """
    cached, _ = get_cached_score_snapshot(user, year, month)
    if cached:
        return {
            'total_score': cached.get('total_score', 0),
            'breakdown': cached.get('breakdown', {}),
        }

    return {'total_score': 0, 'breakdown': {}}


def get_cached_score_snapshot(user, year, month):
    """저장된 윤택지수 스냅샷을 조회합니다."""
    from apps.users.models import MonthlyReport

    monthly_report = MonthlyReport.objects.filter(
        user=user,
        year=year,
        month=month,
    ).first()

    if (
        monthly_report
        and monthly_report.score_status == MonthlyReport.ScoreStatus.READY
        and isinstance(monthly_report.score_snapshot, dict)
        and monthly_report.score_snapshot
    ):
        return monthly_report.score_snapshot, monthly_report

    return None, monthly_report


def get_cached_report_content(user, year, month):
    """저장된 월간 리포트를 조회합니다."""
    from apps.users.models import MonthlyReport

    monthly_report = MonthlyReport.objects.filter(
        user=user,
        year=year,
        month=month,
    ).first()

    if (
        monthly_report
        and isinstance(monthly_report.report_content, dict)
        and monthly_report.report_content
    ):
        return monthly_report.report_content, monthly_report

    return None, monthly_report


def save_score_snapshot(user, year, month, score_data):
    """윤택지수 스냅샷을 저장합니다. 이미 생성된 스냅샷은 덮어쓰지 않습니다."""
    from apps.users.models import MonthlyReport

    normalized_score = {
        'total_score': int(score_data.get('total_score', 0)),
        'max_score': int(score_data.get('max_score', 100)),
        'year': year,
        'month': month,
        'breakdown': score_data.get('breakdown', {}),
        'analysis_warnings': score_data.get('analysis_warnings', []),
    }

    monthly_report, created = MonthlyReport.objects.get_or_create(
        user=user,
        year=year,
        month=month,
        defaults={
            'score_snapshot': normalized_score,
            'score_generated_at': timezone.now(),
            'score_status': MonthlyReport.ScoreStatus.READY,
            'score_error': '',
        },
    )

    if created:
        return monthly_report

    if (
        monthly_report.score_status == MonthlyReport.ScoreStatus.READY
        and isinstance(monthly_report.score_snapshot, dict)
        and monthly_report.score_snapshot
    ):
        return monthly_report

    monthly_report.score_snapshot = normalized_score
    monthly_report.score_generated_at = timezone.now()
    monthly_report.score_status = MonthlyReport.ScoreStatus.READY
    monthly_report.score_error = ''
    monthly_report.save(update_fields=[
        'score_snapshot',
        'score_generated_at',
        'score_status',
        'score_error',
        'updated_at',
    ])
    return monthly_report


def mark_score_snapshot_failed(user, year, month, error_message):
    """윤택지수 생성 실패 상태를 저장합니다. 완료된 스냅샷은 유지합니다."""
    from apps.users.models import MonthlyReport

    existing_score, existing_report = get_cached_score_snapshot(user, year, month)
    if existing_score and existing_report:
        return existing_report

    monthly_report, _ = MonthlyReport.objects.update_or_create(
        user=user,
        year=year,
        month=month,
        defaults={
            'score_status': MonthlyReport.ScoreStatus.FAILED,
            'score_error': error_message,
        },
    )
    return monthly_report


def ensure_score_snapshot(user, year, month, force_refresh=False):
    """
    대상 월의 윤택지수 스냅샷을 보장합니다.

    Returns:
        (score_data, MonthlyReport 인스턴스, was_cached)
    """
    from apps.users.yuntaek_score import YuntaekScoreAnalysisError, get_yuntaek_score

    cached_score, cached_report = get_cached_score_snapshot(user, year, month)
    if cached_score:
        return cached_score, cached_report, True

    try:
        score_data = get_yuntaek_score(user, year, month)
    except YuntaekScoreAnalysisError as exc:
        mark_score_snapshot_failed(user, year, month, str(exc))
        raise

    saved = save_score_snapshot(user, year, month, score_data)
    return saved.score_snapshot, saved, False


def collect_report_data(user, year, month, score_data=None):
    """
    리포트 생성에 필요한 데이터 수집.

    views.py의 MonthlyReportView와 tasks.py의 배치 작업에서 공용 사용.
    """
    from apps.transactions.models import Transaction
    from apps.challenges.models import UserChallenge
    start, end = get_month_date_range(year, month)
    prev_year, prev_month = get_previous_month(year, month)

    # 당월 거래
    transactions = Transaction.objects.filter(
        user=user, date__gte=start, date__lt=end
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
        user=user, date__gte=prev_start, date__lt=prev_end
    ).aggregate(total=Sum('amount'))['total'] or 0

    # 당월 윤택지수 스냅샷
    current_score = score_data
    if current_score is None:
        current_score, _, _ = ensure_score_snapshot(user, year, month)

    # 전월 윤택지수 (캐시된 스냅샷만 사용)
    prev_score = _get_prev_score_without_ai(user, prev_year, prev_month)

    # 챌린지
    created_challenges = UserChallenge.objects.filter(
        user=user,
        created_at__gte=start,
        created_at__lt=end,
    )
    completed_challenges = UserChallenge.objects.filter(
        user=user,
        status='completed',
        completed_at__gte=start,
        completed_at__lt=end,
    )

    return {
        'year': year,
        'month': month,
        'monthly_budget': float(get_monthly_budget_snapshot(user, year, month) or 0),
        'total_spending': float(total_spending),
        'prev_total_spending': float(prev_total),
        'category_spending': category_spending,
        'yuntaek_score': current_score.get('total_score', 0),
        'prev_yuntaek_score': prev_score.get('total_score', 0),
        'score_breakdown': current_score.get('breakdown', {}),
        'challenge_count': created_challenges.count(),
        'challenge_success_count': completed_challenges.count(),
        # 사용자 페르소나 정보
        'job': user.job or '',
        'hobbies': user.hobbies or '',
        'marital_status': user.get_marital_status_display(),
        'self_development_field': user.self_development_field or '',
        'ai_persona_summary': getattr(user, 'ai_persona_summary', ''),
    }





def save_report_cache(user, year, month, report_content):
    """월간 리포트를 저장합니다. 이미 생성된 리포트는 덮어쓰지 않습니다."""
    from apps.users.models import MonthlyReport

    report, created = MonthlyReport.objects.get_or_create(
        user=user,
        year=year,
        month=month,
        defaults={'report_content': report_content},
    )

    if created:
        return report, True

    if isinstance(report.report_content, dict) and report.report_content:
        return report, False

    report.report_content = report_content
    report.save(update_fields=['report_content', 'updated_at'])
    return report, True


def save_report_and_persona(user, year, month, ai_result: dict):
    """
    AI 응답에서 리포트 내용과 페르소나 요약을 분리하여 각각 저장합니다.

    Args:
        user: User 인스턴스
        year: 연도
        month: 월
        ai_result: AIClient.generate_monthly_report()의 반환값
            - 'report': 리포트 JSON
            - 'updated_persona_summary': 업데이트된 페르소나 요약 문자열

    Returns:
        (MonthlyReport 인스턴스, report_content dict)
    """
    report_content = ai_result.get('report', ai_result)
    updated_persona = ai_result.get('updated_persona_summary', '')

    # 1) 리포트 캐시 저장
    saved, report_was_saved = save_report_cache(user, year, month, report_content)

    # 2) 페르소나 요약 업데이트
    if updated_persona and report_was_saved:
        user.ai_persona_summary = updated_persona
        user.save(update_fields=['ai_persona_summary'])
        logger.info(
            "사용자 %s의 ai_persona_summary 업데이트 완료 (%d자)",
            user.id, len(updated_persona),
        )

    return saved, saved.report_content


def force_save_score_snapshot(user, year, month, score_data):
    """개발용 강제 재생성 경로에서 윤택지수 스냅샷을 덮어씁니다."""
    from apps.users.models import MonthlyReport

    normalized_score = {
        'total_score': int(score_data.get('total_score', 0)),
        'max_score': int(score_data.get('max_score', 100)),
        'year': year,
        'month': month,
        'breakdown': score_data.get('breakdown', {}),
        'analysis_warnings': score_data.get('analysis_warnings', []),
    }

    monthly_report, _ = MonthlyReport.objects.update_or_create(
        user=user,
        year=year,
        month=month,
        defaults={
            'score_snapshot': normalized_score,
            'score_generated_at': timezone.now(),
            'score_status': MonthlyReport.ScoreStatus.READY,
            'score_error': '',
        },
    )
    return monthly_report


def force_save_report_and_persona(user, year, month, ai_result: dict):
    """개발용 강제 재생성 경로에서 월간 리포트를 덮어씁니다."""
    from apps.users.models import MonthlyReport

    report_content = ai_result.get('report', ai_result)
    updated_persona = ai_result.get('updated_persona_summary', '')

    monthly_report, _ = MonthlyReport.objects.update_or_create(
        user=user,
        year=year,
        month=month,
        defaults={'report_content': report_content},
    )

    if updated_persona:
        user.ai_persona_summary = updated_persona
        user.save(update_fields=['ai_persona_summary'])
        logger.info(
            "사용자 %s의 ai_persona_summary 강제 업데이트 완료 (%d자)",
            user.id, len(updated_persona),
        )

    return monthly_report, report_content


def force_regenerate_monthly_yuntaek_data(user, year, month):
    """
    개발용 강제 재생성.
    기존 월간 스냅샷이 있어도 윤택지수와 리포트를 다시 계산하여 덮어씁니다.
    """
    from apps.users.yuntaek_score import get_yuntaek_score
    from external.ai.client import AIClient

    score_data = get_yuntaek_score(user, year, month)
    saved_score = force_save_score_snapshot(user, year, month, score_data)

    report_data = collect_report_data(user, year, month, score_data=saved_score.score_snapshot)
    client = AIClient(purpose="analysis")
    ai_result = client.generate_monthly_report(report_data)
    if not ai_result or not isinstance(ai_result, dict):
        raise ValueError('리포트 형식이 올바르지 않습니다.')

    saved_report, report_content = force_save_report_and_persona(user, year, month, ai_result)
    return saved_score.score_snapshot, report_content, saved_score, saved_report

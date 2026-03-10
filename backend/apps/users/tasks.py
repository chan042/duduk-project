"""
Celery tasks for user-related operations
"""
from celery import shared_task
from django.contrib.auth import get_user_model
from django.utils import timezone
import logging

logger = logging.getLogger(__name__)

User = get_user_model()


@shared_task
def generate_monthly_reports_for_all_users():
    """
    매월 1일 00시에 실행되어 모든 사용자의 전월 윤택지수 및 AI 리포트를 생성합니다.
    윤택지수와 AI 리포트 생성 후 통합 알림을 발송합니다.
    이 작업은 Celery Beat 스케줄러에 의해 자동으로 실행됩니다.
    """
    from apps.users.models import MonthlyReport
    from external.ai.client import AIClient
    from apps.users.services import (
        get_previous_month,
        is_new_user_for_month,
        collect_report_data,
        ensure_score_snapshot,
        save_report_and_persona,
    )
    from apps.notifications.services import create_monthly_report_notification

    now = timezone.localdate()
    year, month = get_previous_month(now.year, now.month)

    logger.info(f"월간 리포트 배치 작업 시작: {year}년 {month}월")

    users = User.objects.all()
    success_count = 0
    fail_count = 0

    for user in users:
        try:
            # 신규 사용자 스킵
            if is_new_user_for_month(user, year, month):
                logger.info(f"사용자 {user.id}는 {year}년 {month}월 신규 사용자입니다. 리포트 생성 스킵.")
                continue

            # 윤택지수 스냅샷 생성
            try:
                score_data, _, _ = ensure_score_snapshot(user, year, month)
                logger.info(f"사용자 {user.id}의 윤택지수 스냅샷 생성 완료")
            except Exception as e:
                logger.error(f"사용자 {user.id}의 윤택지수 스냅샷 생성 실패: {e}")
                fail_count += 1
                continue

            # 이미 해당 월의 AI 리포트가 있으면 스킵
            existing_report = MonthlyReport.objects.filter(user=user, year=year, month=month).first()
            if existing_report and existing_report.report_content:
                logger.info(f"사용자 {user.id}의 {year}년 {month}월 AI 리포트는 이미 존재합니다.")
                continue

            # 데이터 수집 + AI 리포트 생성
            report_data = collect_report_data(user, year, month, score_data=score_data)
            client = AIClient(purpose="analysis")
            ai_result = client.generate_monthly_report(report_data)

            if not ai_result or not isinstance(ai_result, dict):
                logger.error(f"사용자 {user.id}의 리포트 생성 실패: 잘못된 응답 형식")
                fail_count += 1
                continue

            # 리포트 저장 + 페르소나 업데이트
            save_report_and_persona(user, year, month, ai_result)
            
            # 월간 리포트 생성 알림 (윤택지수 + AI 리포트 통합)
            create_monthly_report_notification(user, year, month)
            
            logger.info(f"사용자 {user.id}의 {year}년 {month}월 윤택지수 및 AI 리포트 생성 완료")
            success_count += 1

        except Exception as e:
            logger.error(f"사용자 {user.id}의 리포트 생성 중 오류 발생: {e}", exc_info=True)
            fail_count += 1
            continue

    logger.info(f"월간 리포트 배치 작업 완료: 성공 {success_count}건, 실패 {fail_count}건")

    return {
        'year': year,
        'month': month,
        'success_count': success_count,
        'fail_count': fail_count,
        'total_users': users.count()
    }

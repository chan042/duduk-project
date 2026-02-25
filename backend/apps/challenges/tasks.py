import logging

from celery import shared_task
from django.core.management import call_command


logger = logging.getLogger(__name__)


@shared_task
def run_daily_challenge_checks(run_date=None, dry_run=False):
    """
    일일 챌린지 판정 배치 실행 태스크.
    """
    command_kwargs = {}
    if run_date:
        command_kwargs["date"] = run_date
    if dry_run:
        command_kwargs["dry_run"] = True

    logger.info(
        "Run daily challenge checks task started (date=%s, dry_run=%s)",
        run_date,
        dry_run,
    )
    call_command("check_daily_challenges", **command_kwargs)
    logger.info("Run daily challenge checks task completed")

    return {
        "date": run_date,
        "dry_run": dry_run,
    }

"""
일일 챌린지 체크 명령어

매일 00:01 실행을 기준으로 다음을 처리한다.
1. 일일 실패 조건(미라클 두둑/현금/원플원) 점검
2. 진행률 일괄 갱신(거래가 없던 날 포함)
3. 종료 시점 도달 챌린지 자동 완료/실패 판정
4. 미래의 나에게 메시지 알림(다음 달 1일)
"""
from datetime import timedelta, date, datetime, time

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from apps.challenges.models import UserChallenge
from apps.challenges.signals import _update_challenge_progress
from apps.challenges.constants import (
    CONVENIENCE_STORE_KEYWORDS,
    CONDITION_TYPE_DAILY_CHECK,
    CONDITION_TYPE_AMOUNT_LIMIT_WITH_PHOTO,
    CONDITION_TYPE_PHOTO_VERIFICATION,
    COMPARE_TYPE_NEXT_MONTH_CATEGORY,
)
from apps.challenges.services.failure_reason import (
    reason_daily_check_missing,
    reason_photo_not_verified_yesterday,
    reason_one_plus_one_photo_missing,
)
from apps.challenges.services.daily_check_sync import (
    ensure_daily_check_logs,
    sync_daily_check_logs_from_confirmations,
    is_no_spending_confirmed,
)
from apps.challenges.services.finalization import finalize_expired_challenge
from apps.challenges.services.lifecycle import get_challenge_end_date, get_challenge_start_date
from apps.notifications.services import create_challenge_notification


def _contains_convenience_store_keyword(text: str) -> bool:
    lowered = (text or "").lower()
    return any(keyword in lowered for keyword in CONVENIENCE_STORE_KEYWORDS)


def _count_verified_photos(log) -> int:
    return sum(1 for photo in (log.photo_urls or []) if photo.get("verified", False))


def _sum_convenience_spending(log) -> int:
    spent_by_store = (log.condition_detail or {}).get("spent_by_store", {})
    convenience_spent = 0
    for store_name, amount in spent_by_store.items():
        if _contains_convenience_store_keyword(store_name):
            convenience_spent += amount
    return convenience_spent


class Command(BaseCommand):
    help = "일일 챌린지 체크 - 매일 00:01에 실행"

    def add_arguments(self, parser):
        parser.add_argument(
            "--date",
            type=str,
            help="판정 기준 날짜(YYYY-MM-DD). 기본값은 오늘",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="DB를 변경하지 않고 결과만 출력",
        )

    def handle(self, *args, **options):
        run_date_raw = options.get("date")
        dry_run = bool(options.get("dry_run"))

        if run_date_raw:
            try:
                today = date.fromisoformat(run_date_raw)
            except ValueError as exc:
                raise CommandError("`--date`는 YYYY-MM-DD 형식이어야 합니다.") from exc
            now = timezone.make_aware(
                datetime.combine(today, time(hour=0, minute=1)),
                timezone.get_current_timezone(),
            )
        else:
            now = timezone.now()
            today = timezone.localdate()

        yesterday = today - timedelta(days=1)

        self.stdout.write(f"일일 챌린지 체크 시작: {now} (dry_run={dry_run})")
        self.stdout.write(f"판정 기준일(today): {today}, 체크 대상 날짜(일일 실패): {yesterday}")

        active_challenges = UserChallenge.objects.filter(status="active").select_related("user")

        failed_count = 0
        finalized_count = 0

        for uc in active_challenges:
            if not uc.started_at:
                continue

            # daily_check 타입은 누락 로그를 미리 생성 (진행률/실패 판정 안정화)
            success_conditions = uc.success_conditions or {}
            if success_conditions.get("type") == CONDITION_TYPE_DAILY_CHECK:
                if not dry_run:
                    start_date = get_challenge_start_date(uc)
                    end_date = min(today, get_challenge_end_date(uc) or today)
                    if not start_date:
                        continue
                    ensure_daily_check_logs(uc, end_date)
                    sync_daily_check_logs_from_confirmations(uc, start_date, end_date)

            # 1) 거래가 없던 날도 progress가 갱신되도록 일괄 업데이트
            start_date = get_challenge_start_date(uc)
            if start_date and start_date <= today and not dry_run:
                _update_challenge_progress(uc)

            if uc.status != "active":
                continue

            # 2) 전일 미입력/미인증 실패 조건 체크
            if start_date and start_date <= yesterday:
                success_conditions = uc.success_conditions or {}
                condition_type = success_conditions.get("type", "")

                if condition_type == CONDITION_TYPE_DAILY_CHECK:
                    if self._check_daily_check_failure(uc, yesterday, dry_run=dry_run):
                        failed_count += 1
                        self.stdout.write(self.style.WARNING(f"미라클 두둑! 실패: {uc.user.username} - {uc.name}"))
                        continue

                elif condition_type == CONDITION_TYPE_AMOUNT_LIMIT_WITH_PHOTO:
                    if self._check_photo_missing_failure(uc, yesterday, dry_run=dry_run):
                        failed_count += 1
                        self.stdout.write(self.style.WARNING(f"현금 챌린지 실패: {uc.user.username} - {uc.name}"))
                        continue

                elif condition_type == CONDITION_TYPE_PHOTO_VERIFICATION:
                    photo_condition = success_conditions.get("photo_condition", "")
                    if "1+1" in photo_condition and self._check_one_plus_one_failure(
                        uc, yesterday, dry_run=dry_run
                    ):
                        failed_count += 1
                        self.stdout.write(self.style.WARNING(f"원플원 러버 실패: {uc.user.username} - {uc.name}"))
                        continue

            if uc.status != "active":
                continue

            # 3) 미래의 나에게: 다음 달 1일 메시지 알림
            if not dry_run:
                self._send_future_message_notification(uc, today)

            # 4) 종료 시점 자동 판정
            if finalize_expired_challenge(uc, reference=today, dry_run=dry_run):
                finalized_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"일일 챌린지 체크 완료: 실패 처리 {failed_count}건, 종료 판정 {finalized_count}건"
            )
        )

    def _check_daily_check_failure(self, user_challenge, check_date, dry_run=False):
        """
        미라클 두둑:
        - 전날 지출 입력(거래 발생) 또는 무지출 체크가 없으면 실패
        """
        start_date = get_challenge_start_date(user_challenge)
        if not start_date:
            return False
        if check_date < start_date:
            return False

        log = user_challenge.daily_logs.filter(log_date=check_date).first()
        has_input = bool(log and (log.is_checked or (log.transaction_count or 0) > 0))
        if not has_input and is_no_spending_confirmed(user_challenge.user_id, check_date):
            has_input = True

        if not has_input:
            if not dry_run:
                user_challenge.complete_challenge(
                    False,
                    user_challenge.progress.get("current", 0),
                    failure_reason=reason_daily_check_missing(),
                )
            return True

        return False

    def _check_photo_missing_failure(self, user_challenge, check_date, dry_run=False):
        """
        현금 챌린지: 전날 사진 미인증 시 실패
        """
        start_date = get_challenge_start_date(user_challenge)
        if not start_date:
            return False
        if check_date < start_date:
            return False

        log = user_challenge.daily_logs.filter(log_date=check_date).first()
        if not log or _count_verified_photos(log) == 0:
            if not dry_run:
                user_challenge.complete_challenge(
                    False,
                    user_challenge.progress.get("current", 0),
                    failure_reason=reason_photo_not_verified_yesterday(),
                )
            return True

        return False

    def _check_one_plus_one_failure(self, user_challenge, check_date, dry_run=False):
        """
        원플원 러버: 전날 편의점 소비가 있었는데 사진 인증이 없으면 실패
        """
        start_date = get_challenge_start_date(user_challenge)
        if not start_date:
            return False
        if check_date < start_date:
            return False

        log = user_challenge.daily_logs.filter(log_date=check_date).first()
        if not log:
            return False

        convenience_spent = _sum_convenience_spending(log)
        if convenience_spent > 0 and _count_verified_photos(log) == 0:
            if not dry_run:
                user_challenge.complete_challenge(
                    False,
                    user_challenge.progress.get("current", 0),
                    failure_reason=reason_one_plus_one_photo_missing(),
                )
            return True

        return False

    def _send_future_message_notification(self, user_challenge, today: date):
        """
        미래의 나에게:
        시작 다음 달 1일에 사용자의 입력 메시지 알림 발송
        """
        success_conditions = user_challenge.success_conditions or {}
        if success_conditions.get("compare_type") != COMPARE_TYPE_NEXT_MONTH_CATEGORY:
            return

        if not user_challenge.started_at:
            return

        start_date = get_challenge_start_date(user_challenge)
        if not start_date:
            return

        start_year = start_date.year
        start_month = start_date.month
        if start_month == 12:
            target_year, target_month = start_year + 1, 1
        else:
            target_year, target_month = start_year, start_month + 1

        if today != date(target_year, target_month, 1):
            return

        system_values = user_challenge.system_generated_values or {}
        if system_values.get("future_message_notified", False):
            return

        message = (user_challenge.user_input_values or {}).get("message_to_future")
        if message:
            create_challenge_notification(
                user=user_challenge.user,
                title="미래의 나에게",
                message=message,
            )

        system_values["future_message_notified"] = True
        user_challenge.system_generated_values = system_values
        user_challenge.save(update_fields=["system_generated_values", "updated_at"])

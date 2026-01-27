"""
일일 챌린지 체크 명령어

이 명령어는 매일 00:01에 cron으로 실행되어야 합니다.
crontab 설정 예시: 1 0 * * * cd /path/to/project && python manage.py check_daily_challenges

체크 항목:
1. 미라클 두둑! - 전날 자정까지 지출/무지출 입력 없으면 즉시 실패
2. 현금 챌린지 - 전날 사진 미인증 시 즉시 실패
3. 원플원 러버 - 전날 편의점 지출에 대해 사진 미인증 시 즉시 실패
"""
from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from apps.challenges.models import UserChallenge, ChallengeDailyLog


class Command(BaseCommand):
    help = '일일 챌린지 체크 - 매일 00:01에 실행'

    def handle(self, *args, **options):
        now = timezone.now()
        yesterday = (now - timedelta(days=1)).date()

        self.stdout.write(f'일일 챌린지 체크 시작: {now}')
        self.stdout.write(f'체크 대상 날짜: {yesterday}')

        # 진행 중인 챌린지 조회
        active_challenges = UserChallenge.objects.filter(
            status='active',
            started_at__date__lte=yesterday
        )

        failed_count = 0

        for uc in active_challenges:
            success_conditions = uc.success_conditions or {}
            condition_type = success_conditions.get('type', '')

            # 1. 미라클 두둑! - daily_check 타입
            if condition_type == 'daily_check':
                if self._check_daily_check_failure(uc, yesterday):
                    failed_count += 1
                    self.stdout.write(
                        self.style.WARNING(f'미라클 두둑! 실패: {uc.user.username} - {uc.name}')
                    )

            # 2. 현금 챌린지 - amount_limit_with_photo 타입
            elif condition_type == 'amount_limit_with_photo':
                if self._check_photo_missing_failure(uc, yesterday):
                    failed_count += 1
                    self.stdout.write(
                        self.style.WARNING(f'현금 챌린지 실패: {uc.user.username} - {uc.name}')
                    )

            # 3. 원플원 러버 - photo_verification with 1+1
            elif condition_type == 'photo_verification':
                photo_condition = success_conditions.get('photo_condition', '')
                if '1+1' in photo_condition:
                    if self._check_one_plus_one_failure(uc, yesterday):
                        failed_count += 1
                        self.stdout.write(
                            self.style.WARNING(f'원플원 러버 실패: {uc.user.username} - {uc.name}')
                        )

        self.stdout.write(
            self.style.SUCCESS(f'일일 챌린지 체크 완료: {failed_count}개 챌린지 실패 처리')
        )

    def _check_daily_check_failure(self, user_challenge, check_date):
        """
        미라클 두둑!: 전날 체크 안했으면 실패
        """
        # 챌린지 시작일 이후인지 확인
        start_date = user_challenge.started_at.date()
        if check_date < start_date:
            return False

        # 전날 로그 확인
        log = user_challenge.daily_logs.filter(log_date=check_date).first()

        # 체크가 안되어 있으면 실패
        if not log or not log.is_checked:
            user_challenge.complete_challenge(False, user_challenge.progress.get('current', 0))
            return True

        return False

    def _check_photo_missing_failure(self, user_challenge, check_date):
        """
        현금 챌린지: 전날 사진 미인증 시 실패
        """
        start_date = user_challenge.started_at.date()
        if check_date < start_date:
            return False

        log = user_challenge.daily_logs.filter(log_date=check_date).first()

        # 사진이 없으면 실패
        if not log or not log.photo_urls:
            user_challenge.complete_challenge(False, user_challenge.progress.get('current', 0))
            return True

        return False

    def _check_one_plus_one_failure(self, user_challenge, check_date):
        """
        원플원 러버: 전날 편의점 지출에 대해 사진 미인증 시 실패
        """
        start_date = user_challenge.started_at.date()
        if check_date < start_date:
            return False

        log = user_challenge.daily_logs.filter(log_date=check_date).first()

        if log:
            spent_by_category = log.spent_by_category or {}
            convenience_spent = spent_by_category.get('편의점', 0)

            # 편의점 지출이 있는데 사진 인증이 없으면 실패
            if convenience_spent > 0 and not log.photo_urls:
                user_challenge.complete_challenge(False, user_challenge.progress.get('current', 0))
                return True

        return False

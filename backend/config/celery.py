"""
Celery 설정 파일
"""
from __future__ import absolute_import, unicode_literals
import os
from celery import Celery
from celery.schedules import crontab

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

app = Celery('duduk_project')

app.config_from_object('django.conf:settings', namespace='CELERY')

app.autodiscover_tasks()

# Celery Beat 스케줄 설정
app.conf.beat_schedule = {
    'check-daily-challenges': {
        'task': 'apps.challenges.tasks.run_daily_challenge_checks',
        'schedule': crontab(hour=0, minute=1),  # 매일 00:01
    },
    'generate-monthly-reports': {
        'task': 'apps.users.tasks.generate_monthly_reports_for_all_users',
        'schedule': crontab(hour=0, minute=0, day_of_month=1),  # 매월 1일 00:00
    },
}

# Timezone 설정
app.conf.timezone = 'Asia/Seoul'

@app.task(bind=True)
def debug_task(self):
    print(f'Request: {self.request!r}')

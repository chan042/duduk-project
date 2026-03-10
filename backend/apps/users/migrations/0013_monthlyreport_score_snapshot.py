from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0012_add_ai_persona_summary'),
    ]

    operations = [
        migrations.AddField(
            model_name='monthlyreport',
            name='score_error',
            field=models.TextField(blank=True, default='', verbose_name='점수 생성 오류'),
        ),
        migrations.AddField(
            model_name='monthlyreport',
            name='score_generated_at',
            field=models.DateTimeField(blank=True, null=True, verbose_name='점수 생성일시'),
        ),
        migrations.AddField(
            model_name='monthlyreport',
            name='score_snapshot',
            field=models.JSONField(blank=True, default=dict, verbose_name='윤택지수 스냅샷'),
        ),
        migrations.AddField(
            model_name='monthlyreport',
            name='score_status',
            field=models.CharField(
                choices=[('PENDING', '대기'), ('READY', '완료'), ('FAILED', '실패')],
                default='PENDING',
                max_length=20,
                verbose_name='점수 상태',
            ),
        ),
    ]

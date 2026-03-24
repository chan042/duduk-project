from django.db import migrations, models


def cleanup_event_sources_and_archive_completed(apps, schema_editor):
    ChallengeTemplate = apps.get_model("challenges", "ChallengeTemplate")
    UserChallenge = apps.get_model("challenges", "UserChallenge")

    ChallengeTemplate.objects.filter(source_type="event").update(
        source_type="duduk",
        is_active=False,
    )
    UserChallenge.objects.filter(source_type="event").update(source_type="duduk")

    completed_challenges = UserChallenge.objects.filter(
        status="completed",
        reward_claimed_at__isnull=True,
    )
    for challenge in completed_challenges.iterator():
        challenge.reward_claimed_at = challenge.completed_at or challenge.updated_at or challenge.created_at
        challenge.is_current_attempt = False
        challenge.save(update_fields=["reward_claimed_at", "is_current_attempt"])


class Migration(migrations.Migration):

    dependencies = [
        ("challenges", "0013_userchallenge_attempt_grouping"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="challengetemplate",
            name="event_banner_url",
        ),
        migrations.RemoveField(
            model_name="challengetemplate",
            name="event_end_at",
        ),
        migrations.RemoveField(
            model_name="challengetemplate",
            name="event_start_at",
        ),
        migrations.AlterField(
            model_name="challengetemplate",
            name="source_type",
            field=models.CharField(
                choices=[("duduk", "두둑 챌린지")],
                default="duduk",
                max_length=20,
                verbose_name="챌린지 출처",
            ),
        ),
        migrations.AlterField(
            model_name="userchallenge",
            name="source_type",
            field=models.CharField(
                choices=[("duduk", "두둑 챌린지"), ("custom", "사용자 커스텀"), ("ai", "AI 맞춤")],
                default="duduk",
                max_length=20,
                verbose_name="챌린지 유형",
            ),
        ),
        migrations.AddField(
            model_name="userchallenge",
            name="reward_claimed_at",
            field=models.DateTimeField(blank=True, null=True, verbose_name="보상 수령일시"),
        ),
        migrations.RunPython(cleanup_event_sources_and_archive_completed, migrations.RunPython.noop),
    ]

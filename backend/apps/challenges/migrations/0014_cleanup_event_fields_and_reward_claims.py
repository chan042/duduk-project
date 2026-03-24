from django.db import migrations, models


def backfill_reward_claimed_at_and_normalize_userchallenge_sources(apps, schema_editor):
    UserChallenge = apps.get_model("challenges", "UserChallenge")

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
        migrations.RunPython(
            backfill_reward_claimed_at_and_normalize_userchallenge_sources,
            migrations.RunPython.noop,
        ),
    ]

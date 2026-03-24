from django.db import migrations, models


def migrate_ai_source_types(apps, schema_editor):
    UserChallenge = apps.get_model("challenges", "UserChallenge")

    UserChallenge.objects.filter(
        source_type="ai",
        source_coaching__isnull=False,
    ).update(source_type="coaching")

    UserChallenge.objects.filter(source_type="ai").update(source_type="custom")


class Migration(migrations.Migration):

    dependencies = [
        ("challenges", "0014_cleanup_event_fields_and_reward_claims"),
    ]

    operations = [
        migrations.RunPython(migrate_ai_source_types, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="userchallenge",
            name="source_type",
            field=models.CharField(
                choices=[
                    ("duduk", "두둑 챌린지"),
                    ("custom", "사용자 챌린지"),
                    ("coaching", "코칭 챌린지"),
                ],
                default="duduk",
                max_length=20,
                verbose_name="챌린지 유형",
            ),
        ),
    ]

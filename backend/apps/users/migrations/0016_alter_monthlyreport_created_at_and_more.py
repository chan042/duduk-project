from django.db import migrations, models
import django.db.models.deletion


def backfill_social_accounts(apps, schema_editor):
    User = apps.get_model('users', 'User')
    SocialAccount = apps.get_model('users', 'SocialAccount')

    for user in User.objects.exclude(social_id__isnull=True).exclude(social_id=''):
        if user.auth_provider not in {'google', 'kakao'}:
            continue

        SocialAccount.objects.get_or_create(
            provider=user.auth_provider,
            provider_user_id=str(user.social_id),
            defaults={
                'user': user,
                'email': user.email,
                'email_verified': bool(user.email),
                'display_name': user.username or '',
            },
        )


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ('users', '0015_remove_user_has_children'),
    ]

    operations = [
        migrations.AlterField(
            model_name='user',
            name='auth_provider',
            field=models.CharField(
                choices=[('email', 'Email'), ('google', 'Google'), ('kakao', 'Kakao')],
                default='email',
                max_length=50,
                verbose_name='인증 제공자',
            ),
        ),
        migrations.CreateModel(
            name='SocialAccount',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('provider', models.CharField(choices=[('google', 'Google'), ('kakao', 'Kakao')], max_length=20)),
                ('provider_user_id', models.CharField(max_length=255)),
                ('email', models.EmailField(blank=True, max_length=254, null=True)),
                ('email_verified', models.BooleanField(default=False)),
                ('display_name', models.CharField(blank=True, default='', max_length=255)),
                ('profile_image_url', models.URLField(blank=True, default='')),
                ('raw_profile', models.JSONField(blank=True, default=dict)),
                ('last_login_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                (
                    'user',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='social_accounts',
                        to='users.user',
                    ),
                ),
            ],
            options={
                'constraints': [
                    models.UniqueConstraint(
                        fields=('provider', 'provider_user_id'),
                        name='uniq_social_provider_user_id',
                    ),
                    models.UniqueConstraint(
                        fields=('user', 'provider'),
                        name='uniq_social_user_provider',
                    ),
                ],
            },
        ),
        migrations.RunPython(backfill_social_accounts, noop_reverse),
    ]

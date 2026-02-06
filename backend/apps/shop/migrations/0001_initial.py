from django.db import migrations, models
import django.db.models.deletion
from django.conf import settings

class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='ShopItem',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100, verbose_name='상품 이름')),
                ('category', models.CharField(choices=[('CLOTHING', '의류'), ('ITEM', '아이템'), ('BACKGROUND', '배경')], max_length=20, verbose_name='카테고리')),
                ('price', models.IntegerField(verbose_name='가격')),
                ('is_rare', models.BooleanField(default=False, verbose_name='레어템 여부')),
                ('image_url', models.CharField(max_length=255, verbose_name='이미지 경로')),
                ('description', models.TextField(blank=True, verbose_name='상품 설명')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='등록일')),
                ('is_active', models.BooleanField(default=True, verbose_name='판매 중 여부')),
            ],
            options={
                'verbose_name': '상점 아이템',
                'verbose_name_plural': '상점 아이템 목록',
                'ordering': ['category', 'price'],
            },
        ),
        migrations.CreateModel(
            name='UserInventory',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('acquired_at', models.DateTimeField(auto_now_add=True, verbose_name='획득 일시')),
                ('acquired_by', models.CharField(choices=[('PURCHASE', '구매'), ('GACHA', '가챠')], max_length=20, verbose_name='획득 경로')),
                ('shop_item', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='owners', to='shop.shopitem', verbose_name='보유 아이템')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='inventory', to=settings.AUTH_USER_MODEL, verbose_name='사용자')),
            ],
            options={
                'verbose_name': '사용자 인벤토리',
                'verbose_name_plural': '사용자 인벤토리 목록',
                'ordering': ['-acquired_at'],
            },
        ),
    ]

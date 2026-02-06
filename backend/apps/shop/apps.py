from django.apps import AppConfig

class ShopConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.shop'
    verbose_name = '상점'  # 관리자 페이지에서 보일 이름

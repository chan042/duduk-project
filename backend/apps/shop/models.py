from django.db import models
from django.conf import settings

class ShopItem(models.Model):
    """
    상점에서 판매되는 상품 정보를 저장하는 모델입니다.
    """
    CATEGORY_CHOICES = [
        ('CLOTHING', '의류'),
        ('ITEM', '아이템'),
        ('BACKGROUND', '배경'),
    ]

    name = models.CharField(max_length=100, verbose_name='상품 이름')
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, verbose_name='카테고리')
    price = models.IntegerField(verbose_name='가격')
    is_rare = models.BooleanField(default=False, verbose_name='레어템 여부')
    image_url = models.CharField(max_length=255, verbose_name='이미지 경로')
    image_key = models.CharField(max_length=50, blank=True, verbose_name='이미지 조합 키')
    description = models.TextField(blank=True, verbose_name='상품 설명')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='등록일')
    is_active = models.BooleanField(default=True, verbose_name='판매 중 여부')

    class Meta:
        ordering = ['category', 'price']
        verbose_name = '상점 아이템'
        verbose_name_plural = '상점 아이템 목록'

    def __str__(self):
        return f"[{self.get_category_display()}] {self.name} ({self.price}P)"


class UserInventory(models.Model):
    """
    사용자가 보유한 아이템 정보를 저장하는 모델입니다.
    """
    ACQUIRED_BY_CHOICES = [
        ('PURCHASE', '구매'),
        ('GACHA', '가챠'),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='inventory', verbose_name='사용자')
    shop_item = models.ForeignKey(ShopItem, on_delete=models.CASCADE, related_name='owners', verbose_name='보유 아이템')
    acquired_at = models.DateTimeField(auto_now_add=True, verbose_name='획득 일시')
    acquired_by = models.CharField(max_length=20, choices=ACQUIRED_BY_CHOICES, verbose_name='획득 경로')

    class Meta:
        ordering = ['-acquired_at']
        verbose_name = '사용자 인벤토리'
        verbose_name_plural = '사용자 인벤토리 목록'
        # 같은 아이템 중복 보유 가능한지 여부에 따라 unique_together 설정
        # 현재 기획상 중복 보유 관련 언급이 없으나, 보통 의상/배경은 하나만 있으면 되므로 중복 방지 설정
        # 만약 소모성 아이템이라면 중복 허용해야 함. 여기서는 의상/배경 위주이므로 중복 방지.
        # 가챠 중복 당첨 가능하다고 했으므로 unique_together는 제거하거나 확인 필요. 
        # "가챠는 중복 당첨 가능하므로 중복 체크 안 함" 이라고 명시되어 있으므로 unique_together 사용 안함.

    def __str__(self):
        return f"{self.user.username} - {self.shop_item.name}"


class UserEquipped(models.Model):
    """
    사용자의 현재 착장 상태를 저장하는 모델입니다.
    유저당 하나의 레코드만 존재합니다.
    """
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='equipped',
        verbose_name='사용자'
    )
    clothing = models.ForeignKey(
        ShopItem,
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='equipped_as_clothing',
        verbose_name='착용 의상'
    )
    item = models.ForeignKey(
        ShopItem,
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='equipped_as_item',
        verbose_name='착용 아이템'
    )
    background = models.ForeignKey(
        ShopItem,
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='equipped_as_background',
        verbose_name='적용 배경'
    )
    updated_at = models.DateTimeField(auto_now=True, verbose_name='마지막 수정일')

    class Meta:
        verbose_name = '사용자 착장'
        verbose_name_plural = '사용자 착장 목록'

    def __str__(self):
        return f"{self.user.username} 착장"

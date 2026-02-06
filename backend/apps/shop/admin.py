from django.contrib import admin
from .models import ShopItem, UserInventory

@admin.register(ShopItem)
class ShopItemAdmin(admin.ModelAdmin):
    """
    ShopItem 모델을 관리자 페이지에 등록합니다.
    """
    list_display = ('id', 'name', 'category', 'price', 'is_rare', 'is_active', 'created_at')
    list_filter = ('category', 'is_rare', 'is_active')
    search_fields = ('name', 'description')
    list_editable = ('price', 'is_active') # 목록에서 바로 수정 가능
    ordering = ('category', 'price')

@admin.register(UserInventory)
class UserInventoryAdmin(admin.ModelAdmin):
    """
    UserInventory 모델을 관리자 페이지에 등록합니다.
    """
    list_display = ('user', 'shop_item', 'acquired_by', 'acquired_at')
    list_filter = ('acquired_by', 'acquired_at')
    search_fields = ('user__username', 'shop_item__name')
    readonly_fields = ('acquired_at',)

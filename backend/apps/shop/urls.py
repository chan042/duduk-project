from django.urls import path
from .views import (
    ShopItemListView,
    UserInventoryView,
    UserPointView,
    PurchaseItemView,
    GachaView,
    UserEquippedView,
)

urlpatterns = [
    # 상품 목록 조회 (GET /api/shop/items/?category=...)
    path('items/', ShopItemListView.as_view(), name='shop-item-list'),
    
    # 사용자 인벤토리 조회 (GET /api/shop/inventory/)
    path('inventory/', UserInventoryView.as_view(), name='user-inventory'),
    
    # 사용자 포인트 조회 (GET /api/shop/points/)
    path('points/', UserPointView.as_view(), name='user-point'),
    
    # 상품 구매 (POST /api/shop/purchase/)
    path('purchase/', PurchaseItemView.as_view(), name='purchase-item'),
    
    # 가챠 실행 (POST /api/shop/gacha/)
    path('gacha/', GachaView.as_view(), name='gacha'),

    # 착장 조회/저장 (GET,PUT /api/shop/equipped/)
    path('equipped/', UserEquippedView.as_view(), name='user-equipped'),
]

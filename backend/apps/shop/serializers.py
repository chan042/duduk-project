from rest_framework import serializers
from .models import ShopItem, UserInventory
from apps.users.models import User

class ShopItemSerializer(serializers.ModelSerializer):
    """
    ShopItem 모델을 위한 시리얼라이저입니다.
    사용자의 보유 여부(is_owned) 필드를 추가로 반환합니다.
    """
    is_owned = serializers.SerializerMethodField(help_text="현재 사용자가 이 아이템을 보유하고 있는지 여부")

    class Meta:
        model = ShopItem
        fields = ['id', 'name', 'category', 'price', 'is_rare', 'image_url', 'description', 'is_owned']

    def get_is_owned(self, obj):
        """
        request.user가 해당 아이템을 가지고 있는지 확인합니다.
        """
        user = self.context.get('request').user
        if user.is_authenticated:
            return UserInventory.objects.filter(user=user, shop_item=obj).exists()
        return False

class UserInventorySerializer(serializers.ModelSerializer):
    """
    UserInventory 모델을 위한 시리얼라이저입니다.
    보유한 아이템의 상세 정보를 포함하여 반환합니다.
    """
    shop_item = ShopItemSerializer(read_only=True)

    class Meta:
        model = UserInventory
        fields = ['id', 'shop_item', 'acquired_at', 'acquired_by']

class PurchaseRequestSerializer(serializers.Serializer):
    """
    상품 구매 요청을 검증하기 위한 시리얼라이저입니다.
    """
    shop_item_id = serializers.IntegerField(help_text="구매할 상품의 ID")

    def validate_shop_item_id(self, value):
        """
        상품이 실제로 존재하는지, 구매 가능한 상태인지 확인합니다.
        """
        try:
            item = ShopItem.objects.get(id=value)
            if not item.is_active:
                raise serializers.ValidationError("판매 중인 상품이 아닙니다.")
            if item.is_rare:
                raise serializers.ValidationError("레어 아이템은 직접 구매할 수 없습니다. 가챠를 이용해주세요.")
        except ShopItem.DoesNotExist:
            raise serializers.ValidationError("존재하지 않는 상품입니다.")
        return value

class UserPointSerializer(serializers.ModelSerializer):
    """
    사용자의 포인트 정보를 반환하기 위한 시리얼라이저입니다.
    """
    class Meta:
        model = User
        fields = ['username', 'points']

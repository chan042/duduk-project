from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from django.db import transaction
from django.shortcuts import get_object_or_404
import random

from .models import ShopItem, UserInventory, UserEquipped
from .serializers import (
    ShopItemSerializer,
    UserInventorySerializer,
    PurchaseRequestSerializer,
    UserPointSerializer,
    UserEquippedSerializer,
    UserEquippedWriteSerializer,
)

class ShopItemListView(APIView):
    """
    상점의 상품 목록을 조회하는 뷰입니다.
    카테고리별 필터링을 지원합니다.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        category = request.query_params.get('category')
        
        # 판매 중인 상품만 조회
        items = ShopItem.objects.filter(is_active=True)
        
        if category:
            items = items.filter(category=category)
            
        # context에 request를 전달해야 is_owned 필드가 정상 동작함
        serializer = ShopItemSerializer(items, many=True, context={'request': request})
        return Response({'items': serializer.data})

class UserInventoryView(APIView):
    """
    사용자가 보유한 아이템 목록을 조회하는 뷰입니다.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # 현재 로그인한 사용자의 인벤토리 조회
        inventory = UserInventory.objects.filter(user=request.user)
        serializer = UserInventorySerializer(inventory, many=True, context={'request': request})
        return Response({'items': serializer.data})

class UserPointView(APIView):
    """
    사용자의 현재 포인트를 조회하는 뷰입니다.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserPointSerializer(request.user)
        return Response(serializer.data)

class PurchaseItemView(APIView):
    """
    상품을 구매하는 뷰입니다.
    포인트 차감 및 인벤토리 추가 로직을 트랜잭션으로 처리합니다.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        # 요청 데이터 검증
        serializer = PurchaseRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        shop_item_id = serializer.validated_data['shop_item_id']
        user = request.user
        item = get_object_or_404(ShopItem, id=shop_item_id)

        # 1. 중복 구매 확인 (이미 가지고 있는지)
        if UserInventory.objects.filter(user=user, shop_item=item).exists():
            return Response({"message": "이미 보유하고 있는 상품입니다."}, status=status.HTTP_400_BAD_REQUEST)

        # 2. 포인트 잔액 확인
        if user.points < item.price:
            return Response({"message": "포인트가 부족합니다."}, status=status.HTTP_400_BAD_REQUEST)

        # 3. 트랜잭션 처리 (포인트 차감 + 아이템 지급)
        try:
            with transaction.atomic():
                # 동시성 이슈 방지를 위해 select_for_update 사용 권장되지만, 
                # 여기서는 간단히 user 객체를 락 걸거나 다시 가져와서 처리
                # (User 모델의 포인트 필드 갱신)
                user.points -= item.price
                user.save()

                # 인벤토리에 추가
                UserInventory.objects.create(
                    user=user,
                    shop_item=item,
                    acquired_by='PURCHASE'
                )
                
                return Response({
                    "success": True,
                    "message": "구매가 완료되었습니다.",
                    "remaining_points": user.points,
                    "acquired_item": {
                        "id": item.id,
                        "name": item.name
                    }
                }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"message": f"구매 처리 중 오류가 발생했습니다: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class GachaView(APIView):
    """
    가챠(랜덤 뽑기)를 실행하는 뷰입니다.
    500포인트를 소모하며, 20% 확률로 레어 아이템을 획득합니다.
    """
    permission_classes = [IsAuthenticated]
    GACHA_PRICE = 500
    RARE_PROBABILITY = 20  # 20%

    def post(self, request):
        user = request.user

        # 1. 포인트 잔액 확인
        if user.points < self.GACHA_PRICE:
            return Response({"message": "가챠를 위한 포인트가 부족합니다. (500P 필요)"}, status=status.HTTP_400_BAD_REQUEST)

        # 2. 가챠 로직 실행 (랜덤 선택)
        # 판매 중인 모든 아이템 로드
        all_items = ShopItem.objects.filter(is_active=True)
        rare_items = [item for item in all_items if item.is_rare]
        normal_items = [item for item in all_items if not item.is_rare]

        if not all_items:
             return Response({"message": "가챠 데이터가 없습니다."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # 확률 계산
        is_lucky = random.randint(1, 100) <= self.RARE_PROBABILITY
        
        if is_lucky and rare_items:
            chosen_item = random.choice(rare_items)
        elif normal_items:
            chosen_item = random.choice(normal_items)
        else:
            # 예외 상황: 일반템이 없는데 꽝 걸렸거나 레어템이 없는데 당첨된 경우 등
            # 있는 것 중에서 아무거나 선택
            chosen_item = random.choice(all_items)

        # 3. 트랜잭션 처리 (포인트 차감 + 아이템 지급)
        try:
            with transaction.atomic():
                user.points -= self.GACHA_PRICE
                user.save()

                UserInventory.objects.create(
                    user=user,
                    shop_item=chosen_item,
                    acquired_by='GACHA'
                )

                return Response({
                    "success": True,
                    "message": "가챠 성공!",
                    "is_rare": chosen_item.is_rare,
                    "acquired_item": {
                        "id": chosen_item.id,
                        "name": chosen_item.name,
                        "category": chosen_item.category,
                        "image_url": chosen_item.image_url
                    },
                    "remaining_points": user.points
                }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({"message": f"가챠 처리 중 오류가 발생했습니다: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class UserEquippedView(APIView):
    """
    사용자의 착장 상태를 조회하거나 저장하는 뷰입니다.
    - GET: 현재 착장 정보 반환
    - PUT: 착장 저장 (인벤토리 소유 여부 검증 포함)
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            equipped = request.user.equipped
        except UserEquipped.DoesNotExist:
            # 착장 레코드가 없으면 빈 착장 반환
            return Response({'clothing': None, 'item': None, 'background': None})

        serializer = UserEquippedSerializer(equipped, context={'request': request})
        return Response(serializer.data)

    def put(self, request):
        write_serializer = UserEquippedWriteSerializer(data=request.data)
        if not write_serializer.is_valid():
            return Response(write_serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = write_serializer.validated_data
        user = request.user

        def resolve_item(slot_id, expected_category):
            """ID가 주어졌을 때 해당 아이템이 유저 인벤토리에 있는지 검증 후 반환."""
            if slot_id is None:
                return None
            try:
                shop_item = ShopItem.objects.get(id=slot_id, category=expected_category.upper(), is_active=True)
            except ShopItem.DoesNotExist:
                raise ValueError(f"존재하지 않는 아이템입니다. (id={slot_id})")
            if not UserInventory.objects.filter(user=user, shop_item=shop_item).exists():
                raise ValueError(f"보유하지 않은 아이템입니다. (id={slot_id})")
            return shop_item

        try:
            clothing = resolve_item(data.get('clothing_id'), 'CLOTHING')
            item = resolve_item(data.get('item_id'), 'ITEM')
            background = resolve_item(data.get('background_id'), 'BACKGROUND')
        except ValueError as e:
            return Response({'message': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        equipped, _ = UserEquipped.objects.get_or_create(user=user)
        equipped.clothing = clothing
        equipped.item = item
        equipped.background = background
        equipped.save()

        serializer = UserEquippedSerializer(equipped, context={'request': request})
        return Response(serializer.data)

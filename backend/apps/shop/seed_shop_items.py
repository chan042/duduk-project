from apps.shop.models import ShopItem


SHOP_ITEMS = [
    # Clothing
    {
        "name": "교복",
        "category": "CLOTHING",
        "price": 400,
        "is_rare": False,
        "image_url": "/images/items/school_uniform.png",
        "image_key": "school_uniform",
        "description": "엘리트처럼 보이는 교복입니다.",
        "is_active": True,
    },
    {
        "name": "회색 후드티",
        "category": "CLOTHING",
        "price": 300,
        "is_rare": False,
        "image_url": "/images/items/gray_hoodie.png",
        "image_key": "gray_hoodie",
        "description": "편안한 회색 후드티입니다.",
        "is_active": True,
    },
    {
        "name": "휴양지룩",
        "category": "CLOTHING",
        "price": 500,
        "is_rare": False,
        "image_url": "/images/items/summer.png",
        "image_key": "summer",
        "description": "휴양지에 온 듯한 느낌을 주는 하와이안 셔츠와 오리 튜브입니다.",
        "is_active": True,
    },
    {
        "name": "세종대왕 의상",
        "category": "CLOTHING",
        "price": 3000,
        "is_rare": True,
        "image_url": "/images/items/king.png",
        "image_key": "king",
        "description": "우리나라를 빛낸 세종대왕이 입었던 의상입니다.",
        "is_active": True,
    },
    {
        "name": "셜록 의상",
        "category": "CLOTHING",
        "price": 1200,
        "is_rare": False,
        "image_url": "/images/items/Sherlock.png",
        "image_key": "Sherlock",
        "description": "탐정처럼 날카로운 분위기를 더해주는 셜록 스타일 의상입니다.",
        "is_active": True,
    },
    {
        "name": "우주복",
        "category": "CLOTHING",
        "price": 3500,
        "is_rare": True,
        "image_url": "/images/items/spacesuit.png",
        "image_key": "space_suit",
        "description": "반짝이는 우주 탐험가 분위기를 연출하는 우주복입니다.",
        "is_active": True,
    },
    # Item
    {
        "name": "검은 안경",
        "category": "ITEM",
        "price": 200,
        "is_rare": False,
        "image_url": "/images/items/black_glasses.png",
        "image_key": "black_glasses",
        "description": "지적인 이미지를 주는 검은 안경입니다.",
        "is_active": True,
    },
    {
        "name": "선글라스",
        "category": "ITEM",
        "price": 400,
        "is_rare": False,
        "image_url": "/images/items/sunglasses.png",
        "image_key": "sunglasses",
        "description": "멋진 느낌을 주는 선글라스입니다.",
        "is_active": True,
    },
    {
        "name": "콧수염",
        "category": "ITEM",
        "price": 250,
        "is_rare": False,
        "image_url": "/images/items/moustache.png",
        "image_key": "moustache",
        "description": "한 번에 분위기를 바꿔주는 클래식한 콧수염입니다.",
        "is_active": True,
    },
    # Background
    {
        "name": "도서관 배경",
        "category": "BACKGROUND",
        "price": 800,
        "is_rare": False,
        "image_url": "/images/backgrounds/library.png",
        "image_key": "library",
        "description": "책이 가득한 도서관 배경입니다.",
        "is_active": True,
    },
    {
        "name": "우주 배경",
        "category": "BACKGROUND",
        "price": 5000,
        "is_rare": True,
        "image_url": "/images/backgrounds/space.png",
        "image_key": "space",
        "description": "은하수가 펼쳐진 우주 배경입니다.",
        "is_active": True,
    },
    {
        "name": "교실 배경",
        "category": "BACKGROUND",
        "price": 700,
        "is_rare": False,
        "image_url": "/images/backgrounds/class.png",
        "image_key": "class",
        "description": "공부가 잘될 것 같은 교실 배경입니다.",
        "is_active": True,
    },
    {
        "name": "경복궁 배경",
        "category": "BACKGROUND",
        "price": 5000,
        "is_rare": True,
        "image_url": "/images/backgrounds/Gyeongbokgung.png",
        "image_key": "Gyeongbokgung",
        "description": "고풍스러운 경복궁 풍경을 담은 배경입니다.",
        "is_active": True,
    },
    {
        "name": "바다 배경",
        "category": "BACKGROUND",
        "price": 1100,
        "is_rare": False,
        "image_url": "/images/backgrounds/ocean.png",
        "image_key": "ocean",
        "description": "탁 트인 파란 바다가 펼쳐지는 시원한 배경입니다.",
        "is_active": True,
    },
    {
        "name": "셜록의 방 배경",
        "category": "BACKGROUND",
        "price": 2000,
        "is_rare": False,
        "image_url": "/images/backgrounds/Sherlock's_room.png",
        "image_key": "Sherlock's_room",
        "description": "수수께끼가 가득한 탐정의 방을 옮겨온 듯한 배경입니다.",
        "is_active": True,
    },
]


def seed_shop_items(prune=False):
    created = 0
    updated = 0
    active_item_names = []

    for item_data in SHOP_ITEMS:
        item, was_created = ShopItem.objects.update_or_create(
            name=item_data["name"],
            defaults=item_data,
        )
        active_item_names.append(item.name)

        if was_created:
            created += 1
        else:
            updated += 1

    deleted = 0
    if prune:
        deleted, _ = ShopItem.objects.exclude(name__in=active_item_names).delete()

    return {
        "created": created,
        "updated": updated,
        "deleted": deleted,
        "pruned": prune,
    }

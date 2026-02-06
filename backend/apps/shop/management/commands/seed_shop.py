from django.core.management.base import BaseCommand
from apps.shop.models import ShopItem

class Command(BaseCommand):
    help = '초기 상점 아이템 데이터를 생성합니다.'

    def handle(self, *args, **kwargs):
        self.stdout.write('상점 아이템 데이터 생성을 시작합니다...')

        items = [
            # 의류 (Clothing)
            {
                'name': '정장',
                'category': 'CLOTHING',
                'price': 400,
                'is_rare': False,
                'image_url': '/images/items/suit.png',
                'description': '고풍스러운 느낌의 정장입니다.'
            },
            {
                'name': '회색 후드티',
                'category': 'CLOTHING',
                'price': 300,
                'is_rare': False,
                'image_url': '/images/items/gray_hoodie.png',
                'description': '편안한 회색 후드티입니다.'
            },
            {
                'name': '하와이안 셔츠',
                'category': 'CLOTHING',
                'price': 500,
                'is_rare': False,
                'image_url': '/images/items/hat_captain.png',
                'description': '휴양지에 온 듯한 느낌을 주는 하와이안 셔츠입니다.'
            },
             {
                'name': '해적 코트',
                'category': 'CLOTHING',
                'price': 500,
                'is_rare': False,
                'image_url': '/images/items/coat_pirate.png',
                'description': '멋진 해적 코트입니다.'
            },
             {
                'name': '황제 가운',
                'category': 'CLOTHING',
                'price': 1500,
                'is_rare': True,
                'image_url': '/images/items/crown_gold.png',
                'description': '왕의 권위를 상징하는 금이 박힌 붉은 가운입니다.'
            },


            # 아이템 (Item)
            {
                'name': '검은 안경',
                'category': 'ITEM',
                'price': 200,
                'is_rare': False,
                'image_url': '/images/items/black_glasses.png',
                'description': '지적인 이미지를 주는 검은 안경입니다.'
            },
             {
                'name': '구식 여행 가방',
                'category': 'ITEM',
                'price': 400,
                'is_rare': False,
                'image_url': '/images/items/bag.png',
                'description': '오래된 느낌의 여행 가방입니다.'
            },


            # 배경 (Background)
            {
                'name': '도서관 배경',
                'category': 'BACKGROUND',
                'price': 800,
                'is_rare': False,
                'image_url': '/images/items/library.png',
                'description': '책이 가득한 도서관 배경입니다.'
            },
            {
                'name': '우주 배경',
                'category': 'BACKGROUND',
                'price': 3000,
                'is_rare': True,
                'image_url': '/images/items/space.png',
                'description': '은하수가 펼쳐진 우주 배경입니다.'
            },
            
        ]

        created_count = 0
        for item_data in items:
            item, created = ShopItem.objects.get_or_create(
                name=item_data['name'],
                defaults=item_data
            )
            if created:
                created_count += 1
        
        self.stdout.write(self.style.SUCCESS(f'총 {created_count}개의 상점 아이템이 생성되었습니다.'))

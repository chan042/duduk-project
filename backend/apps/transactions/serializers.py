import base64
import binascii

from rest_framework import serializers

from apps.common.categories import TRANSACTION_CATEGORIES
from apps.common.image_formats import IMAGE_FORMAT_MAP
from .models import Transaction

# 이미지 매칭 가격 조회 결과 상태
IMAGE_MATCH_RESOLVE_STATUSES = (
    'matched',
    'not_found',
)


class TransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Transaction
        fields = ['id', 'category', 'item', 'store', 'amount', 'memo', 'date', 'address', 'is_fixed']


# 클라이언트가 base64 이미지 + 포맷 + 메뉴명을 전송하면 AI가 가게를 식별
class ImageMatchAnalyzeRequestSerializer(serializers.Serializer):
    imageData = serializers.CharField(trim_whitespace=True)
    format = serializers.CharField(trim_whitespace=True)
    menu_name = serializers.CharField(max_length=100, trim_whitespace=True)

    # base64 디코딩이 가능한 유효한 이미지 데이터인지 검증
    def validate_imageData(self, value):
        if not value:
            raise serializers.ValidationError('이미지 데이터가 필요합니다.')

        try:
            base64.b64decode(value, validate=True)
        except (binascii.Error, ValueError):
            raise serializers.ValidationError('유효한 base64 이미지 데이터가 아닙니다.')

        return value

    # 이미지 포맷을 소문자로 정규화
    def validate_format(self, value):
        normalized = (value or '').strip().lower()
        if not normalized:
            raise serializers.ValidationError('이미지 형식을 입력해주세요.')
        if normalized not in IMAGE_FORMAT_MAP:
            raise serializers.ValidationError('지원하지 않는 이미지 형식입니다.')
        return normalized

    # 메뉴명 공백 제거 후 빈 값 여부 검증
    def validate_menu_name(self, value):
        normalized = (value or '').strip()
        if not normalized:
            raise serializers.ValidationError('메뉴명을 입력해주세요.')
        return normalized


class ImagePriceMatchSerializer(serializers.Serializer):
    found = serializers.BooleanField()
    amount = serializers.IntegerField(required=False, allow_null=True)
    category = serializers.ChoiceField(choices=TRANSACTION_CATEGORIES)
    observed_menu_name = serializers.CharField(
        max_length=100,
        trim_whitespace=True,
        allow_blank=True,
        required=False,
    )


# 메뉴명, 식별된 가게명, 이미지 가격 확인 결과 반환
class ImageMatchAnalyzeResponseSerializer(serializers.Serializer):
    store_name = serializers.CharField(
        max_length=100,
        trim_whitespace=True,
        allow_null=True,
        allow_blank=True,
        required=False,
    )
    image_price_match = ImagePriceMatchSerializer()


# 확정된 가게명 + 메뉴명으로 가격 조회
class ImageMatchResolvePriceRequestSerializer(serializers.Serializer):
    confirmed_store_name = serializers.CharField(max_length=100, trim_whitespace=True)
    menu_name = serializers.CharField(max_length=100, trim_whitespace=True)

    # 가게명 공백 제거 후 빈 값 여부 검증
    def validate_confirmed_store_name(self, value):
        normalized = (value or '').strip()
        if not normalized:
            raise serializers.ValidationError('가게명을 입력해주세요.')
        return normalized

    # 메뉴명 공백 제거 후 빈 값 여부 검증
    def validate_menu_name(self, value):
        normalized = (value or '').strip()
        if not normalized:
            raise serializers.ValidationError('메뉴명을 입력해주세요.')
        return normalized


# 지출 입력 데이터
class ImageMatchPrefillSerializer(serializers.Serializer):
    store = serializers.CharField(max_length=100, trim_whitespace=True)
    item = serializers.CharField(max_length=100, trim_whitespace=True)
    amount = serializers.IntegerField(required=False, allow_null=True)
    category = serializers.ChoiceField(choices=TRANSACTION_CATEGORIES)
    date = serializers.DateField()


# 매칭 상태와 자동완성 데이터 반환
class ImageMatchResolvePriceResponseSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=IMAGE_MATCH_RESOLVE_STATUSES)
    prefill = ImageMatchPrefillSerializer()

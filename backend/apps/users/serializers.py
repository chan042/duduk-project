"""
[파일 역할]
- 사용자 관련 데이터를 직렬화(Serialization)하는 Serializer 클래스를 정의합니다.
- 회원가입 및 사용자 정보 조회에 사용됩니다.
"""
from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    """
    사용자 정보를 직렬화하는 Serializer.
    프로필 조회 등에 사용됩니다.
    """
    class Meta:
        model = User
        fields = ['id', 'email', 'username', 'first_name', 'last_name', 
                  'job', 'hobbies', 'self_development_field', 
                  'marital_status', 'has_children', 'birth_date',
                  'age', 'monthly_budget', 'spending_to_improve', 'is_profile_complete',
                  'character_type', 'character_name', 'profile_image', 'date_joined']
        read_only_fields = ['id', 'email', 'date_joined']


class RegisterSerializer(serializers.ModelSerializer):
    """
    회원가입용 Serializer.
    이메일, 비밀번호, 사용자명을 받아 새로운 사용자를 생성합니다.
    """
    password = serializers.CharField(
        write_only=True, 
        required=True, 
        validators=[validate_password],
        style={'input_type': 'password'}
    )
    password_confirm = serializers.CharField(
        write_only=True, 
        required=True,
        style={'input_type': 'password'}
    )

    class Meta:
        model = User
        fields = ['email', 'username', 'password', 'password_confirm', 'character_type', 'character_name']

    def validate(self, attrs):
        """비밀번호 일치 여부 검증"""
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({
                "password": "비밀번호가 일치하지 않습니다."
            })
        return attrs

    def create(self, validated_data):
        """새로운 사용자 생성"""
        # password_confirm은 생성에 사용하지 않으므로 제거
        validated_data.pop('password_confirm')
        
        # 캐릭터 정보 추출
        character_type = validated_data.pop('character_type', 'char_cat')
        character_name = validated_data.pop('character_name', None)
        
        user = User.objects.create_user(
            email=validated_data['email'],
            username=validated_data['username'],
            password=validated_data['password'],
            character_type=character_type,
            character_name=character_name
        )
        return user

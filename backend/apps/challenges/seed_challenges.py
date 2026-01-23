"""
두둑 챌린지 시드 데이터 모듈

두둑 챌린지에서 새로운 챌린지를 추가하려면 DUDUK_CHALLENGES 리스트에 딕셔너리를 추가하면 됨.
각 챌린지는 고유한 'name'을 가져야 함 (중복 방지용 식별자).

사용 예시:
    from apps.challenges.seed_challenges import seed_default_challenges
    seed_default_challenges()  # 없는 챌린지만 추가
    seed_default_challenges(force_update=True)  # 기존 데이터도 업데이트
"""

import logging

logger = logging.getLogger(__name__)


# ============================================================================
# 두둑 챌린지 정의
# 새 챌린지 추가 시 이 리스트에만 추가.
# ============================================================================
DUDUK_CHALLENGES = [
    {
        "name": "3만원의 행복",
        "description": "일주일 동안 3만원 이내 지출 시 성공! 제한된 예산 안에서 효율적인 소비 습관을 기를 수 있습니다.",
        "icon": "target",
        "icon_color": "#EF4444",
        "points": 300,
        "difficulty": "MEDIUM",
        "keyword": "TOP_SAVING",
        "duration_days": 7,
        "target_amount": 30000,
        "target_category": "",  # 모든 카테고리 대상
        "type": "DUDUK",
        "is_active": True,
    },
    # ========================================================================
    # 새 챌린지 추가 예시 (주석 해제하여 사용):
    # ========================================================================
    # {
    #     "name": "무지출 데이",
    #     "description": "하루 동안 단 한 푼도 쓰지 않는 무지출 챌린지!",
    #     "icon": "wallet",
    #     "icon_color": "#10B981",
    #     "points": 100,
    #     "difficulty": "EASY",
    #     "keyword": "POPULAR_SUCCESS",
    #     "duration_days": 1,
    #     "target_amount": 0,
    #     "target_category": "",
    #     "type": "DUDUK",
    #     "is_active": True,
    # },
]


def seed_default_challenges(force_update: bool = False) -> dict:
    """
    두둑 챌린지를 데이터베이스에 시드
    
    Args:
        force_update: True면 기존 챌린지도 업데이트, False면 없는 것만 추가
    
    Returns:
        dict: {"created": int, "updated": int, "skipped": int}
    """
    # Django가 완전히 로드된 후에만 import
    from apps.challenges.models import Challenge
    
    result = {"created": 0, "updated": 0, "skipped": 0}
    
    for challenge_data in DUDUK_CHALLENGES:
        name = challenge_data.get("name")
        
        try:
            existing = Challenge.objects.filter(name=name).first()
            
            if existing:
                if force_update:
                    # 기존 챌린지 업데이트
                    for key, value in challenge_data.items():
                        setattr(existing, key, value)
                    existing.save()
                    result["updated"] += 1
                    logger.info(f"챌린지 업데이트됨: {name}")
                else:
                    result["skipped"] += 1
                    logger.debug(f"챌린지 이미 존재: {name}")
            else:
                # 새 챌린지 생성
                Challenge.objects.create(**challenge_data)
                result["created"] += 1
                logger.info(f"챌린지 생성됨: {name}")
                
        except Exception as e:
            logger.error(f"챌린지 '{name}' 시드 실패: {e}")
    
    return result


def get_challenge_by_name(name: str):
    """
    이름으로 챌린지 조회
    
    Args:
        name: 챌린지 이름
    
    Returns:
        Challenge 인스턴스 또는 None
    """
    from apps.challenges.models import Challenge
    return Challenge.objects.filter(name=name, is_active=True).first()

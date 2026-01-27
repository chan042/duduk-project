"""
두둑 챌린지 시드 데이터 모듈

새로운 챌린지 템플릿을 추가하려면 DUDUK_CHALLENGE_TEMPLATES 리스트에 딕셔너리를 추가하면 됨.
각 챌린지는 고유한 'name'을 가져야 함 (중복 방지용 식별자).

사용 예시:
    from apps.challenges.seed_challenges import seed_challenge_templates
    seed_challenge_templates()  # 없는 템플릿만 추가
    seed_challenge_templates(force_update=True)  # 기존 데이터도 업데이트
"""

import logging

logger = logging.getLogger(__name__)


# ============================================================================
# 두둑 챌린지 템플릿 정의 (13개)
# ============================================================================
DUDUK_CHALLENGE_TEMPLATES = [
    # ========================================================================
    # 1. 3만원의 행복
    # ========================================================================
    {
        "name": "3만원의 행복",
        "description": "일주일 동안 3만원으로 절약의 행복을 찾아봐요!",
        "icon": "coins",
        "icon_color": "#EF4444",
        "source_type": "duduk",
        "difficulty": "medium",
        "base_points": 350,
        "has_penalty": False,
        "duration_days": 7,
        "is_versus": False,
        "success_conditions": {
            "type": "amount_limit",
            "target_amount": 30000,
            "categories": ["all"],
            "comparison": "lte"
        },
        "user_inputs": None,
        "requires_daily_check": False,
        "requires_photo": False,
        "success_description": "7일 내 지출 3만원 이하 시 성공!",
        "display_config": {
            "progress_type": "amount",
            "primary_metric": {
                "label": "사용 금액",
                "unit": "원",
                "format": "currency",
                "show_target": True,
                "target_label": "목표"
            },
            "show_progress_bar": True,
            "show_daily_breakdown": True
        },
        "is_active": True,
        "display_order": 1,
    },
    
    # ========================================================================
    # 2. 나와의 싸움
    # ========================================================================
    {
        "name": "나와의 싸움",
        "description": "지난달의 나와 싸워서 이기자! 지난달 하나의 주차를 선택하고, 해당 주차보다 지출을 절약해봐요.",
        "icon": "swords",
        "icon_color": "#8B5CF6",
        "source_type": "duduk",
        "difficulty": "easy",
        "base_points": 100,
        "has_penalty": False,
        "duration_days": 7,
        "is_versus": False,
        "success_conditions": {
            "type": "compare",
            "compare_type": "last_month_week",
            "comparison": "lt"
        },
        "user_inputs": [
            {
                "key": "compare_week",
                "label": "비교할 주차",
                "type": "select",
                "options": [1, 2, 3, 4, 5],
                "required": True,
                "description": "지난달 몇 주차와 비교할지 선택"
            }
        ],
        "requires_daily_check": False,
        "requires_photo": False,
        "success_description": "지난달 N주차 소비보다 덜 지출하면 성공!",
        "display_config": {
            "progress_type": "compare",
            "primary_metric": {
                "label": "현재 지출",
                "unit": "원",
                "format": "currency",
                "show_target": True,
                "target_label": "지난달"
            },
            "show_progress_bar": True,
            "show_daily_breakdown": True
        },
        "is_active": True,
        "display_order": 2,
    },
    
    # ========================================================================
    # 3. 3일 연속 무지출 챌린지
    # ========================================================================
    {
        "name": "3일 연속 무지출 챌린지",
        "description": "3일간 무소유 마인드를 장착 해보는 건 어때요?",
        "icon": "wallet",
        "icon_color": "#10B981",
        "source_type": "duduk",
        "difficulty": "hard",
        "base_points": 450,
        "has_penalty": False,
        "duration_days": 3,
        "is_versus": False,
        "success_conditions": {
            "type": "zero_spend",
            "target_amount": 0,
            "categories": ["all"],
            "comparison": "eq"
        },
        "user_inputs": None,
        "requires_daily_check": False,
        "requires_photo": False,
        "success_description": "3일간 무지출 시 성공!",
        "display_config": {
            "progress_type": "zero_spend",
            "primary_metric": {
                "label": "총 지출",
                "unit": "원",
                "format": "currency",
                "show_target": True,
                "target_label": "목표"
            },
            "show_progress_bar": False,
            "show_daily_breakdown": True,
            "special_display": "daily_zero_check"
        },
        "is_active": True,
        "display_order": 3,
    },
    
    # ========================================================================
    # 4. 현금 챌린지
    # ========================================================================
    {
        "name": "현금 챌린지",
        "description": "보이지 않는 숫자는 그만! 눈앞에서 줄어드는 지폐를 보며 소비 습관을 돌아보아요.",
        "icon": "banknote",
        "icon_color": "#22C55E",
        "source_type": "duduk",
        "difficulty": "easy",
        "base_points": 200,
        "has_penalty": False,
        "duration_days": 7,
        "is_versus": False,
        "success_conditions": {
            "type": "amount_limit_with_photo",
            "target_amount": None,
            "categories": ["all"],
            "comparison": "lte",
            "requires_daily_photo": True
        },
        "user_inputs": [
            {
                "key": "target_amount",
                "label": "현금 예산",
                "type": "number",
                "required": True,
                "description": "일주일 동안 사용할 현금 예산"
            }
        ],
        "requires_daily_check": False,
        "requires_photo": True,
        "photo_frequency": "daily",
        "photo_description": "저녁에 남은 현금을 사진으로 인증해주세요",
        "success_description": "7일동안 매일 저녁 남은 현금 사진 인증 + 설정한 금액 이하로 지출 시 성공!",
        "display_config": {
            "progress_type": "amount",
            "primary_metric": {
                "label": "사용 금액",
                "unit": "원",
                "format": "currency",
                "show_target": True,
                "target_label": "예산"
            },
            "secondary_metrics": [
                {"label": "사진 인증", "key": "photo_count", "format": "count"}
            ],
            "show_progress_bar": True,
            "show_daily_breakdown": True
        },
        "is_active": True,
        "display_order": 4,
    },
    
    # ========================================================================
    # 5. 외식/배달 X
    # ========================================================================
    {
        "name": "외식/배달 X",
        "description": "외식, 배달은 그만! 든든한 집밥과 함께 내 지갑도 든든하게!",
        "icon": "utensils-crossed",
        "icon_color": "#F97316",
        "source_type": "duduk",
        "difficulty": "hard",
        "base_points": 500,
        "has_penalty": False,
        "duration_days": 7,
        "is_versus": False,
        "success_conditions": {
            "type": "zero_spend",
            "target_amount": 0,
            "categories": ["외식", "배달"],
            "comparison": "eq"
        },
        "user_inputs": None,
        "requires_daily_check": False,
        "requires_photo": False,
        "success_description": "기간 내 외식/배달 지출이 없다면 성공!",
        "display_config": {
            "progress_type": "zero_spend",
            "primary_metric": {
                "label": "외식/배달 지출",
                "unit": "원",
                "format": "currency",
                "show_target": True,
                "target_label": "목표"
            },
            "show_progress_bar": False,
            "show_daily_breakdown": True
        },
        "is_active": True,
        "display_order": 5,
    },
    
    # ========================================================================
    # 6. 원 플 원 러버
    # ========================================================================
    {
        "name": "원플원러버",
        "description": "알뜰살뜰~ 편의점 이용 시 1+1 소비만 해보기!",
        "icon": "tag",
        "icon_color": "#EC4899",
        "source_type": "duduk",
        "difficulty": "easy",
        "base_points": 100,
        "has_penalty": False,
        "duration_days": 7,
        "is_versus": False,
        "success_conditions": {
            "type": "photo_verification",
            "required_photos": 1,
            "photo_condition": "1+1 제품 구매 인증"
        },
        "user_inputs": None,
        "requires_daily_check": False,
        "requires_photo": True,
        "photo_frequency": "on_purchase",
        "photo_description": "편의점에서 1+1 제품을 구매할 때마다 사진으로 인증해주세요",
        "success_description": "편의점 이용 시 반드시 1+1 제품만 사용 (사진 인증)!",
        "display_config": {
            "progress_type": "photo",
            "primary_metric": {
                "label": "인증 횟수",
                "unit": "회",
                "format": "count",
                "show_target": False
            },
            "show_progress_bar": False,
            "show_daily_breakdown": False
        },
        "is_active": True,
        "display_order": 6,
    },

    # ========================================================================
    # 7. 집구석 보물찾기
    # ========================================================================
    {
        "name": "집구석 보물찾기",
        "description": "중고 거래를 통해 소소한 용돈을 만들어 보는 건 어때요? 공간은 비우고 통장은 두둑하게!",
        "icon": "gem",
        "icon_color": "#FBBF24",
        "source_type": "duduk",
        "difficulty": "easy",
        "base_points": 100,
        "has_penalty": False,
        "duration_days": 3,
        "is_versus": False,
        "success_conditions": {
            "type": "photo_verification",
            "required_photos": 1,
            "photo_condition": "중고 거래 게시글 인증"
        },
        "user_inputs": None,
        "requires_daily_check": False,
        "requires_photo": True,
        "photo_frequency": "once",
        "photo_description": "중고 거래 사이트에 물건을 올린 화면을 캡처해주세요",
        "success_description": "3일 안에 1건의 중고 거래 게시 사진 인증 시 성공!",
        "display_config": {
            "progress_type": "photo",
            "primary_metric": {
                "label": "게시글 인증",
                "unit": "건",
                "format": "count",
                "show_target": True,
                "target_label": "목표"
            },
            "show_progress_bar": True,
            "show_daily_breakdown": False
        },
        "is_active": True,
        "display_order": 7,
    },
    
    # ========================================================================
    # 8. 고정비 다이어트
    # ========================================================================
    {
        "name": "고정비 다이어트",
        "description": "나도 모르게 매달 빠져나가는 구독 서비스와 불필요한 고정 지출을 정리해봐요. 한 번의 정리로 앞으로의 지갑이 두둑!",
        "icon": "scissors",
        "icon_color": "#14B8A6",
        "source_type": "duduk",
        "difficulty": "easy",
        "base_points": 200,
        "has_penalty": False,
        "duration_days": 30,
        "is_versus": False,
        "success_conditions": {
            "type": "compare",
            "compare_type": "fixed_expense",
            "comparison": "lt"
        },
        "user_inputs": None,
        "requires_daily_check": False,
        "requires_photo": False,
        "success_description": "이번달 고정비가 지난달 고정비보다 적으면 성공!",
        "display_config": {
            "progress_type": "compare",
            "primary_metric": {
                "label": "이번달 고정비",
                "unit": "원",
                "format": "currency",
                "show_target": True,
                "target_label": "이전달 고정비"
            },
            "show_progress_bar": True,
            "show_daily_breakdown": False,
            "show_category_breakdown": True
        },
        "is_active": True,
        "display_order": 8,
    },
    
    # ========================================================================
    # 10. 내 소비 맞추기
    # ========================================================================
    {
        "name": "내 소비 맞추기",
        "description": "과하지도, 부족하지도 않게! 일주일 간 소비 계획을 세우고 그대로 실행해봐요.",
        "icon": "target",
        "icon_color": "#6366F1",
        "source_type": "duduk",
        "difficulty": "medium",
        "base_points": 300,
        "has_penalty": False,
        "duration_days": 7,
        "is_versus": False,
        "success_conditions": {
            "type": "amount_range",
            "target_amount": None,
            "tolerance_percent": 10,
            "comparison": "within"
        },
        "user_inputs": [
            {
                "key": "target_amount",
                "label": "목표 소비 금액",
                "type": "number",
                "required": True,
                "description": "일주일 동안 목표로 하는 소비 금액"
            }
        ],
        "requires_daily_check": False,
        "requires_photo": False,
        "success_description": "계획한 소비에서 ±10% 이내일 경우 성공!",
        "display_config": {
            "progress_type": "amount",
            "primary_metric": {
                "label": "현재 지출",
                "unit": "원",
                "format": "currency",
                "show_target": True,
                "target_label": "목표"
            },
            "secondary_metrics": [
                {"label": "허용 범위", "key": "range", "format": "range"}
            ],
            "show_progress_bar": True,
            "show_daily_breakdown": True,
            "special_display": "target_range"
        },
        "is_active": True,
        "display_order": 9,
    },

    # ========================================================================
    # 10. 미라클 두둑!
    # ========================================================================
    {
        "name": "미라클 두둑!",
        "description": "매일 지출 입력하는 습관 기르기! 부지런한 내가 되어봐요.",
        "icon": "sun",
        "icon_color": "#F59E0B",
        "source_type": "duduk",
        "difficulty": "medium",
        "base_points": 350,
        "has_penalty": False,
        "duration_days": 30,
        "is_versus": False,
        "success_conditions": {
            "type": "daily_check",
            "required_days": 30,
            "check_type": "spending_input"
        },
        "user_inputs": None,
        "requires_daily_check": True,
        "requires_photo": False,
        "success_description": "기간 내 매일매일 달력에 지출 입력(또는 무지출 체크) 시 성공!",
        "display_config": {
            "progress_type": "daily_check",
            "primary_metric": {
                "label": "입력한 날",
                "unit": "일",
                "format": "count",
                "show_target": True,
                "target_label": "목표"
            },
            "show_progress_bar": True,
            "show_daily_breakdown": True,
            "special_display": "monthly_calendar"
        },
        "is_active": True,
        "display_order": 10,
    },

    # ========================================================================
    # 11. 무00의 날
    # ========================================================================
    {
        "name": "무00의 날",
        "description": "어제는 카페, 오늘은 술! 내일은 어떤 소비를 참아볼까요?",
        "icon": "calendar-x",
        "icon_color": "#A855F7",
        "source_type": "duduk",
        "difficulty": "medium",
        "base_points": 300,
        "has_penalty": False,
        "duration_days": 7,
        "is_versus": False,
        "success_conditions": {
            "type": "daily_rule",
            "daily_rules": {},
            "ai_random_days": 3
        },
        "user_inputs": [
            {
                "key": "mon_forbidden",
                "label": "월요일 금지 카테고리",
                "type": "category_select",
                "required": True
            },
            {
                "key": "tue_forbidden",
                "label": "화요일 금지 카테고리",
                "type": "category_select",
                "required": True
            },
            {
                "key": "wed_forbidden",
                "label": "수요일 금지 카테고리",
                "type": "category_select",
                "required": True
            },
            {
                "key": "thu_forbidden",
                "label": "목요일 금지 카테고리",
                "type": "category_select",
                "required": True
            }
        ],
        "requires_daily_check": False,
        "requires_photo": False,
        "success_description": "요일마다 정한 금지 카테고리에서 지출하지 않으면 성공! (7일 중 3일은 AI가 랜덤 지정)",
        "display_config": {
            "progress_type": "daily_rule",
            "primary_metric": {
                "label": "성공한 날",
                "unit": "일",
                "format": "count",
                "show_target": True,
                "target_label": "목표"
            },
            "show_progress_bar": True,
            "show_daily_breakdown": True,
            "special_display": "weekly_forbidden_calendar"
        },
        "is_active": True,
        "display_order": 11,
    },

    # ========================================================================
    # 12. 미래의 나에게
    # ========================================================================
    {
        "name": "미래의 나에게",
        "description": "미래의 나에게 이번 달 가장 후회되는 소비 카테고리와 함께 따끔한 한마디를 적어서 보내요!",
        "icon": "mail",
        "icon_color": "#0EA5E9",
        "source_type": "duduk",
        "difficulty": "medium",
        "base_points": 350,
        "has_penalty": False,
        "duration_days": 60,
        "is_versus": False,
        "success_conditions": {
            "type": "compare",
            "compare_type": "next_month_category",
            "comparison": "lt"
        },
        "user_inputs": [
            {
                "key": "target_category",
                "label": "개선할 카테고리",
                "type": "category_select",
                "required": True,
                "description": "이번 달 가장 후회되는 소비 카테고리"
            },
            {
                "key": "message_to_future",
                "label": "미래의 나에게 한마디",
                "type": "text",
                "required": True,
                "description": "다음 달의 나에게 보내는 메시지"
            }
        ],
        "requires_daily_check": False,
        "requires_photo": False,
        "success_description": "선택한 카테고리의 다음 달 총 지출이 이번 달보다 적으면 성공!",
        "display_config": {
            "progress_type": "compare",
            "primary_metric": {
                "label": "이번 달 지출",
                "unit": "원",
                "format": "currency",
                "show_target": True,
                "target_label": "다음 달 목표"
            },
            "show_progress_bar": True,
            "show_daily_breakdown": False,
            "special_display": "letter_to_future"
        },
        "is_active": True,
        "display_order": 12,
    },

    # ========================================================================
    # 13. 두근두근 데스게임
    # ========================================================================
    {
        "name": "두근두근 데스게임",
        "description": "두근두근! 랜덤으로 정해진 예산을 지켜 생존해봐요. 사용하지 않은 예산만큼 포인트를 받아요.",
        "icon": "dice",
        "icon_color": "#EF4444",
        "source_type": "duduk",
        "difficulty": "hard",
        "base_points": 0,
        "points_formula": "(random_budget - actual_spent) * 0.08",
        "max_points": 1000,
        "has_penalty": True,
        "penalty_formula": "(actual_spent - random_budget) * 0.01",
        "max_penalty": 500,
        "bonus_condition": {
            "type": "jackpot",
            "difference_percent": 5
        },
        "bonus_points": 1500,
        "duration_days": 7,
        "is_versus": False,
        "success_conditions": {
            "type": "random_budget",
            "comparison": "lte"
        },
        "user_inputs": None,
        "requires_daily_check": False,
        "requires_photo": False,
        "success_description": "랜덤 예산 이하로 지출 시 성공! 잭팟: 예산과 실제 지출 차이가 5% 이내면 1500p!",
        "display_config": {
            "progress_type": "random_budget",
            "primary_metric": {
                "label": "현재 지출",
                "unit": "원",
                "format": "currency",
                "show_target": True,
                "target_label": "랜덤 예산"
            },
            "secondary_metrics": [
                {"label": "예상 포인트", "key": "potential_points", "format": "points"},
                {"label": "잭팟 가능", "key": "jackpot_eligible", "format": "boolean"}
            ],
            "show_progress_bar": True,
            "show_daily_breakdown": True,
            "special_display": "death_game_gauge"
        },
        "is_active": True,
        "display_order": 13,
    },
]


def seed_challenge_templates(force_update: bool = False) -> dict:
    """
    챌린지 템플릿을 데이터베이스에 시드
    
    Args:
        force_update: True면 기존 템플릿도 업데이트, False면 없는 것만 추가
    
    Returns:
        dict: {"created": int, "updated": int, "skipped": int}
    """
    from apps.challenges.models import ChallengeTemplate
    
    result = {"created": 0, "updated": 0, "skipped": 0}
    
    for template_data in DUDUK_CHALLENGE_TEMPLATES:
        name = template_data.get("name")
        
        try:
            existing = ChallengeTemplate.objects.filter(name=name).first()
            
            if existing:
                if force_update:
                    for key, value in template_data.items():
                        setattr(existing, key, value)
                    existing.save()
                    result["updated"] += 1
                    logger.info(f"템플릿 업데이트됨: {name}")
                else:
                    result["skipped"] += 1
                    logger.debug(f"템플릿 이미 존재: {name}")
            else:
                ChallengeTemplate.objects.create(**template_data)
                result["created"] += 1
                logger.info(f"템플릿 생성됨: {name}")
                
        except Exception as e:
            logger.error(f"템플릿 '{name}' 시드 실패: {e}")
    
    return result


def get_template_by_name(name: str):
    """
    이름으로 템플릿 조회
    
    Args:
        name: 템플릿 이름
    
    Returns:
        ChallengeTemplate 인스턴스 또는 None
    """
    from apps.challenges.models import ChallengeTemplate
    return ChallengeTemplate.objects.filter(name=name, is_active=True).first()


# 하위 호환성을 위한 별칭
DUDUK_CHALLENGES = DUDUK_CHALLENGE_TEMPLATES
seed_default_challenges = seed_challenge_templates
get_challenge_by_name = get_template_by_name

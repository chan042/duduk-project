import base64
import datetime
import json
import logging
import os
import re
import time
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlsplit, urlunsplit

from google import genai
from google.genai import types
from pydantic import BaseModel, ConfigDict, Field, ValidationError
from apps.common.categories import TRANSACTION_CATEGORIES
from apps.common.image_formats import IMAGE_FORMAT_TO_MIME_TYPE
from apps.common.menu_options import has_conflicting_menu_option_tokens
from apps.common.months import get_month_datetime_range
from apps.common.store_names import build_store_lookup_names
from external.diningcode.client import DiningCodeClient

logger = logging.getLogger(__name__)

# ============================================================
# 상수 정의
# ============================================================

CATEGORIES = list(TRANSACTION_CATEGORIES)
RESOLVED_WEB_PRICE_SOURCE_TYPES = (
    "official_menu_page",
    "official_order_page",
    "web_search",
)
DEFAULT_GEMINI_API_VERSION = "v1beta"
GEMINI_TASK_PRESETS = {
    "default": {
        "temperature": 0.2,
    },
    "vision_verification": {
        "temperature": 0.0,
        "thinking_budget": 0,
    },
    "image_match_extract": {
        "temperature": 0.0,
        "thinking_budget": 0,
    },
    "menu_parse": {
        "temperature": 0.0,
        "thinking_budget": 0,
    },
    "grounded_web_lookup": {
        "temperature": 0.0,
        "thinking_budget": 256,
    },
    "transaction_parse": {
        "temperature": 0.0,
        "thinking_budget": 0,
    },
    "chat": {
        "temperature": 0.7,
    },
    "coaching_search": {
        "temperature": 0.3,
        "thinking_budget": 256,
    },
    "coaching_no_search": {
        "temperature": 0.3,
        "thinking_budget": 0,
    },
}

DIFFICULTY_POINTS = {
    "easy": (100, 200),
    "normal": (200, 350),
    "hard": (350, 500),
}

CHALLENGE_SCHEMA = """
[반환 형식]
- name: 챌린지 이름 (10자 이내)
- difficulty: easy/normal/hard 중 하나
- description: 동기부여가 되는 챌린지 설명 (50자 이내, 친근한 말투)
- success_conditions: 구체적이고 측정 가능한 성공 조건 배열
- numeric_constraints.duration_days: 챌린지 기간(일 단위 정수)
- numeric_constraints.target_amount: 목표 절감 금액(정수 또는 null)
- target_keywords: 지출 매칭 키워드 배열
- target_categories: 관련 카테고리 배열
"""

DIFFICULTY_GUIDE = """
[난이도별 성공 조건 가이드]
EASY: 느슨한 제한, 단일 조건, 실패해도 만회 가능
NORMAL: 복합 조건 또는 연속 달성 요구
HARD: 엄격한 제한, 0회 또는 완전 금지
"""

# ============================================================
# 챗봇 (두두) 프롬프트 설정
# ============================================================

DUDU_PROMPT_CONFIG = {
    "system_prompt": {
        "agent_identity": {
            "name": "두두(Dudu)",
            "role": "MZ세대를 위한 똑똑하고 친근한 금융 메이트 및 소비 코치",
            "tone_and_manner": [
                "친근하고 다정한 존댓말 사용 (예: ~했어요, ~어떨까요?)",
                "사용자를 가르치려 들거나 훈계하지 않음 (Non-judgmental)",
                "무조건적인 절약이 아닌, 삶의 질(윤택지수)을 높이는 가치 소비를 지향함",
                "공감 먼저, 대안 제시는 그 다음에 자연스럽게 전달함",
            ],
        },
        "core_rules": [
            "RULE 1: 사용자의 지출(특히 취미나 가치 소비)을 비난하지 말고, 그 이면의 감정을 먼저 공감할 것.",
            "RULE 2: 절약을 권유할 때는 '하지 마세요'가 아니라, 즉각적이고 구체적인 '대체 행동(Alternative)'을 제안할 것.",
            "RULE 3: 제공받은 사용자 프로필(직업, 취미)과 현재 재정 상태(잔여 예산) 데이터를 반드시 참고하여 개인화된 답변을 제공할 것.",
            "RULE 4: 사용자가 진행 중인 '챌린지'가 있다면, 이를 언급하며 동기를 부여할 것.",
            "RULE 5: 전문적인 금융 용어는 MZ세대가 이해하기 쉬운 일상 용어로 풀어서 설명할 것.",
        ],
        "context_schema_required": {
            "user_profile": {
                "name": "string - 사용자(캐릭터) 이름",
                "age_group": "string - 나이대 (예: 20대, 30대)",
                "job": "string - 직업",
                "hobbies": "array of strings - 취미 목록",
            },
            "financial_status": {
                "monthly_budget": "number - 이번 달 월 예산(원)",
                "remaining_budget": "number - 이번 달 잔여 예산(원)",
                "today_spending": "number - 오늘 지출 합계(원)",
            },
            "active_challenges": "array of objects - 진행 중인 챌린지 목록. 각 객체: {name: string, status: string}",
        },
        "few_shot_examples": [
            # ── 예시 1: 스트레스 배달 유혹 + 챌린지 진행 중 ──
            {
                "context": {
                    "user_profile": {
                        "name": "김두둑",
                        "age_group": "20대",
                        "job": "직장인",
                        "hobbies": ["맛집 탐방"],
                    },
                    "financial_status": {
                        "monthly_budget": 500000,
                        "remaining_budget": 50000,
                        "today_spending": 0,
                    },
                    "active_challenges": [{"name": "배달 앱 VIP 탈출하기", "status": "active"}],
                },
                "user_input": "오늘 회사에서 너무 스트레스 받았어. 매운 엽떡 시켜 먹을까?",
                "agent_response": "오늘 하루 정말 고생 많으셨어요, 두둑님! 스트레스받을 땐 매운 음식이 당기죠. 하지만 지금 '배달 앱 VIP 탈출하기' 챌린지를 잘 이어가고 계셔서, 오늘은 마트 밀키트로 비슷한 만족을 챙겨보는 건 어떨까요? 비용도 아끼고 윤택지수도 지킬 수 있어요.",
            },
            # ── 예시 2: 고가 가치소비 고민 (게임 타이틀) ──
            {
                "context": {
                    "user_profile": {
                        "name": "이소비",
                        "age_group": "20대",
                        "job": "직장인",
                        "hobbies": ["게임"],
                    },
                    "financial_status": {
                        "monthly_budget": 600000,
                        "remaining_budget": 200000,
                        "today_spending": 15000,
                    },
                    "active_challenges": [],
                },
                "user_input": "이번에 새로 나온 게임 타이틀 7만 원인데 살까 말까 고민돼.",
                "agent_response": "새 게임 타이틀이면 고민될 만해요. 지금 남은 예산이 20만 원이라 무리는 크지 않아서, 이건 소비님 취향을 살리는 가치 소비에 가까워 보여요. 대신 이번 주에는 소소한 간식비를 조금만 줄여서 균형을 맞춰보면 더 좋겠어요.",
            },
            # ── 예시 3: 예산 초과 상태에서 추가 지출 욕구 ──
            {
                "context": {
                    "user_profile": {
                        "name": "박한달",
                        "age_group": "30대",
                        "job": "직장인",
                        "hobbies": ["독서"],
                    },
                    "financial_status": {
                        "monthly_budget": 700000,
                        "remaining_budget": -30000,
                        "today_spending": 45000,
                    },
                    "active_challenges": [],
                },
                "user_input": "오늘 친구 생일이라 선물 사야 하는데… 또 카드 긁어도 될까?",
                "agent_response": "이번 달 예산을 살짝 넘어선 상황이라 솔직히 말씀드릴게요. 선물을 챙기고 싶은 마음은 당연해요! 3만 원대 소소한 선물이나 직접 만든 케이크처럼 진심이 담긴 대안도 충분히 따뜻하거든요. 다음 달은 같이 계획 세워봐요! 😊",
            },
            # ── 예시 4: 구독 서비스 누수 소비 진단 ──
            {
                "context": {
                    "user_profile": {
                        "name": "최구독",
                        "age_group": "20대",
                        "job": "학생",
                        "hobbies": ["영화", "드라마"],
                    },
                    "financial_status": {
                        "monthly_budget": 400000,
                        "remaining_budget": 80000,
                        "today_spending": 0,
                    },
                    "active_challenges": [],
                },
                "user_input": "매달 어디선가 돈이 새는 느낌인데 뭐가 문제일까?",
                "agent_response": "지출 내역 보니까 OTT 구독이 겹쳐 있는 것 같아요! 넷플릭스·티빙처럼 비슷한 서비스를 동시에 쓰면 매달 2~3만 원이 그냥 빠져나가거든요. 실제로 이번 달 가장 많이 켠 서비스 하나만 남겨보는 건 어떨까요? 😊",
            },
            # ── 예시 5: 계획 소비 성공 칭찬 요청 ──
            {
                "context": {
                    "user_profile": {
                        "name": "정알뜰",
                        "age_group": "20대",
                        "job": "직장인",
                        "hobbies": ["요리"],
                    },
                    "financial_status": {
                        "monthly_budget": 500000,
                        "remaining_budget": 200000,
                        "today_spending": 0,
                    },
                    "active_challenges": [],
                },
                "user_input": "오늘 점심에 도시락 싸왔어! 칭찬해줘!",
                "agent_response": "와, 진짜요?! 오늘 완전 잘하셨다!! 🎉 점심 도시락 하나만 꾸준히 해도 한 달이면 10만 원 이상 차이 나거든요. 지금 잔여 예산도 20만 원이나 되니까, 이 페이스 유지하면 이번 달 윤택지수 점수 확 올릴 수 있겠어요!",
            },
            # ── 예시 6: 충동 지름 직전 자제 성공 ──
            {
                "context": {
                    "user_profile": {
                        "name": "강참을",
                        "age_group": "20대",
                        "job": "프리랜서",
                        "hobbies": ["패션"],
                    },
                    "financial_status": {
                        "monthly_budget": 500000,
                        "remaining_budget": 120000,
                        "today_spending": 10000,
                    },
                    "active_challenges": [{"name": "온라인 쇼핑 줄이기", "status": "active"}],
                },
                "user_input": "방금 쇼핑앱 열었다가 그냥 껐어. 나 대단하지?",
                "agent_response": "진짜 대단해요!!! 그 순간 앱 끄는 게 제일 어렵거든요. 💪 '온라인 쇼핑 줄이기' 챌린지 지금 너무 잘 하고 계신 거예요. 이 느낌 그대로만 가면 챌린지 성공은 거의 따놓은 당상이에요!",
            },
            # ── 예시 7: 급전 / 심각한 재정 걱정 ──
            {
                "context": {
                    "user_profile": {
                        "name": "윤힘들",
                        "age_group": "20대",
                        "job": "알바",
                        "hobbies": [],
                    },
                    "financial_status": {
                        "monthly_budget": 300000,
                        "remaining_budget": -150000,
                        "today_spending": 20000,
                    },
                    "active_challenges": [],
                },
                "user_input": "이번 달 진짜 힘들어. 월급날까지 어떻게 버티지.",
                "agent_response": "그 마음 충분히 이해해요, 정말 힘드셨겠다. 😔 당장은 구독 서비스를 잠깐 멈추고 냉장고 재료 먼저 소진하는 '냉장고 파먹기 모드'로 전환해보는 게 도움 돼요. 소소한 것부터 하나씩, 같이 버텨봐요!",
            },
            # ── 예시 8: 두둑 범위 외 질문 (주식/코인 추천) ──
            {
                "context": {
                    "user_profile": {
                        "name": "임투자",
                        "age_group": "30대",
                        "job": "직장인",
                        "hobbies": ["재테크"],
                    },
                    "financial_status": {
                        "monthly_budget": 800000,
                        "remaining_budget": 300000,
                        "today_spending": 5000,
                    },
                    "active_challenges": [],
                },
                "user_input": "요즘 어떤 주식이 오를 것 같아? 추천해줘.",
                "agent_response": "주식 종목 추천은 제 전문 영역 밖이라 섣불리 말씀드리기 어렵겠어요. 😅 저는 일상 소비에서 새는 돈을 줄이고 윤택지수를 높이는 데 특화되어 있거든요. 혹시 이번 달 소비에서 궁금한 게 있으시면 뭐든 물어봐주세요!",
            },
        ],
        "response_guidelines": {
            "max_length": "200자 이내로 간결하게 작성 (대화체에 맞게)",
            "structure": "1) 공감/인정 → 2) 재정 상황 언급(필요 시) → 3) 구체적 대안 또는 격려",
            "emoji_usage": "자연스럽게 1~2개 사용하여 친근감 표현",
            "forbidden": [
                "사용자 소비 패턴 비난 또는 훈계",
                "'하지 마세요', '안 됩니다' 등의 금지형 표현",
                "근거 없는 금융 상품 추천",
                "개인 정보 외부 공유",
            ],
        },
    }
}


def calculate_points(difficulty: str) -> int:
    min_pts, max_pts = DIFFICULTY_POINTS.get(difficulty, (200, 350))
    return (min_pts + max_pts) // 2


def parse_json_response(text: str) -> Optional[dict]:
    if not text:
        return None

    code_block = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if code_block:
        try:
            return json.loads(code_block.group(1).strip())
        except json.JSONDecodeError:
            pass

    brace_match = re.search(r"\{[\s\S]*\}", text)
    if brace_match:
        try:
            return json.loads(brace_match.group(0))
        except json.JSONDecodeError:
            pass

    try:
        return json.loads(text.strip())
    except json.JSONDecodeError:
        return None


class AIBaseModel(BaseModel):
    model_config = ConfigDict(extra="ignore")


class CashDenomination(AIBaseModel):
    value: int = 0
    count: int = 0


class CashPhotoResponse(AIBaseModel):
    is_cash_photo: bool = False
    detected_cash_total: int = 0
    denominations: List[CashDenomination] = Field(default_factory=list)
    confidence: float = 0.0


class MarketplacePostResponse(AIBaseModel):
    is_marketplace_post: bool = False
    platform_hint: str = "unknown"
    evidence: List[str] = Field(default_factory=list)
    confidence: float = 0.0


class OnePlusOnePhotoResponse(AIBaseModel):
    is_convenience_purchase: bool = False
    has_promotion_1p1_or_2p1: bool = False
    promotion_type: str = "none"
    evidence: List[str] = Field(default_factory=list)
    confidence: float = 0.0


class ImageItemMatchResponse(AIBaseModel):
    requested_name: str = Field(
        default="",
        description="Must exactly match one requested menu item name from the input list.",
    )
    found: bool = Field(
        default=False,
        description="True only when a matching menu and its unit price are clearly visible in the image.",
    )
    unit_amount: Optional[int] = Field(
        default=None,
        ge=0,
        description="Single-item KRW price for the matched menu. Null if not verified.",
    )
    category: str = Field(
        default="기타",
        description="One transaction category for the matched menu item.",
        json_schema_extra={"enum": CATEGORIES},
    )
    observed_menu_name: str = Field(
        default="",
        description="Menu text exactly as shown in the image for the matched item.",
    )


class ImageMatchAnalysisResponse(AIBaseModel):
    store_name: Optional[str] = Field(
        default=None,
        description="Normalized store name inferred only from evidence visible in the image. Null if unsure.",
    )
    item_matches: List[ImageItemMatchResponse] = Field(
        default_factory=list,
        description="One result per requested menu item, in the same order as the requested input list when possible.",
    )


class ResolvedMenuPriceResponse(AIBaseModel):
    found: bool = Field(
        default=False,
        description="True only when the requested menu price is explicitly confirmed on a grounded webpage.",
    )
    source_type: str = Field(
        default="",
        description="Type of grounded source used for the confirmed price.",
        json_schema_extra={"enum": RESOLVED_WEB_PRICE_SOURCE_TYPES},
    )
    source_url: str = Field(
        default="",
        description="Exact URL of the webpage where the menu price was confirmed.",
    )
    observed_menu_name: str = Field(
        default="",
        description="Menu text exactly as shown on the grounded webpage.",
    )
    amount: Optional[int] = Field(
        default=None,
        ge=0,
        description="Final KRW integer amount confirmed from the webpage.",
    )
    category: str = Field(
        default="기타",
        description="One transaction category for the grounded menu price.",
        json_schema_extra={"enum": CATEGORIES},
    )


class DiningCodeMenuMatchResponse(AIBaseModel):
    found: bool = Field(
        default=False,
        description="True only when the requested menu is confidently matched in the provided menu list.",
    )
    observed_menu_name: str = Field(
        default="",
        description="Menu name exactly as shown in the provided menu list.",
    )
    amount: Optional[int] = Field(
        default=None,
        ge=0,
        description="KRW integer price of the matched menu item.",
    )
    category: str = Field(
        default="기타",
        description="One transaction category for the matched menu.",
        json_schema_extra={"enum": CATEGORIES},
    )


class ParsedMenuItemResponse(AIBaseModel):
    name: str = Field(
        default="",
        description="Single menu item name preserved from the user's original input wording as much as possible.",
    )
    quantity: int = Field(
        default=1,
        ge=1,
        description="Positive integer quantity for that single menu item.",
    )


class MenuExpressionParseResponse(AIBaseModel):
    items: List[ParsedMenuItemResponse] = Field(
        default_factory=list,
        description="Parsed menu items split from the original user input.",
    )
    is_ambiguous: bool = Field(
        default=False,
        description="True when the input cannot be safely split into menu items without guessing.",
    )


class TransactionParseResponse(AIBaseModel):
    category: str = Field(
        default="기타",
        description="Best matching transaction category from the allowed category list.",
        json_schema_extra={"enum": CATEGORIES},
    )
    item: str = Field(default="", description="Main purchased item or transaction label.")
    store: str = Field(default="", description="Store or merchant name if identifiable.")
    amount: int = Field(default=0, ge=0, description="Final KRW integer amount.")
    date: str = Field(default="", description="Transaction date in ISO-8601 compatible string format.")
    memo: str = Field(default="", description="Short memo or context for the transaction.")
    address: str = Field(default="", description="Address or location text when identifiable.")
    is_fixed: bool = Field(
        default=False,
        description="True only for recurring fixed expenses such as subscriptions or rent.",
    )


class CoachingAdviceResponse(AIBaseModel):
    subject: str = ""
    title: str = ""
    coaching_content: str = ""
    analysis: str = ""
    generation_reason: str = ""
    estimated_savings: int = 0


class NumericConstraints(AIBaseModel):
    duration_days: Optional[int] = None
    target_amount: Optional[int] = None


class ChallengeResponse(AIBaseModel):
    name: str = ""
    difficulty: str = ""
    description: str = ""
    success_conditions: List[str] = Field(default_factory=list)
    numeric_constraints: NumericConstraints = Field(default_factory=NumericConstraints)
    target_keywords: List[str] = Field(default_factory=list)
    target_categories: List[str] = Field(default_factory=list)


class HealthScoreResponse(AIBaseModel):
    score: int = 0
    reason: str = ""


class LeakageResponse(AIBaseModel):
    total_leakage: int = 0
    reason: str = ""


class GrowthResponse(AIBaseModel):
    total_growth: int = 0
    reason: str = ""


class BudgetStatusResponse(AIBaseModel):
    budget: int = 0
    spent: int = 0
    remaining: int = 0
    message: str = ""


class TopCategoryResponse(AIBaseModel):
    category: str = ""
    amount: int = 0
    percentage: float = 0.0


class SummarySectionResponse(AIBaseModel):
    period: str = ""
    overview: str = ""
    budget_status: BudgetStatusResponse = Field(default_factory=BudgetStatusResponse)
    top_categories: List[TopCategoryResponse] = Field(default_factory=list)


class ImpulseSpendingItemResponse(AIBaseModel):
    description: str = ""
    reason: str = ""
    amount: int = 0


class ImpulseSpendingResponse(AIBaseModel):
    total_amount: int = 0
    percentage_of_total: float = 0.0
    items: List[ImpulseSpendingItemResponse] = Field(default_factory=list)


class LeakageAreaResponse(AIBaseModel):
    pattern: str = ""
    frequency: str = ""
    monthly_total: int = 0
    potential_savings: int = 0


class WeaknessAnalysisResponse(AIBaseModel):
    impulse_spending: ImpulseSpendingResponse = Field(default_factory=ImpulseSpendingResponse)
    leakage_areas: List[LeakageAreaResponse] = Field(default_factory=list)


class YuntaekFactorResponse(AIBaseModel):
    name: str = ""
    current_score: int = 0
    max_score: int = 0
    improvement_tip: str = ""


class YuntaekAnalysisResponse(AIBaseModel):
    current_score: int = 0
    previous_score: int = 0
    score_level: str = ""
    score_message: str = ""
    factors: List[YuntaekFactorResponse] = Field(default_factory=list)


class PriorityTaskResponse(AIBaseModel):
    rank: int = 0
    title: str = ""
    current_state: str = ""
    target_state: str = ""
    action_steps: List[str] = Field(default_factory=list)
    expected_savings: int = 0


class NextMonthStrategyResponse(AIBaseModel):
    priority_tasks: List[PriorityTaskResponse] = Field(default_factory=list)


class ExpertSummaryResponse(AIBaseModel):
    overall_assessment: str = ""
    key_achievement: str = ""
    key_improvement_area: str = ""
    professional_advice: str = ""


class MonthlyReportResponse(AIBaseModel):
    updated_persona_summary: str = ""
    summary: SummarySectionResponse = Field(default_factory=SummarySectionResponse)
    weakness_analysis: WeaknessAnalysisResponse = Field(default_factory=WeaknessAnalysisResponse)
    yuntaek_analysis: YuntaekAnalysisResponse = Field(default_factory=YuntaekAnalysisResponse)
    next_month_strategy: NextMonthStrategyResponse = Field(default_factory=NextMonthStrategyResponse)
    expert_summary: ExpertSummaryResponse = Field(default_factory=ExpertSummaryResponse)


DEFAULT_GEMINI_MODEL = "gemini-2.5-flash"


class AIClient:
    def __init__(self, purpose: str = "analysis"):
        self.purpose = purpose
        self.default_model = DEFAULT_GEMINI_MODEL
        self.api_version = (
            os.environ.get("GEMINI_API_VERSION", DEFAULT_GEMINI_API_VERSION) or DEFAULT_GEMINI_API_VERSION
        ).strip()
        self.api_key = (
            os.environ.get(f"GEMINI_API_KEY_{purpose.upper()}")
            or os.environ.get("GEMINI_API_KEY")
            or os.environ.get("GOOGLE_API_KEY")
        )
        if purpose == "coaching":
            self.model = os.environ.get("GEMINI_MODEL_COACHING", self.default_model)
        else:
            self.model = os.environ.get("GEMINI_MODEL_ANALYSIS", self.default_model)
        self.model = (self.model or self.default_model).strip()
        self.diningcode_client = DiningCodeClient()

        self.client = None
        if self.api_key:
            try:
                self.client = genai.Client(
                    api_key=self.api_key,
                    http_options=types.HttpOptions(api_version=self.api_version),
                )
            except Exception as exc:
                logger.error("Gemini 클라이언트 초기화 오류: %s", exc, exc_info=True)

    def _is_rate_limit_error(self, exc: Exception) -> bool:
        error_str = str(exc).lower()
        return any(
            token in error_str
            for token in (
                "429",
                "rate limit",
                "quota",
                "resource_exhausted",
                "resource has been exhausted",
            )
        )

    def _is_model_not_found_error(self, exc: Exception) -> bool:
        error_str = str(exc).lower()
        return (
            "404" in error_str
            and "model" in error_str
            and ("not found" in error_str or "not supported" in error_str)
        )

    def _get_model_candidates(self, requested_model: Optional[str] = None) -> List[str]:
        primary_model = (requested_model or self.model or self.default_model).strip()
        candidates = [primary_model]
        if primary_model != self.default_model:
            candidates.append(self.default_model)
        return candidates

    def _get_task_preset(self, task_name: str) -> Dict[str, Any]:
        return GEMINI_TASK_PRESETS.get(task_name, GEMINI_TASK_PRESETS["default"])

    def _build_generation_config(
        self,
        *,
        task_name: str,
        model: Optional[str] = None,
        response_model: Optional[type[AIBaseModel]] = None,
        use_web_search: bool = False,
        system_instruction: Optional[str] = None,
    ) -> types.GenerateContentConfig:
        preset = self._get_task_preset(task_name)
        selected_model = (model or self.model or self.default_model).strip()
        config_kwargs: Dict[str, Any] = {
            "temperature": preset.get("temperature", 0.2),
        }

        thinking_budget = preset.get("thinking_budget")
        if thinking_budget is not None and "gemini-2.5" in selected_model:
            config_kwargs["thinking_config"] = types.ThinkingConfig(
                thinking_budget=thinking_budget,
            )

        if system_instruction is not None:
            config_kwargs["system_instruction"] = system_instruction

        if use_web_search:
            config_kwargs["tools"] = [types.Tool(google_search=types.GoogleSearch())]
        elif response_model is not None:
            config_kwargs["response_mime_type"] = "application/json"
            config_kwargs["response_json_schema"] = self._sanitize_schema(
                response_model.model_json_schema()
            )

        return types.GenerateContentConfig(**config_kwargs)

    def _generate_content_with_fallback(
        self,
        *,
        contents: List[Any],
        config: types.GenerateContentConfig,
        model: Optional[str] = None,
    ) -> Any:
        candidates = self._get_model_candidates(model)
        last_exc: Optional[Exception] = None

        for index, candidate in enumerate(candidates):
            try:
                return self.client.models.generate_content(
                    model=candidate,
                    contents=contents,
                    config=config,
                )
            except Exception as exc:
                last_exc = exc
                if self._is_model_not_found_error(exc) and index + 1 < len(candidates):
                    fallback_model = candidates[index + 1]
                    logger.warning(
                        "Gemini 모델 '%s'을(를) 찾을 수 없어 '%s'로 재시도합니다.",
                        candidate,
                        fallback_model,
                    )
                    continue
                raise

        if last_exc:
            raise last_exc
        raise RuntimeError("Gemini 응답 생성 중 알 수 없는 오류가 발생했습니다.")

    def _build_contents(
        self,
        prompt: str,
        images: Optional[List[Dict[str, str]]] = None,
    ) -> List[Any]:
        parts: List[Any] = [prompt]
        for image in images or []:
            try:
                image_bytes = base64.b64decode(image["data"])
            except Exception:
                logger.warning("이미지 base64 디코딩 실패")
                continue

            parts.append(
                types.Part.from_bytes(
                    data=image_bytes,
                    mime_type=image["mime_type"],
                )
            )
        return parts

    def _normalize_image_mime_type(self, image_format: str) -> str:
        normalized = (image_format or "").strip().lower()
        if "/" in normalized:
            return normalized
        return IMAGE_FORMAT_TO_MIME_TYPE.get(normalized, "image/jpeg")

    def _to_plain(self, value: Any) -> Any:
        if value is None:
            return None
        if hasattr(value, "model_dump"):
            return value.model_dump()
        if isinstance(value, dict):
            return {k: self._to_plain(v) for k, v in value.items()}
        if isinstance(value, list):
            return [self._to_plain(item) for item in value]
        return value

    def _extract_response_text(self, response: Any) -> str:
        text = getattr(response, "text", None)
        if isinstance(text, str) and text.strip():
            return text.strip()

        response_data = self._to_plain(response) or {}
        texts: List[str] = []

        def walk(node: Any):
            if isinstance(node, dict):
                value = node.get("text")
                if isinstance(value, str) and value.strip():
                    texts.append(value.strip())
                for item in node.values():
                    walk(item)
            elif isinstance(node, list):
                for item in node:
                    walk(item)

        walk(response_data.get("candidates", response_data))
        return "\n".join(texts).strip()

    def _normalize_public_url(self, url: Any, *, drop_query: bool = False) -> str:
        normalized = str(url or "").strip()
        if not normalized.startswith(("http://", "https://")):
            return ""

        parts = urlsplit(normalized)
        scheme = (parts.scheme or "https").lower()
        netloc = (parts.netloc or "").lower()
        if not netloc:
            return ""

        path = parts.path or "/"
        if path != "/":
            path = path.rstrip("/")
        query = "" if drop_query else parts.query
        return urlunsplit((scheme, netloc, path, query, ""))

    def _extract_url_domain(self, url: Any) -> str:
        normalized = self._normalize_public_url(url)
        if not normalized:
            return ""

        domain = (urlsplit(normalized).netloc or "").lower()
        if domain.startswith("www."):
            domain = domain[4:]
        return domain

    def _build_url_match_keys(self, url: Any) -> set[str]:
        full_url = self._normalize_public_url(url, drop_query=False)
        no_query_url = self._normalize_public_url(url, drop_query=True)
        match_keys = {value for value in (full_url, no_query_url) if value}
        return match_keys

    def _build_diningcode_menu_match_prompt(
        self,
        *,
        store_name: str,
        menu_name: str,
        menu_data_text: str,
    ) -> str:
        categories = " | ".join(CATEGORIES)
        return f"""
다이닝코드 후보 메뉴만 보고 요청 메뉴의 가격을 JSON으로 반환하세요.

[입력]
- 매장명: {store_name}
- 요청 메뉴명: {menu_name}

[후보 메뉴]
{menu_data_text}

[규칙]
- 후보 목록 안에서만 찾으세요.
- 상표 기호, 띄어쓰기, 숫자 표기 차이는 무시해도 됩니다.
- `세트`, `콤보`, `라지`, `미디엄`, `스몰` 같은 옵션은 후보 메뉴도 같아야 합니다.
- `단품`은 기본 메뉴명만 적힌 기본 가격이면 일치로 볼 수 있습니다.
- 가격이 `변동`, `가격변동`, `시가`, `문의`, 빈 값이면 found는 false입니다.
- 확실히 일치하지 않으면 found는 false입니다.
- amount는 명시된 원화 정수만 사용하세요. 추정·계산 금지.
- category 허용값: {categories}

JSON만 반환:
{{
  "found": false,
  "observed_menu_name": "",
  "amount": null,
  "category": "기타"
}}
"""

    def _resolve_diningcode_price(
        self,
        *,
        store_name: str,
        menu_name: str,
    ) -> Optional[dict]:
        normalized_store_name = (store_name or "").strip()
        normalized_menu_name = (menu_name or "").strip()
        if not normalized_store_name or not normalized_menu_name:
            return self._build_grounded_web_lookup_failure()

        lookup_result = self.diningcode_client.lookup_menu_candidates(
            store_name=normalized_store_name,
            menu_name=normalized_menu_name,
            candidate_limit=8,
        )
        profile_url = self._normalize_public_url(lookup_result.get("profile_url"))
        menu_candidates = lookup_result.get("candidates") or []
        total_menu_count = int(lookup_result.get("menu_count") or 0)

        if not self.diningcode_client.is_profile_url(profile_url) or not menu_candidates:
            logger.info(
                "다이닝코드 후보 추출 실패 | store=%s | menu=%s | total=%s | candidates=%s | url=%s",
                normalized_store_name,
                normalized_menu_name,
                total_menu_count,
                len(menu_candidates),
                profile_url,
            )
            return self._build_grounded_web_lookup_failure()

        menu_lines = []
        for candidate in menu_candidates:
            if not isinstance(candidate, dict):
                continue
            name = str(candidate.get("name") or "").strip()
            price = str(candidate.get("price_text") or "").strip()
            if name:
                menu_lines.append(f"{name} | {price}" if price else name)

        if not menu_lines:
            return self._build_grounded_web_lookup_failure()

        menu_data_text = "\n".join(menu_lines)

        result, _ = self._parse(
            self._build_diningcode_menu_match_prompt(
                store_name=normalized_store_name,
                menu_name=normalized_menu_name,
                menu_data_text=menu_data_text,
            ),
            DiningCodeMenuMatchResponse,
            use_web_search=False,
            max_retries=1,
            task_name="menu_parse",
        )

        if result is None:
            return None

        found = bool(result.get("found"))
        amount = result.get("amount")
        observed_menu_name = str(result.get("observed_menu_name") or "").strip()

        if found and has_conflicting_menu_option_tokens(
            normalized_menu_name,
            observed_menu_name,
            allow_optional_single=True,
        ):
            logger.warning(
                "다이닝코드 메뉴 매칭 결과의 옵션 토큰이 요청과 불일치 | menu=%s | observed=%s",
                normalized_menu_name,
                observed_menu_name,
            )
            found = False

        if found and (amount is None or amount <= 0):
            found = False

        diningcode_result = {
            "found": found,
            "source_type": "diningcode" if found else "",
            "source_url": profile_url if found else "",
            "observed_menu_name": observed_menu_name if found else "",
            "amount": amount if found else None,
            "category": str(result.get("category") or "기타").strip() or "기타",
            "lookup_trace": {
                "diningcode": "success" if found else "failed",
                "official_page": "skipped" if found else "failed",
                "web_search": "skipped" if found else "failed",
            },
            "grounded_sources": [],
            "web_search_queries": [],
        }

        logger.info(
            "다이닝코드 후보 기반 매칭 결과 | store=%s | menu=%s | total=%s | candidates=%s | found=%s | amount=%s | url=%s",
            normalized_store_name,
            normalized_menu_name,
            total_menu_count,
            len(menu_lines),
            found,
            amount if found else None,
            profile_url,
        )
        return diningcode_result

    def _extract_grounding_metadata_nodes(self, response: Any) -> List[Dict[str, Any]]:
        response_data = self._to_plain(response) or {}
        found: List[Dict[str, Any]] = []

        def walk(node: Any):
            if isinstance(node, dict):
                grounding_metadata = node.get("groundingMetadata") or node.get("grounding_metadata")
                if isinstance(grounding_metadata, dict):
                    found.append(grounding_metadata)
                for value in node.values():
                    walk(value)
            elif isinstance(node, list):
                for item in node:
                    walk(item)

        walk(response_data)
        return found

    def _extract_grounded_sources(self, response: Any) -> List[Dict[str, str]]:
        found: List[Dict[str, str]] = []
        seen = set()

        for metadata in self._extract_grounding_metadata_nodes(response):
            chunks = metadata.get("groundingChunks") or metadata.get("grounding_chunks") or []
            for chunk in chunks:
                if not isinstance(chunk, dict):
                    continue
                web_chunk = chunk.get("web") or {}
                if not isinstance(web_chunk, dict):
                    continue

                url = self._normalize_public_url(web_chunk.get("uri") or web_chunk.get("url"))
                if not url or url in seen:
                    continue

                seen.add(url)
                found.append(
                    {
                        "title": str(web_chunk.get("title") or url).strip(),
                        "url": url,
                        "domain": self._extract_url_domain(url),
                    }
                )

        return found[:5]

    def _extract_web_search_queries(self, response: Any) -> List[str]:
        queries: List[str] = []
        seen = set()

        for metadata in self._extract_grounding_metadata_nodes(response):
            raw_queries = metadata.get("webSearchQueries") or metadata.get("web_search_queries") or []
            for raw_query in raw_queries:
                query = str(raw_query or "").strip()
                if not query or query in seen:
                    continue
                seen.add(query)
                queries.append(query)

        return queries[:5]

    def _normalize_allowed_web_price_source_types(
        self,
        allowed_source_types: Optional[Tuple[str, ...]] = None,
    ) -> Tuple[str, ...]:
        normalized_source_types: List[str] = []
        seen = set()
        raw_source_types = allowed_source_types or RESOLVED_WEB_PRICE_SOURCE_TYPES

        for raw_source_type in raw_source_types:
            source_type = str(raw_source_type or "").strip()
            if not source_type or source_type in seen:
                continue
            if source_type not in RESOLVED_WEB_PRICE_SOURCE_TYPES:
                continue
            seen.add(source_type)
            normalized_source_types.append(source_type)

        if not normalized_source_types:
            return tuple(RESOLVED_WEB_PRICE_SOURCE_TYPES)
        return tuple(normalized_source_types)

    def _merge_grounded_sources(
        self,
        existing_sources: Optional[List[Dict[str, str]]],
        new_sources: Optional[List[Dict[str, str]]],
    ) -> List[Dict[str, str]]:
        merged_sources: List[Dict[str, str]] = []
        seen = set()

        for source in (existing_sources or []) + (new_sources or []):
            if not isinstance(source, dict):
                continue
            url = self._normalize_public_url(source.get("url"))
            if not url or url in seen:
                continue
            seen.add(url)
            merged_sources.append(
                {
                    "title": str(source.get("title") or url).strip(),
                    "url": url,
                    "domain": self._extract_url_domain(url),
                }
            )

        return merged_sources[:5]

    def _merge_web_search_queries(
        self,
        existing_queries: Optional[List[str]],
        new_queries: Optional[List[str]],
    ) -> List[str]:
        merged_queries: List[str] = []
        seen = set()

        for raw_query in (existing_queries or []) + (new_queries or []):
            query = str(raw_query or "").strip()
            if not query or query in seen:
                continue
            seen.add(query)
            merged_queries.append(query)

        return merged_queries[:5]

    def _build_grounded_web_lookup_failure(
        self,
        *,
        category: Any = "기타",
        grounded_sources: Optional[List[Dict[str, str]]] = None,
        web_search_queries: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        return {
            "found": False,
            "source_type": "",
            "source_url": "",
            "observed_menu_name": "",
            "amount": None,
            "category": str(category or "기타").strip() or "기타",
            "lookup_trace": {
                "diningcode": "failed",
                "official_page": "failed",
                "web_search": "failed",
            },
            "grounded_sources": grounded_sources or [],
            "web_search_queries": web_search_queries or [],
        }

    def _build_lookup_trace_for_grounded_source(self, source_type: str) -> Dict[str, str]:
        if source_type in {"official_menu_page", "official_order_page"}:
            return {
                "diningcode": "failed",
                "official_page": "success",
                "web_search": "skipped",
            }

        if source_type == "web_search":
            return {
                "diningcode": "failed",
                "official_page": "failed",
                "web_search": "success",
            }

        return {
            "diningcode": "failed",
            "official_page": "failed",
            "web_search": "failed",
        }

    def _match_grounded_source(
        self,
        source_url: Any,
        grounded_sources: List[Dict[str, str]],
    ) -> Optional[Dict[str, str]]:
        requested_match_keys = self._build_url_match_keys(source_url)
        if not requested_match_keys:
            return None

        for grounded_source in grounded_sources:
            grounded_match_keys = self._build_url_match_keys(grounded_source.get("url"))
            if requested_match_keys & grounded_match_keys:
                return grounded_source

        return None

    def _validate_grounded_web_result(
        self,
        result: Dict[str, Any],
        response: Any,
        *,
        requested_menu_name: str,
    ) -> Dict[str, Any]:
        grounded_sources = self._extract_grounded_sources(response)
        web_search_queries = self._extract_web_search_queries(response)
        validated_result = dict(result)
        validated_result["grounded_sources"] = grounded_sources
        validated_result["web_search_queries"] = web_search_queries

        if not validated_result.get("found"):
            return validated_result

        source_type = str(validated_result.get("source_type") or "").strip()
        source_url = self._normalize_public_url(validated_result.get("source_url"))
        if not source_type:
            logger.warning("Gemini 웹 가격 응답의 source_type이 비어 있어 결과를 폐기합니다.")
            return self._build_grounded_web_lookup_failure(
                category=validated_result.get("category"),
                grounded_sources=grounded_sources,
                web_search_queries=web_search_queries,
            )

        if source_type not in RESOLVED_WEB_PRICE_SOURCE_TYPES:
            logger.warning("Gemini 웹 가격 응답의 source_type이 허용값이 아니어서 결과를 폐기합니다. source_type=%s", source_type)
            return self._build_grounded_web_lookup_failure(
                category=validated_result.get("category"),
                grounded_sources=grounded_sources,
                web_search_queries=web_search_queries,
            )

        if not source_url:
            logger.warning("Gemini 웹 가격 응답의 source_url이 비어 있거나 공개 URL이 아니어서 결과를 폐기합니다.")
            return self._build_grounded_web_lookup_failure(
                category=validated_result.get("category"),
                grounded_sources=grounded_sources,
                web_search_queries=web_search_queries,
            )

        source_domain = self._extract_url_domain(source_url)

        failure = lambda: self._build_grounded_web_lookup_failure(
            category=validated_result.get("category"),
            grounded_sources=grounded_sources,
            web_search_queries=web_search_queries,
        )

        if source_domain.endswith("diningcode.com"):
            logger.warning(
                "Gemini 웹 가격 응답의 source_url 도메인이 다이닝코드라 결과를 폐기합니다. source_url=%s",
                source_url,
            )
            return failure()

        if not grounded_sources:
            logger.warning("Gemini 웹 가격 응답을 검증할 grounding source가 없어 결과를 폐기합니다.")
            return failure()

        matched_source = self._match_grounded_source(source_url, grounded_sources)
        if matched_source is None:
            logger.warning(
                "Gemini 웹 가격 응답의 source_url이 grounding source와 일치하지 않아 결과를 폐기합니다. source_url=%s grounded=%s",
                validated_result.get("source_url"),
                [source.get("url") for source in grounded_sources],
            )
            return failure()

        matched_url = matched_source.get("url") or ""
        matched_domain = matched_source.get("domain") or self._extract_url_domain(matched_url)
        if matched_domain.endswith("diningcode.com"):
            logger.warning(
                "Gemini 웹 가격 응답의 grounding source 도메인이 다이닝코드라 결과를 폐기합니다. source_url=%s grounded=%s",
                validated_result.get("source_url"),
                matched_url,
            )
            return failure()
        validated_result["source_url"] = matched_url

        validated_result["source_type"] = source_type
        validated_result["lookup_trace"] = self._build_lookup_trace_for_grounded_source(source_type)

        if has_conflicting_menu_option_tokens(
            requested_menu_name,
            validated_result.get("observed_menu_name"),
            allow_optional_single=True,
        ):
            logger.warning(
                "Gemini 웹 가격 응답의 메뉴 옵션이 요청과 일치하지 않아 결과를 폐기합니다. requested=%s observed=%s",
                requested_menu_name,
                validated_result.get("observed_menu_name"),
            )
            return failure()

        return validated_result

    def _extract_search_sources(self, response: Any) -> List[Dict[str, str]]:
        grounded_sources = self._extract_grounded_sources(response)
        if grounded_sources:
            return [
                {
                    "title": source.get("title") or source.get("url") or "",
                    "url": source.get("url") or "",
                }
                for source in grounded_sources
                if source.get("url")
            ][:5]

        response_data = self._to_plain(response) or {}
        found: List[Dict[str, str]] = []
        seen = set()

        def walk(node: Any):
            if isinstance(node, dict):
                url = node.get("url") or node.get("uri")
                title = node.get("title") or node.get("name") or ""
                if isinstance(url, str) and url.startswith(("http://", "https://")) and url not in seen:
                    seen.add(url)
                    found.append({"title": title or url, "url": url})
                for value in node.values():
                    walk(value)
            elif isinstance(node, list):
                for item in node:
                    walk(item)

        walk(response_data)
        return found[:5]

    def _sanitize_schema(self, schema: Dict[str, Any]) -> Dict[str, Any]:
        defs = schema.get("$defs", {})

        def resolve(node: Any) -> Any:
            if not isinstance(node, dict):
                return node

            if "$ref" in node:
                ref_name = node["$ref"].split("/")[-1]
                return resolve(defs.get(ref_name, {}))

            if "anyOf" in node:
                resolved_options = [resolve(option) for option in node["anyOf"]]
                option_types: List[str] = []
                merged_any_of: Dict[str, Any] = {}
                for resolved in resolved_options:
                    resolved_type = resolved.get("type")
                    if isinstance(resolved_type, list):
                        option_types.extend(resolved_type)
                    elif isinstance(resolved_type, str):
                        option_types.append(resolved_type)
                if option_types:
                    merged_any_of["type"] = list(dict.fromkeys(option_types))

                for key in (
                    "description",
                    "enum",
                    "minimum",
                    "maximum",
                    "format",
                    "items",
                    "properties",
                    "required",
                    "additionalProperties",
                    "minItems",
                    "maxItems",
                ):
                    if key in node:
                        if key == "properties" and isinstance(node[key], dict):
                            merged_any_of[key] = {
                                prop: resolve(prop_schema)
                                for prop, prop_schema in node[key].items()
                            }
                        elif key == "items":
                            merged_any_of[key] = resolve(node[key])
                        elif key == "additionalProperties" and isinstance(node[key], dict):
                            merged_any_of[key] = resolve(node[key])
                        else:
                            merged_any_of[key] = node[key]
                        continue

                    for resolved in resolved_options:
                        if key in resolved:
                            merged_any_of[key] = resolved[key]
                            break

                if merged_any_of:
                    return merged_any_of

            cleaned: Dict[str, Any] = {}
            for key, value in node.items():
                if key in {"$defs", "$ref", "title", "default"}:
                    continue
                if key == "properties":
                    cleaned[key] = {prop: resolve(prop_schema) for prop, prop_schema in value.items()}
                elif key == "items":
                    cleaned[key] = resolve(value)
                elif key == "additionalProperties" and isinstance(value, dict):
                    cleaned[key] = resolve(value)
                elif key in {
                    "type",
                    "enum",
                    "required",
                    "description",
                    "nullable",
                    "propertyOrdering",
                    "minItems",
                    "maxItems",
                    "minimum",
                    "maximum",
                    "format",
                }:
                    cleaned[key] = value

            return cleaned

        return resolve(schema)

    def _parse(
        self,
        prompt: str,
        response_model: type[AIBaseModel],
        *,
        images: Optional[List[Dict[str, str]]] = None,
        use_web_search: bool = False,
        max_retries: int = 1,
        model: Optional[str] = None,
        task_name: str = "default",
    ) -> tuple[Optional[Dict[str, Any]], Optional[Any]]:
        if not self.client:
            logger.warning("Gemini 클라이언트가 초기화되지 않았습니다 (GEMINI_API_KEY 또는 GOOGLE_API_KEY 확인 필요)")
            return None, None

        selected_model = model or self.model
        config = self._build_generation_config(
            task_name=task_name,
            model=selected_model,
            response_model=None if use_web_search else response_model,
            use_web_search=use_web_search,
        )
        contents = self._build_contents(prompt, images=images)

        for attempt in range(max_retries + 1):
            try:
                response = self._generate_content_with_fallback(
                    contents=contents,
                    config=config,
                    model=selected_model,
                )
                parsed = getattr(response, "parsed", None)
                if parsed is None:
                    parsed = parse_json_response(self._extract_response_text(response))
                if parsed is None:
                    logger.error(
                        "Gemini 구조화 응답 파싱 실패. 원본 응답(앞 500자): %s",
                        self._extract_response_text(response)[:500],
                    )
                    return None, response

                validated = response_model.model_validate(parsed)
                return self._to_plain(validated), response
            except ValidationError as exc:
                logger.error("Gemini 응답 스키마 검증 실패: %s", exc, exc_info=True)
                return None, None
            except Exception as exc:
                if self._is_rate_limit_error(exc) and attempt < max_retries:
                    wait_time = 10 * (attempt + 1)
                    logger.warning(
                        "Gemini API 할당량 초과 또는 속도 제한 (시도 %d/%d). %d초 후 재시도...",
                        attempt + 1,
                        max_retries,
                        wait_time,
                    )
                    time.sleep(wait_time)
                    continue

                logger.error("Gemini API Error: %s", exc, exc_info=True)
                return None, None

        return None, None

    def generate_chat_reply(
        self,
        system_prompt: str,
        history: List[Dict[str, str]],
        user_message_content: str,
    ) -> Optional[str]:
        if not self.client:
            logger.warning("Gemini 클라이언트가 초기화되지 않았습니다 (GEMINI_API_KEY 또는 GOOGLE_API_KEY 확인 필요)")
            return None

        contents: List[Any] = []
        for message in history + [{"role": "user", "content": user_message_content}]:
            role = "model" if message.get("role") == "assistant" else "user"
            contents.append(
                types.Content(
                    role=role,
                    parts=[types.Part.from_text(text=message.get("content", ""))],
                )
            )

        try:
            response = self._generate_content_with_fallback(
                contents=contents,
                config=self._build_generation_config(
                    task_name="chat",
                    system_instruction=system_prompt,
                ),
            )
            return self._extract_response_text(response) or None
        except Exception as exc:
            logger.error("Gemini 채팅 응답 생성 오류: %s", exc, exc_info=True)
            return None

    def analyze_image(
        self,
        prompt: str,
        image_base64: str,
        response_model: type[AIBaseModel],
        mime_type: str = "image/jpeg",
        task_name: str = "vision_verification",
    ) -> Optional[dict]:
        if not image_base64:
            return None

        result, _ = self._parse(
            prompt,
            response_model,
            images=[{"data": image_base64, "mime_type": mime_type}],
            task_name=task_name,
        )
        return result

    def analyze_image_with_context(
        self,
        prompt: str,
        image_base64: str,
        response_model: type[AIBaseModel],
        mime_type: str = "image/jpeg",
        context: Optional[Dict[str, Any]] = None,
        task_name: str = "vision_verification",
    ) -> Optional[dict]:
        context_text = ""
        if context:
            try:
                context_text = f"\n\n[추가 문맥]\n{json.dumps(context, ensure_ascii=False)}"
            except Exception:
                context_text = ""

        return self.analyze_image(
            f"{prompt}{context_text}",
            image_base64,
            response_model=response_model,
            mime_type=mime_type,
            task_name=task_name,
        )

# 현금 사진 분석(챌린지)
    def analyze_cash_photo(
        self,
        image_base64: str,
        expected_remaining: int,
        mime_type: str = "image/jpeg",
    ) -> Optional[dict]:
        prompt = """
당신은 사진 속 현금 금액을 판정하는 심사기입니다.
사진에 보이는 지폐/동전의 권종과 개수를 추정하고 합계를 계산하세요.

중요 규칙:
- 현금이 아닌 사진이면 is_cash_photo는 false
- detected_cash_total은 사진에서 보이는 금액 합계 정수
- confidence는 0.0~1.0
"""
        return self.analyze_image_with_context(
            prompt=prompt,
            image_base64=image_base64,
            response_model=CashPhotoResponse,
            mime_type=mime_type,
            task_name="vision_verification",
            context={
                "expected_remaining": expected_remaining,
                "rule": "detected_cash_total must exactly equal expected_remaining",
            },
        )

# 중고거래 게시글 사진 분석(챌린지)
    def analyze_marketplace_post_photo(
        self,
        image_base64: str,
        mime_type: str = "image/jpeg",
    ) -> Optional[dict]:
        prompt = """
사진이 '중고거래 사이트/앱에 게시글(상품 등록 글)을 올린 화면'인지 판정하세요.
단순 채팅 화면, 상품 목록 화면, 사진첩 화면은 false입니다.
"""

        return self.analyze_image(
            prompt,
            image_base64,
            response_model=MarketplacePostResponse,
            mime_type=mime_type,
            task_name="vision_verification",
        )

# 1+1 사진 분석(챌린지)
    def analyze_one_plus_one_photo(
        self,
        image_base64: str,
        ocr_text: str = "",
        mime_type: str = "image/jpeg",
    ) -> Optional[dict]:
        prompt = """
사진과 OCR 텍스트를 함께 보고 다음을 판정하세요.
1. 편의점 구매 증거가 있는지
2. 1+1 또는 2+1 프로모션 증거가 있는지
"""

        return self.analyze_image_with_context(
            prompt=prompt,
            image_base64=image_base64,
            response_model=OnePlusOnePhotoResponse,
            mime_type=mime_type,
            task_name="vision_verification",
            context={
                "ocr_text": ocr_text or "",
                "convenience_keywords": ["편의점", "GS25", "CU", "이마트24", "세븐일레븐"],
            },
        )

    def _build_image_match_analysis_prompt(
        self,
        *,
        menu_name: Optional[str] = None,
        menu_items: Optional[List[Dict[str, Any]]] = None,
    ) -> str:
        normalized_menu_items: List[Dict[str, Any]] = []
        for raw_item in menu_items or []:
            if not isinstance(raw_item, dict):
                continue
            name = str(raw_item.get("name") or "").strip()
            if not name:
                continue
            try:
                quantity = int(raw_item.get("quantity") or 1)
            except (TypeError, ValueError):
                quantity = 1
            normalized_menu_items.append(
                {
                    "name": name,
                    "quantity": quantity if quantity > 0 else 1,
                }
            )
        if normalized_menu_items:
            request_hint = f"- 요청 메뉴 목록(JSON): {json.dumps(normalized_menu_items, ensure_ascii=False)}"
        else:
            request_hint = f"- 원본 메뉴 입력: {(menu_name or '').strip() or '없음'}"
        categories = " | ".join(CATEGORIES)
        return f"""
이미지 안 근거만 보고 매장명과 요청 메뉴별 단가 확인 결과를 JSON으로 반환하세요.

[입력]
{request_hint}

[규칙]
- `store_name`은 이미지에서 확실할 때만, 아니면 null
- `store_name`은 흔히 사용하는 정식 명칭을 사용합니다. ('starbucks' X -> '스타벅스' O)
- `item_matches`에는 요청 메뉴마다 결과를 1개씩 넣고 `requested_name`은 입력값을 그대로 사용합니다.
- 메뉴명과 1개 가격이 이미지에서 명확히 대응될 때만 `found=true`입니다.
- 총액, 추정값, 옵션/사이즈가 모호한 가격이면 `found=false`입니다.
- `unit_amount`는 1개 기준 원화 정수입니다.
- 이미지 밖 정보 사용, 추정, 계산은 금지합니다.
- category 허용값: {categories}
"""

    def analyze_image_match(
        self,
        image_base64: str,
        image_format: str,
        menu_name: Optional[str] = None,
        menu_items: Optional[List[Dict[str, Any]]] = None,
    ) -> Optional[dict]:
        if not image_base64:
            return None

        return self.analyze_image(
            self._build_image_match_analysis_prompt(
                menu_name=menu_name,
                menu_items=menu_items,
            ),
            image_base64,
            response_model=ImageMatchAnalysisResponse,
            mime_type=self._normalize_image_mime_type(image_format),
            task_name="image_match_extract",
        )

    def _build_web_price_resolution_prompt(
        self,
        store_name: str,
        menu_name: str,
        *,
        allowed_source_types: Optional[Tuple[str, ...]] = None,
    ) -> str:
        categories = " | ".join(CATEGORIES)
        normalized_allowed_source_types = self._normalize_allowed_web_price_source_types(allowed_source_types)
        source_types = " | ".join(normalized_allowed_source_types)
        option_matching_rule = (
            "- `세트`, `콤보`, `라지`, `미디엄`, `스몰` 같은 옵션은 페이지 메뉴명도 같은 옵션을 포함해야만 found를 true로 반환합니다.\n"
            "- `단품`은 페이지에서 기본 메뉴명만 쓰는 경우가 많으므로, 동일 메뉴의 기본 가격이 명시되어 있으면 found를 true로 반환할 수 있습니다."
        )
        if normalized_allowed_source_types == ("official_menu_page", "official_order_page"):
            source_scope_hint = "공식 메뉴 페이지 또는 공식 주문 페이지에서만 확인하세요."
        elif normalized_allowed_source_types == ("web_search",):
            source_scope_hint = "일반 웹 검색 결과에서만 확인하세요."
        else:
            source_scope_hint = "허용된 출처 범위 안에서만 확인하세요."
        return f"""
웹 검색으로 메뉴 가격을 확인하고 JSON만 반환하세요.

[입력]
- 매장명: {store_name}
- 메뉴명: {menu_name}
- 출처 범위: {source_scope_hint}

[규칙]
- 실제 페이지에서 메뉴명과 가격이 함께 확인될 때만 found=true입니다.
- 허용되지 않은 출처, 추정, 모호한 옵션/사이즈 가격은 사용하지 마세요.
- 중간 redirect가 아니라 가격을 확인한 최종 공개 URL을 `source_url`에 넣으세요.
{option_matching_rule}
- amount는 확인된 원화 정수만 사용하세요.
- source_type 허용값: {source_types}
- category 허용값: {categories}

JSON만 반환:
{{
  "found": false,
  "source_type": "",
  "source_url": "",
  "observed_menu_name": "",
  "amount": null,
  "category": "기타"
}}
"""

    def _resolve_price_from_web_search_attempt(
        self,
        *,
        store_name: str,
        menu_name: str,
        allowed_source_types: Tuple[str, ...],
    ) -> Optional[dict]:
        normalized_store_name = (store_name or "").strip()
        normalized_menu_name = (menu_name or "").strip()
        normalized_allowed_source_types = self._normalize_allowed_web_price_source_types(allowed_source_types)
        if not normalized_store_name or not normalized_menu_name:
            return None

        result, response = self._parse(
            self._build_web_price_resolution_prompt(
                store_name=normalized_store_name,
                menu_name=normalized_menu_name,
                allowed_source_types=normalized_allowed_source_types,
            ),
            ResolvedMenuPriceResponse,
            use_web_search=True,
            max_retries=1,
            task_name="grounded_web_lookup",
        )
        if not result:
            return None

        result = self._validate_grounded_web_result(
            result,
            response,
            requested_menu_name=normalized_menu_name,
        )

        if result.get("found") and result.get("source_type") not in normalized_allowed_source_types:
            logger.warning(
                "Gemini 웹 가격 응답의 source_type이 이번 호출의 허용 출처와 맞지 않아 결과를 폐기합니다. source_type=%s allowed=%s",
                result.get("source_type"),
                normalized_allowed_source_types,
            )
            result = self._build_grounded_web_lookup_failure(
                category=result.get("category"),
                grounded_sources=result.get("grounded_sources"),
                web_search_queries=result.get("web_search_queries"),
            )

        logger.info(
            "Image match Gemini web price attempt | store=%s | menu=%s | allowed=%s | validated=%s",
            normalized_store_name,
            normalized_menu_name,
            json.dumps(normalized_allowed_source_types, ensure_ascii=False),
            json.dumps(result, ensure_ascii=False),
        )
        return result

    def _build_menu_expression_parse_prompt(
        self,
        menu_name: str,
        store_name: Optional[str] = None,
    ) -> str:
        input_lines = []
        if store_name:
            input_lines.append(f"- 매장명: {store_name}")
        input_lines.append(f"- 주문 문장: {menu_name}")
        input_hint = "\n".join(input_lines)
        return f"""
주문 문장을 실제 메뉴 단위로만 분해해 JSON으로 반환하세요.

[입력]
{input_hint}

[규칙]
- 가격, 카테고리, 매장명은 추정하지 마세요.
- 여러 메뉴 가능성이 높으면 분해하고, 단일 메뉴 같으면 원문 표현을 유지하세요.
- 메뉴명은 입력 원문 표현을 최대한 보존하세요.
- 확신이 낮으면 임의로 합치거나 나누지 말고 `is_ambiguous=true`로 반환하세요.
- 수량 표현이 없으면 quantity는 1입니다.
- quantity는 1 이상의 정수만 반환하세요.

JSON만 반환:
{{
  "items": [
    {{
      "name": "",
      "quantity": 1
    }}
  ],
  "is_ambiguous": false
}}
"""

    def resolve_price_from_web_search(
        self,
        store_name: str,
        menu_name: str,
    ) -> Optional[dict]:
        normalized_store_name = (store_name or "").strip()
        normalized_menu_name = (menu_name or "").strip()
        if not normalized_store_name or not normalized_menu_name:
            return None

        store_lookup_names = build_store_lookup_names(normalized_store_name)
        aggregated_lookup_trace = {
            "diningcode": "failed",
            "official_page": "failed",
            "web_search": "failed",
        }
        aggregated_grounded_sources: List[Dict[str, str]] = []
        aggregated_web_search_queries: List[str] = []
        fallback_category: Any = "기타"

        diningcode_result = self._resolve_diningcode_price(
            store_name=store_lookup_names["full"],
            menu_name=normalized_menu_name,
        )
        if diningcode_result is None:
            return None

        fallback_category = diningcode_result.get("category") or fallback_category

        if diningcode_result.get("found"):
            aggregated_lookup_trace["diningcode"] = "success"
            aggregated_lookup_trace["official_page"] = "skipped"
            aggregated_lookup_trace["web_search"] = "skipped"
            final_result = dict(diningcode_result)
            final_result["lookup_trace"] = aggregated_lookup_trace

            logger.info(
                "Image match web price response | requested_store=%s | menu=%s | result=%s",
                normalized_store_name,
                normalized_menu_name,
                json.dumps(final_result, ensure_ascii=False),
            )
            return final_result

        lookup_attempts = [
            {
                "lookup_key": "official_page",
                "store_name": store_lookup_names["brand"] or store_lookup_names["full"],
                "allowed_source_types": ("official_menu_page", "official_order_page"),
            },
            {
                "lookup_key": "web_search",
                "store_name": store_lookup_names["full"],
                "allowed_source_types": ("web_search",),
            },
        ]

        for index, attempt in enumerate(lookup_attempts):
            result = self._resolve_price_from_web_search_attempt(
                store_name=attempt["store_name"],
                menu_name=normalized_menu_name,
                allowed_source_types=attempt["allowed_source_types"],
            )
            if result is None:
                return None

            aggregated_grounded_sources = self._merge_grounded_sources(
                aggregated_grounded_sources,
                result.get("grounded_sources"),
            )
            aggregated_web_search_queries = self._merge_web_search_queries(
                aggregated_web_search_queries,
                result.get("web_search_queries"),
            )
            fallback_category = result.get("category") or fallback_category

            if not result.get("found"):
                aggregated_lookup_trace[attempt["lookup_key"]] = "failed"
                continue

            aggregated_lookup_trace[attempt["lookup_key"]] = "success"
            for remaining_attempt in lookup_attempts[index + 1 :]:
                aggregated_lookup_trace[remaining_attempt["lookup_key"]] = "skipped"

            final_result = dict(result)
            final_result["lookup_trace"] = aggregated_lookup_trace
            final_result["grounded_sources"] = aggregated_grounded_sources
            final_result["web_search_queries"] = aggregated_web_search_queries
            break
        else:
            final_result = self._build_grounded_web_lookup_failure(
                category=fallback_category,
                grounded_sources=aggregated_grounded_sources,
                web_search_queries=aggregated_web_search_queries,
            )
            final_result["lookup_trace"] = aggregated_lookup_trace

        logger.info(
            "Image match web price response | requested_store=%s | menu=%s | result=%s | grounded=%s | queries=%s",
            normalized_store_name,
            normalized_menu_name,
            json.dumps(final_result, ensure_ascii=False),
            json.dumps(aggregated_grounded_sources, ensure_ascii=False),
            json.dumps(aggregated_web_search_queries, ensure_ascii=False),
        )
        return final_result

    def parse_menu_expression(
        self,
        menu_name: str,
        store_name: Optional[str] = None,
    ) -> Optional[dict]:
        normalized_menu_name = (menu_name or "").strip()
        if not normalized_menu_name:
            return None

        normalized_store_name = (store_name or "").strip()

        result, response = self._parse(
            self._build_menu_expression_parse_prompt(
                normalized_menu_name,
                store_name=normalized_store_name or None,
            ),
            MenuExpressionParseResponse,
            max_retries=1,
            task_name="menu_parse",
        )
        if not result:
            return None

        logger.info(
            "Image match Gemini menu parse response | store=%s | menu=%s | result=%s",
            normalized_store_name,
            normalized_menu_name,
            json.dumps(result, ensure_ascii=False),
        )
        return result

    def analyze_text(self, text: str) -> Optional[dict]:
        today = datetime.date.today().strftime("%Y-%m-%d")
        categories_str = ", ".join(CATEGORIES)

        prompt = f"""
당신은 텍스트에서 소비 정보를 추출하는 AI입니다.
다음 텍스트를 분석해 구조화된 소비 정보를 반환하세요.

[기준 정보]
- 오늘 날짜: {today}
- 허용 카테고리: {categories_str}

[입력 텍스트]
{text}

[규칙]
- amount는 정수만 반환
- 날짜가 없으면 오늘 날짜 사용
- address를 추정할 수 없으면 빈 문자열
- is_fixed는 구독료, 월세, 보험료처럼 매달 반복되는 지출만 true
"""

        result, _ = self._parse(
            prompt,
            TransactionParseResponse,
            task_name="transaction_parse",
        )
        if result:
            for field in ["category", "item", "store", "memo", "address", "date"]:
                result[field] = (result.get(field) or "").strip()
            result["amount"] = int(result.get("amount") or 0)
            result["is_fixed"] = bool(result.get("is_fixed"))
        return result

    def _build_coaching_prompt(
        self,
        transaction_list_str: str,
        *,
        use_web_search: bool,
        user_context: Optional[Dict[str, Any]] = None,
    ) -> str:
        user_context = user_context or {}
        spending_to_improve = (user_context.get("spending_to_improve") or "").strip()
        user_goal_section = "[사용자 목표]\n- 개선하고 싶은 소비: 정보 없음"
        priority_rules = """
[우선순위 규칙]
- generation_reason에는 최근 지출 패턴 중 무엇이 반복되어 이 코칭을 생성했는지 한 문장으로 설명하세요.
"""
        if spending_to_improve:
            user_goal_section = f"[사용자 목표]\n- 개선하고 싶은 소비: {spending_to_improve}"
            priority_rules = f"""
[우선순위 규칙]
- 사용자가 개선하고 싶은 소비가 있으면 최근 거래와 직접 연결되는 항목을 최우선으로 코칭하세요.
- 직접 일치하지 않더라도 같은 습관, 카테고리, 소비 맥락이면 우선 반영하세요.
- generation_reason에는 "{spending_to_improve}"를 왜 이 코칭과 연결했는지, 어떤 거래 패턴 때문에 우선 생성했는지 한 문장으로 설명하세요.
"""

        extra_rules = """
[웹 검색 사용 규칙]
- 위치 기반 대안과 키워드 기반 대안은 웹 검색으로 실제 정보가 확인된 경우에만 선택하세요.
- 검색 결과가 부족하면 행동 변화 제안 또는 누수 소비 방지로 전환하세요.
- 검색 결과로 확인된 가격, 상호, 후기, 거리 등의 정보만 사용하세요.
- URL은 본문에 넣지 마세요. 출처는 별도 수집됩니다.
"""
        subject_rule = "행동 변화 제안 | 누수 소비 방지 | 위치 기반 대안 | 키워드 기반 대안 중 하나"

        if not use_web_search:
            extra_rules = """
[추가 규칙]
- 지금은 웹 검색을 사용할 수 없으므로 subject는 행동 변화 제안 또는 누수 소비 방지 중 하나만 선택하세요.
- 실제 상호, 가격, 후기, 거리 정보는 추정해서 쓰지 마세요.
- 위치 기반 대안과 키워드 기반 대안은 선택하지 마세요.
"""
            subject_rule = "행동 변화 제안 | 누수 소비 방지 중 하나"

        return f"""
[역할]
당신은 '두둑' 서비스의 AI 소비 코치입니다.
사용자의 소비 취향을 존중하면서 만족도 높은 대안이나 실천 가능한 행동 변화를 제안하세요.

[사용자 프로필]
{user_goal_section}

[지출 내역]
{transaction_list_str}

[주제]
- 행동 변화 제안
- 누수 소비 방지
- 위치 기반 대안
- 키워드 기반 대안

{priority_rules}
{extra_rules}

[출력 규칙]
- analysis는 100자 이내
- generation_reason는 80자 이내
- coaching_content는 100자 이내
- title은 10자 이내
- estimated_savings는 정수
- subject는 위 4가지 중 하나

[반환 형식]
반드시 아래 JSON 객체만 반환하세요.
{{
  "subject": "{subject_rule}",
  "title": "10자 이내 코칭 제목",
  "coaching_content": "100자 이내 코칭 문장",
  "analysis": "100자 이내 소비 분석",
  "generation_reason": "왜 이 코칭을 우선 생성했는지 설명하는 한 문장",
  "estimated_savings": 0
}}

JSON 외의 설명, 코드블록, URL 본문 삽입은 금지합니다.
"""

    def get_advice(
        self,
        transaction_list_str: str,
        user_context: Optional[Dict[str, Any]] = None,
    ) -> Optional[dict]:
        prompt = self._build_coaching_prompt(
            transaction_list_str,
            use_web_search=True,
            user_context=user_context,
        )

        result, response = self._parse(
            prompt,
            CoachingAdviceResponse,
            use_web_search=True,
            task_name="coaching_search",
        )
        if not result:
            logger.warning("코칭 생성용 웹 검색 응답 파싱에 실패해 비검색 모드로 재시도합니다.")
            fallback_prompt = self._build_coaching_prompt(
                transaction_list_str,
                use_web_search=False,
                user_context=user_context,
            )
            result, response = self._parse(
                fallback_prompt,
                CoachingAdviceResponse,
                use_web_search=False,
                task_name="coaching_no_search",
            )
            if not result:
                return None

        result["sources"] = self._extract_search_sources(response)
        return result

    def generate_challenge(
        self,
        details: str,
        difficulty: str = None,
        user_spending_summary: str = None,
    ) -> Optional[dict]:
        spending_context = ""
        if user_spending_summary:
            spending_context = f"[사용자 소비 패턴]\n{user_spending_summary}"

        if difficulty:
            difficulty_context = f"[난이도]\n{difficulty.upper()}"
        else:
            difficulty_context = "[난이도]\n내용에 따라 EASY/NORMAL/HARD 중 선택"

        categories_str = ", ".join(CATEGORIES)

        prompt = f"""
[역할]
당신은 '두둑' 서비스의 AI 챌린지 설계자입니다.

[사용자 입력]
{details}

{spending_context}

{difficulty_context}
{DIFFICULTY_GUIDE}

[사용 가능한 카테고리]
{categories_str}

[규칙]
- 성공 조건은 구체적이고 측정 가능하게 작성
- numeric_constraints.duration_days를 반드시 포함
- target_keywords는 지출 항목 매칭용 키워드 배열
- target_categories는 위 카테고리만 사용
- 설명은 친근하고 동기부여가 되는 말투

{CHALLENGE_SCHEMA}
"""

        result, _ = self._parse(prompt, ChallengeResponse)
        if result:
            self._process_challenge_result(result, details, difficulty)
        return result

    def generate_challenge_from_coaching(
        self,
        coaching_data: dict,
        difficulty: str = None,
    ) -> Optional[dict]:
        if difficulty:
            difficulty_context = f"[난이도]\n{difficulty.upper()}"
        else:
            difficulty_context = "[난이도]\n코칭 내용에 따라 EASY/NORMAL/HARD 중 선택"

        categories_str = ", ".join(CATEGORIES)

        prompt = f"""
[역할]
당신은 '두둑' 서비스의 AI 챌린지 설계자입니다.
AI 소비 코칭 분석 결과를 바탕으로 사용자가 실천할 수 있는 챌린지를 생성합니다.

[코칭 정보]
- 제목: {coaching_data.get('title', '')}
- 주제: {coaching_data.get('subject', '')}
- 분석: {coaching_data.get('analysis', '')}
- 코칭: {coaching_data.get('coaching_content', '')}

{difficulty_context}
{DIFFICULTY_GUIDE}

[사용 가능한 카테고리]
{categories_str}

[규칙]
- 성공 조건은 구체적이고 측정 가능하게 작성
- numeric_constraints.duration_days를 반드시 포함
- target_keywords는 지출 항목 매칭용 키워드 배열
- target_categories는 위 카테고리만 사용
- 설명은 친근하고 동기부여가 되는 말투

{CHALLENGE_SCHEMA}
"""

        result, _ = self._parse(prompt, ChallengeResponse)
        if result:
            default_name = coaching_data.get("title", "코칭 기반 챌린지")
            self._process_challenge_result(result, default_name, difficulty)
            result["coaching_id"] = coaching_data.get("id")
        return result

    def _process_challenge_result(
        self,
        result: dict,
        fallback_name: str,
        user_difficulty: str = None,
    ):
        difficulty = user_difficulty or result.get("difficulty", "normal")
        result["difficulty"] = difficulty
        result["base_points"] = calculate_points(difficulty)

        constraints = result.get("numeric_constraints", {})
        raw_duration_days = constraints.get("duration_days")
        if raw_duration_days is None:
            logger.warning("Gemini challenge response missing duration_days; applying 7-day fallback")
            duration_days = 7
        else:
            try:
                duration_days = int(raw_duration_days)
            except (TypeError, ValueError):
                logger.warning(
                    "Gemini challenge response returned invalid duration_days=%r; applying 7-day fallback",
                    raw_duration_days,
                )
                duration_days = 7
        result["duration_days"] = max(1, min(duration_days, 365))
        target_amount = constraints.get("target_amount")
        result["target_amount"] = int(target_amount) if target_amount is not None else None

        if not result.get("target_categories"):
            result["target_categories"] = ["기타"]

        result.setdefault("name", fallback_name[:20] if fallback_name else "맞춤 챌린지")
        result.setdefault("description", "")
        result.setdefault("success_conditions", [])
        result.setdefault("target_keywords", [])

    def _get_transactions_summary(self, user_id: int, year: int, month: int) -> str:
        from apps.transactions.models import Transaction
        from django.db.models import Count, Sum
        from django.contrib.auth import get_user_model

        User = get_user_model()
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return ""

        start_date, end_date = get_month_datetime_range(year, month)

        transactions = Transaction.objects.filter(
            user=user,
            date__gte=start_date,
            date__lt=end_date,
        ).order_by("-date")

        if not transactions:
            return "이번 달 지출 내역이 없습니다."

        category_totals = list(
            transactions.values("category")
            .annotate(total=Sum("amount"), count=Count("id"))
            .order_by("-total")[:8]
        )
        frequent_stores = list(
            transactions.exclude(store="")
            .values("store")
            .annotate(total=Sum("amount"), count=Count("id"))
            .order_by("-count", "-total")[:8]
        )
        recent_transactions = list(transactions[:80])

        summary_lines = [f"{year}년 {month}월 지출 요약 (총 {transactions.count()}건):"]
        summary_lines.append("[카테고리별 합계]")
        for item in category_totals:
            summary_lines.append(
                f"- {item['category']}: {item['total']:,}원 / {item['count']}건"
            )
        if frequent_stores:
            summary_lines.append("[반복 방문 소비처]")
            for item in frequent_stores:
                summary_lines.append(
                    f"- {item['store']}: {item['total']:,}원 / {item['count']}건"
                )
        summary_lines.append("[최근 거래]")
        for tx in recent_transactions:
            summary_lines.append(
                f"- {tx.date.strftime('%Y-%m-%d')} | {tx.category} | {tx.item} | {tx.store} | {tx.amount:,}원"
            )
        return "\n".join(summary_lines)

    def analyze_health_score(self, user_id: int, year: int, month: int) -> Optional[int]:
        transactions_summary = self._get_transactions_summary(user_id, year, month)
        if not transactions_summary or transactions_summary == "이번 달 지출 내역이 없습니다.":
            return 0

        prompt = f"""
[역할]
당신은 소비 패턴을 분석하여 건강 점수를 산출하는 AI입니다.

[지출 내역]
{transactions_summary}

[분석 기준]
- 건강한 식품, 운동, 의료비 등 건강 관련 지출을 긍정 반영
- 패스트푸드, 배달음식, 술/유흥, 잦은 간식 소비를 부정 반영
- 규칙성, 지속성, 균형을 함께 평가

[점수 범위]
- 0~15 사이 정수
"""

        result, _ = self._parse(prompt, HealthScoreResponse)
        if result and "score" in result:
            return max(0, min(15, int(result["score"])))
        return None

    def analyze_leakage_spending(self, user_id: int, year: int, month: int) -> Optional[int]:
        transactions_summary = self._get_transactions_summary(user_id, year, month)
        if not transactions_summary or transactions_summary == "이번 달 지출 내역이 없습니다.":
            return 0

        prompt = f"""
[역할]
당신은 소비 패턴을 분석하여 누수 지출을 찾아내는 AI입니다.

[지출 내역]
{transactions_summary}

[누수 지출 정의]
- 습관적이고 반복적으로 빠져나가는 소액 지출
- 택시비, 편의점 충동구매, 배달비, 미사용 구독, 수수료 등이 대표적
- 필요한 지출은 제외
"""

        result, _ = self._parse(prompt, LeakageResponse)
        if result and "total_leakage" in result:
            return int(result["total_leakage"])
        return None

    def analyze_growth_spending(
        self,
        user_id: int,
        year: int,
        month: int,
        self_development_field: str = "",
    ) -> Optional[int]:
        transactions_summary = self._get_transactions_summary(user_id, year, month)
        if not transactions_summary or transactions_summary == "이번 달 지출 내역이 없습니다.":
            return 0

        self_development_line = (
            f"- 사용자의 자기개발 관심 분야: {self_development_field}"
            if self_development_field
            else "- 사용자의 자기개발 관심 분야: 정보 없음"
        )

        prompt = f"""
[역할]
당신은 소비 패턴을 분석하여 성장 소비를 찾아내는 AI입니다.

[사용자 맥락]
{self_development_line}

[지출 내역]
{transactions_summary}

[성장 소비 정의]
- 교육, 학습, 자기계발, 생산성 도구, 건강한 운동, 전문성 강화에 기여하는 지출
- 사용자의 자기개발 관심 분야와 직접 연결되는 지출은 더 강하게 성장 소비로 반영
- 관심 분야 정보가 없더라도 일반적인 교육/학습/운동/생산성 지출은 성장 소비로 인정
- 단순 오락/여가/사치성 지출은 제외
"""

        result, _ = self._parse(prompt, GrowthResponse)
        if result and "total_growth" in result:
            return int(result["total_growth"])
        return None

    def generate_monthly_report(self, report_data: dict) -> Optional[dict]:
        year = report_data.get("year")
        month = report_data.get("month")
        monthly_budget = report_data.get("monthly_budget", 0)
        total_spending = report_data.get("total_spending", 0)
        prev_total_spending = report_data.get("prev_total_spending", 0)
        category_spending = report_data.get("category_spending", [])
        yuntaek_score = report_data.get("yuntaek_score", 0)
        prev_yuntaek_score = report_data.get("prev_yuntaek_score", 0)
        score_breakdown = report_data.get("score_breakdown", {})
        challenge_count = report_data.get("challenge_count", 0)
        challenge_success_count = report_data.get("challenge_success_count", 0)

        job = report_data.get("job", "")
        hobbies = report_data.get("hobbies", "")
        marital_status = report_data.get("marital_status", "")
        self_dev = report_data.get("self_development_field", "")
        ai_persona_summary = report_data.get("ai_persona_summary", "")

        persona_lines = []
        if job:
            persona_lines.append(f"- 직업: {job}")
        if hobbies:
            persona_lines.append(f"- 취미: {hobbies}")
        if marital_status:
            persona_lines.append(f"- 결혼 여부: {marital_status}")
        if self_dev:
            persona_lines.append(f"- 자기개발 분야: {self_dev}")
        if ai_persona_summary:
            persona_lines.append(f"- 지난달까지 축적된 소비 성향 요약:\n  \"{ai_persona_summary}\"")
        else:
            persona_lines.append("- 지난달까지 축적된 소비 성향 요약: 정보 없음")

        category_lines = []
        for cat in category_spending[:5]:
            category_lines.append(f"- {cat['category']}: {cat['total']:,}원")
        category_str = "\n".join(category_lines) if category_lines else "- 데이터 없음"

        has_prev_data = prev_total_spending > 0
        if has_prev_data:
            change_rate = ((total_spending - prev_total_spending) / prev_total_spending) * 100
            change_str = f"{change_rate:+.1f}%"
        else:
            change_rate = 0
            change_str = "비교 데이터 없음"

        prompt = f"""
[역할]
당신은 '두둑' 서비스의 AI 재무 분석가입니다.
사용자의 월간 소비 데이터를 분석하여 구조화된 리포트를 작성합니다.

[사용자 페르소나]
{chr(10).join(persona_lines)}

[분석 데이터]
- 기간: {year}년 {month}월
- 월 예산: {monthly_budget:,.0f}원
- 총 지출: {total_spending:,.0f}원
- 전월 지출: {prev_total_spending:,.0f}원 (변화율: {change_str})
- 카테고리별 지출:
{category_str}
- 윤택지수: {yuntaek_score}점 (전월: {prev_yuntaek_score}점)
- 챌린지 참여: {challenge_count}개 (성공: {challenge_success_count}개)

[세부 점수]
- 예산 달성률: {score_breakdown.get('budget_achievement', 0)}/35점
- 대체 행동 실현: {score_breakdown.get('alternative_action', 0)}/20점
- 성장 점수: {score_breakdown.get('growth_consumption', 0)}/10점
- 건강 점수: {score_breakdown.get('health_score', 0)}/15점
- 꾸준함: {score_breakdown.get('spending_consistency', 0)}/7점
- 누수 지출: {score_breakdown.get('leakage_improvement', 0)}/10점
- 챌린지 참여: {score_breakdown.get('challenge_success', 0)}/3점

[중요]
- 숫자와 데이터 기반으로 작성
- 과도한 부정적 표현 금지
- 리포트는 top-level 키를 정확히 유지
- updated_persona_summary는 3~5문장
- summary, weakness_analysis, yuntaek_analysis, next_month_strategy, expert_summary를 모두 채울 것
- 전월 데이터가 없으면 비교 문장은 "비교 데이터 없음" 맥락으로 작성
- yuntaek_analysis.current_score는 {yuntaek_score}

[반드시 포함할 구조]
- summary.period, summary.overview, summary.budget_status, summary.top_categories
- summary.budget_status는 budget, spent, remaining, message를 포함할 것
- summary.top_categories 각 항목은 category, amount, percentage를 포함할 것
- weakness_analysis.impulse_spending, weakness_analysis.leakage_areas
- weakness_analysis.impulse_spending은 total_amount, percentage_of_total, items를 포함할 것
- weakness_analysis.impulse_spending.items 각 항목은 description, reason, amount를 포함할 것
- weakness_analysis.leakage_areas 각 항목은 pattern, frequency, monthly_total, potential_savings를 포함할 것
- yuntaek_analysis.current_score, yuntaek_analysis.previous_score, yuntaek_analysis.score_level, yuntaek_analysis.score_message, yuntaek_analysis.factors
- yuntaek_analysis.factors 각 항목은 name, current_score, max_score, improvement_tip을 포함할 것
- next_month_strategy.priority_tasks
- next_month_strategy.priority_tasks 각 항목은 rank, title, current_state, target_state, action_steps, expected_savings를 포함할 것
- expert_summary.overall_assessment, expert_summary.key_achievement, expert_summary.key_improvement_area, expert_summary.professional_advice

[제약]
- coaching_performance, monthly_comparison 같은 추가 top-level 키는 만들지 말 것
- next_month_strategy에는 priority_tasks만 넣을 것
- top_categories는 최대 5개, factors는 현재 점수 7개 항목만 넣을 것
        """

        result, _ = self._parse(prompt, MonthlyReportResponse)
        if not result:
            return None

        updated_persona = result.pop("updated_persona_summary", "")
        return {
            "report": result,
            "updated_persona_summary": updated_persona,
        }

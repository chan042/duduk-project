import base64
import datetime
import json
import logging
import os
import re
import time
from typing import Any, Dict, List, Optional

from google import genai
from google.genai import types
from pydantic import BaseModel, ConfigDict, Field, ValidationError
from apps.common.categories import TRANSACTION_CATEGORIES
from apps.common.image_formats import IMAGE_FORMAT_TO_MIME_TYPE
from apps.common.months import get_month_datetime_range

logger = logging.getLogger(__name__)

# ============================================================
# 상수 정의
# ============================================================

CATEGORIES = list(TRANSACTION_CATEGORIES)
RESOLVED_WEB_PRICE_SOURCE_TYPES = (
    "diningcode",
    "official_menu_page",
    "official_order_page",
)

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


class SearchSource(AIBaseModel):
    title: str = ""
    url: str = ""


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


class ImagePriceMatchResponse(AIBaseModel):
    found: bool = False
    amount: Optional[int] = None
    category: str = ""
    observed_menu_name: str = ""


class ImageMatchAnalysisResponse(AIBaseModel):
    store_name: Optional[str] = None
    image_price_match: ImagePriceMatchResponse = Field(default_factory=ImagePriceMatchResponse)


class ResolvedMenuPriceResponse(AIBaseModel):
    found: bool = False
    source_type: str = ""
    source_url: str = ""
    observed_menu_name: str = ""
    amount: Optional[int] = None
    category: str = ""


class TransactionParseResponse(AIBaseModel):
    category: str = ""
    item: str = ""
    store: str = ""
    amount: int = 0
    date: str = ""
    memo: str = ""
    address: str = ""
    is_fixed: bool = False


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

        self.client = None
        if self.api_key:
            try:
                self.client = genai.Client(
                    api_key=self.api_key,
                    http_options=types.HttpOptions(api_version="v1alpha"),
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

    def _extract_search_sources(self, response: Any) -> List[Dict[str, str]]:
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
                option_types: List[str] = []
                for option in node["anyOf"]:
                    resolved = resolve(option)
                    resolved_type = resolved.get("type")
                    if isinstance(resolved_type, list):
                        option_types.extend(resolved_type)
                    elif isinstance(resolved_type, str):
                        option_types.append(resolved_type)
                if option_types:
                    return {"type": list(dict.fromkeys(option_types))}

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
        allowed_domains: Optional[List[str]] = None,
        max_retries: int = 1,
        model: Optional[str] = None,
    ) -> tuple[Optional[Dict[str, Any]], Optional[Any]]:
        if not self.client:
            logger.warning("Gemini 클라이언트가 초기화되지 않았습니다 (GEMINI_API_KEY 또는 GOOGLE_API_KEY 확인 필요)")
            return None, None

        selected_model = model or self.model
        config_kwargs: Dict[str, Any] = {"temperature": 0.2}

        if use_web_search:
            config_kwargs["tools"] = [types.Tool(google_search=types.GoogleSearch())]
            if allowed_domains:
                logger.info("Gemini Google Search는 allowed_domains 필터를 지원하지 않아 무시합니다.")
        else:
            config_kwargs["response_mime_type"] = "application/json"
            config_kwargs["response_json_schema"] = self._sanitize_schema(
                response_model.model_json_schema()
            )

        config = types.GenerateContentConfig(**config_kwargs)
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
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    temperature=0.7,
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
    ) -> Optional[dict]:
        if not image_base64:
            return None

        result, _ = self._parse(
            prompt,
            response_model,
            images=[{"data": image_base64, "mime_type": mime_type}],
        )
        return result

    def analyze_image_with_context(
        self,
        prompt: str,
        image_base64: str,
        response_model: type[AIBaseModel],
        mime_type: str = "image/jpeg",
        context: Optional[Dict[str, Any]] = None,
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
            context={
                "ocr_text": ocr_text or "",
                "convenience_keywords": ["편의점", "GS25", "CU", "이마트24", "세븐일레븐"],
            },
        )

    def _build_image_match_analysis_prompt(self, menu_name: Optional[str] = None) -> str:
        menu_hint = (menu_name or "").strip() or "없음"
        categories = " | ".join(CATEGORIES)
        return f"""
[역할]
당신은 이미지 속 매장명과 요청 메뉴 가격 일치 여부를 판정하는 AI입니다.

[입력]
- 요청 메뉴명: {menu_hint}

[규칙]
- 가게명은 텍스트, 로고, 간판, 메뉴판, 컵/포장지, 인테리어 등 실제 이미지 근거만 사용합니다.
- 가게명은 통용 명칭으로 반환하고, 확신이 낮으면 store_name은 null로 반환합니다.
- image_price_match.found는 메뉴와 가격을 확인할 수 있는 이미지에서 요청 메뉴와 그 가격이 명시적으로 보이고, 가격이 하나의 정수 금액으로 명확히 대응될 때만 true입니다.
- 가격이 추정이거나 옵션/사이즈 때문에 어느 가격인지 모호하면 found는 false입니다.
- amount는 정수만 반환합니다.
- category는 아래 허용값 중 하나만 사용합니다.
- 반드시 JSON 객체만 반환하세요.

[category 허용값]
{categories}

[반환 형식]
{{
  "store_name": "실제로 식별된 가게명 또는 null",
  "image_price_match": {{
    "found": false,
    "amount": null,
    "category": "기타",
    "observed_menu_name": ""
  }}
}}
"""

    def analyze_image_match(
        self,
        image_base64: str,
        image_format: str,
        menu_name: Optional[str] = None,
    ) -> Optional[dict]:
        if not image_base64:
            return None

        normalized_menu_name = (menu_name or "").strip()
        result = self.analyze_image(
            self._build_image_match_analysis_prompt(menu_name=normalized_menu_name),
            image_base64,
            response_model=ImageMatchAnalysisResponse,
            mime_type=self._normalize_image_mime_type(image_format),
        )
        return result

    def _build_web_price_resolution_prompt(
        self,
        store_name: str,
        menu_name: str,
    ) -> str:
        categories = " | ".join(CATEGORIES)
        source_types = " | ".join(RESOLVED_WEB_PRICE_SOURCE_TYPES)
        return f"""
[역할]
당신은 웹 검색 결과를 바탕으로 매장 메뉴 가격을 판정하는 AI입니다.

[입력]
- 요청 매장명: {store_name}
- 요청 메뉴명: {menu_name}

[규칙]
- 반드시 웹 검색으로 실제 페이지를 확인한 뒤에만 결과를 반환합니다.
- 검색은 다이닝코드를 우선 확인하고, 찾지 못한 경우에만 공식 메뉴 페이지 또는 공식 주문 페이지를 확인합니다.
- 다이닝코드, 공식 메뉴 페이지, 공식 주문 페이지 외의 출처는 사용하지 않습니다.
- 요청 메뉴와 그 가격이 페이지에서 명시적으로 확인될 때만 found를 true로 반환합니다.
- 가격이 추정이거나 세트, 옵션, 사이즈 차이로 어느 가격인지 모호하면 found는 false입니다.
- source_type은 아래 허용값 중 하나만 사용합니다.
- source_url은 실제로 가격이 보인 페이지 URL이어야 합니다.
- observed_menu_name은 페이지에서 확인된 표현을 짧게 반환합니다.
- amount는 정수만 반환합니다.
- category는 아래 허용값 중 하나만 사용합니다.
- 가격을 확인하지 못하면 found는 false로 반환하고, 문자열 필드는 빈 문자열, amount는 null로 반환합니다.
- 최종 결과는 단 하나의 JSON 객체만 반환합니다.

[source_type 허용값]
{source_types}

[category 허용값]
{categories}

[반환 형식]
{{
  "found": false,
  "source_type": "",
  "source_url": "",
  "observed_menu_name": "",
  "amount": null,
  "category": "기타"
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

        result, response = self._parse(
            self._build_web_price_resolution_prompt(
                store_name=normalized_store_name,
                menu_name=normalized_menu_name,
            ),
            ResolvedMenuPriceResponse,
            use_web_search=True,
            max_retries=1,
        )
        if not result:
            return None

        raw_response_text = ""
        if response is not None:
            raw_response_text = self._extract_response_text(response)
        logger.info(
            "Image match Gemini web price response | store=%s | menu=%s | raw=%s",
            normalized_store_name,
            normalized_menu_name,
            raw_response_text or json.dumps(result, ensure_ascii=False),
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

        result, _ = self._parse(prompt, TransactionParseResponse)
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

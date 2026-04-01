import logging
import re
from collections import Counter
from typing import Any, Dict, List, Optional

from django.utils import timezone

from apps.common.categories import TRANSACTION_CATEGORIES
from apps.common.image_formats import MENU_PRICE_SOURCE_TYPES
from external.ai.client import AIClient

logger = logging.getLogger(__name__)


IMAGE_MATCH_THRESHOLD = 80
IMAGE_MATCH_OFFICIAL_FALLBACK_THRESHOLD = 70
IMAGE_MATCH_MAX_CANDIDATES = 5
ALLOWED_CATEGORY_SET = set(TRANSACTION_CATEGORIES)
ALLOWED_SOURCE_TYPE_SET = set(MENU_PRICE_SOURCE_TYPES)
OFFICIAL_SOURCE_TYPES = {"official_menu_page", "official_order_page"}
OPTION_TAG_KEYS = ("temperature", "size", "set_type")
SOURCE_RELIABILITY_SCORES = {
    "official_menu_page": 35,
    "official_order_page": 33,
    "delivery_app": 27,
    "portal_menu": 20,
    "blog_review": 12,
    "community": 8,
    "unknown": 0,
}
TEXT_TOKEN_PATTERN = re.compile(r"[0-9a-zA-Z가-힣]+")


# ============================================================
# 텍스트·값 정규화 유틸리티
# ============================================================

def _normalize_text(value: Any) -> str:
    return " ".join(str(value or "").strip().split())


def _compact_text(value: Any) -> str:
    return re.sub(r"\s+", "", _normalize_text(value)).lower()


def _tokenize_text(value: Any) -> List[str]:
    return TEXT_TOKEN_PATTERN.findall(_normalize_text(value).lower())


def _normalize_category_value(category: Any) -> str:
    normalized = _normalize_text(category)
    if normalized in ALLOWED_CATEGORY_SET:
        return normalized
    return "기타"


def _normalize_amount(amount: Any) -> Optional[int]:
    if amount in (None, ""):
        return None
    try:
        normalized = int(amount)
    except (TypeError, ValueError):
        return None
    return max(normalized, 0)


def _normalize_source_type(source_type: Any) -> str:
    normalized = _normalize_text(source_type) or "unknown"
    if normalized in ALLOWED_SOURCE_TYPE_SET:
        return normalized
    return "unknown"


# ============================================================
# 옵션 태그 유틸리티
# ============================================================

def _extract_option_tags(text: str) -> Dict[str, str]:
    normalized = _normalize_text(text).lower()
    tags = {"temperature": "", "size": "", "set_type": ""}

    if any(keyword in normalized for keyword in ("아이스", "ice", "iced", "차가운")):
        tags["temperature"] = "ice"
    elif any(keyword in normalized for keyword in ("핫", "hot", "따뜻", "뜨거")):
        tags["temperature"] = "hot"

    if "벤티" in normalized or "venti" in normalized:
        tags["size"] = "venti"
    elif "그란데" in normalized or "grande" in normalized:
        tags["size"] = "grande"
    elif "톨" in normalized or "tall" in normalized:
        tags["size"] = "tall"
    elif any(keyword in normalized for keyword in ("라지", "large", "big")):
        tags["size"] = "large"
    elif any(keyword in normalized for keyword in ("미디움", "medium")):
        tags["size"] = "medium"
    elif any(keyword in normalized for keyword in ("레귤러", "regular")):
        tags["size"] = "regular"
    elif any(keyword in normalized for keyword in ("스몰", "small")):
        tags["size"] = "small"

    if any(keyword in normalized for keyword in ("콤보", "combo")):
        tags["set_type"] = "combo"
    elif any(keyword in normalized for keyword in ("세트", "set")):
        tags["set_type"] = "set"
    elif any(keyword in normalized for keyword in ("단품", "single")):
        tags["set_type"] = "single"

    return tags


def _merge_option_tags(*tag_dicts: Optional[Dict[str, Any]]) -> Dict[str, str]:
    merged = {key: "" for key in OPTION_TAG_KEYS}
    for tag_dict in tag_dicts:
        if not isinstance(tag_dict, dict):
            continue
        for key in OPTION_TAG_KEYS:
            value = _normalize_text(tag_dict.get(key))
            if value:
                merged[key] = value.lower()
    return merged


def _keyword_overlap_score(left: str, right: str) -> float:
    left_tokens = set(_tokenize_text(left))
    right_tokens = set(_tokenize_text(right))
    if not left_tokens or not right_tokens:
        return 0.0
    return len(left_tokens & right_tokens) / max(len(left_tokens), len(right_tokens))


# ============================================================
# 후보 정규화
# ============================================================

def _normalize_candidate(candidate: Any) -> Optional[Dict[str, Any]]:
    if not isinstance(candidate, dict):
        return None

    observed_store_name = _normalize_text(candidate.get("observed_store_name"))
    observed_menu_name = _normalize_text(candidate.get("observed_menu_name"))

    return {
        "source_type": _normalize_source_type(candidate.get("source_type")),
        "source_url": _normalize_text(candidate.get("source_url")),
        "observed_store_name": observed_store_name,
        "observed_menu_name": observed_menu_name,
        "amount": _normalize_amount(candidate.get("amount")),
        "category": _normalize_category_value(candidate.get("category")),
        "option_tags": _merge_option_tags(
            _extract_option_tags(observed_menu_name),
            candidate.get("option_tags"),
        ),
        "is_price_explicit": bool(candidate.get("is_price_explicit")),
        "evidence_text": _normalize_text(candidate.get("evidence_text")),
    }


# ============================================================
# 이미지 → 가게 식별 서비스
# ============================================================

class ImageStoreAnalyzerService:
    def __init__(self, ai_client: Optional[AIClient] = None):
        self.ai_client = ai_client or AIClient(purpose="analysis")

    def analyze_store(
        self,
        *,
        image_data: str,
        image_format: str,
        menu_name: str,
    ) -> Optional[Dict[str, Any]]:
        normalized_menu_name = _normalize_text(menu_name)
        if not image_data or not normalized_menu_name:
            return None

        result = self.ai_client.analyze_store_from_image(
            image_base64=image_data,
            image_format=_normalize_text(image_format).lower(),
            menu_name=normalized_menu_name,
        )
        if result is None:
            return None

        store_name = _normalize_text(result.get("store_name")) or None

        return {
            "menu_name": normalized_menu_name,
            "store_name": store_name,
        }


# ============================================================
# 메뉴 가격 후보 수집 서비스
# ============================================================

class MenuPriceCandidateService:
    def __init__(self, ai_client: Optional[AIClient] = None):
        self.ai_client = ai_client or AIClient(purpose="analysis")

    def collect_candidates(
        self,
        confirmed_store_name: str,
        menu_name: str,
        max_candidates: int = IMAGE_MATCH_MAX_CANDIDATES,
    ) -> Optional[List[Dict[str, Any]]]:
        normalized_store_name = _normalize_text(confirmed_store_name)
        normalized_menu_name = _normalize_text(menu_name)
        candidate_limit = max(1, min(int(max_candidates or IMAGE_MATCH_MAX_CANDIDATES), IMAGE_MATCH_MAX_CANDIDATES))
        if not normalized_store_name or not normalized_menu_name:
            return []

        result = self.ai_client.search_menu_price_candidates(
            store_name=normalized_store_name,
            menu_name=normalized_menu_name,
            max_candidates=candidate_limit,
        )
        if result is None:
            return None

        raw_candidates = result.get("candidates") or []
        return [
            normalized
            for candidate in raw_candidates[:candidate_limit]
            for normalized in [_normalize_candidate(candidate)]
            if normalized is not None
        ]


# ============================================================
# 가격 근거 스코어링 (모듈 함수)
# ============================================================

def _compute_store_match_score(requested_store: str, observed_store: str) -> int:
    requested_compact = _compact_text(requested_store)
    observed_compact = _compact_text(observed_store)
    if not requested_compact or not observed_compact:
        return 0
    if requested_compact == observed_compact:
        return 15
    if requested_compact in observed_compact or observed_compact in requested_compact:
        return 12
    overlap = _keyword_overlap_score(requested_store, observed_store)
    if overlap >= 0.5:
        return 7
    if overlap > 0:
        return 4
    return 0


def _compute_menu_match_score(requested_menu: str, observed_menu: str) -> int:
    requested_compact = _compact_text(requested_menu)
    observed_compact = _compact_text(observed_menu)
    if not requested_compact or not observed_compact:
        return 0
    if requested_compact == observed_compact:
        return 25
    if requested_compact in observed_compact or observed_compact in requested_compact:
        return 20
    overlap = _keyword_overlap_score(requested_menu, observed_menu)
    if overlap >= 0.75:
        return 16
    if overlap >= 0.5:
        return 10
    if overlap > 0:
        return 5
    return 0


def _compute_option_match_score(
    request_option_tags: Dict[str, str],
    candidate_option_tags: Dict[str, str],
) -> tuple[int, int, bool]:
    explicit_request_values = [value for value in request_option_tags.values() if value]
    matched_count = 0
    partial_count = 0
    fatal_conflict = False

    for key in OPTION_TAG_KEYS:
        requested_value = request_option_tags.get(key) or ""
        candidate_value = candidate_option_tags.get(key) or ""
        if not requested_value:
            continue
        if not candidate_value:
            partial_count += 1
            continue
        if requested_value == candidate_value:
            matched_count += 1
            continue
        fatal_conflict = True

    if fatal_conflict:
        return 0, -40, True
    if explicit_request_values:
        if partial_count == 0:
            return 10, 0, False
        return 4, 0, False
    return 5, 0, False


def _compute_evidence_quality_score(candidate: Dict[str, Any]) -> int:
    amount = candidate.get("amount")
    evidence_text = candidate.get("evidence_text") or ""
    if candidate.get("is_price_explicit") and isinstance(amount, int) and amount > 0 and evidence_text:
        return 8
    if candidate.get("is_price_explicit") and isinstance(amount, int) and amount > 0:
        return 5
    if evidence_text:
        return 2
    return 0


def _compute_cross_source_bonus(candidate: Dict[str, Any], amount_counter: Counter) -> int:
    amount = candidate.get("amount")
    if not isinstance(amount, int) or amount <= 0:
        return 0
    if amount_counter.get(amount, 0) >= 2:
        return 10
    return 0


def _score_single_candidate(
    confirmed_store_name: str,
    menu_name: str,
    candidate: Dict[str, Any],
    amount_counter: Counter,
) -> Dict[str, Any]:
    observed_store_name = candidate.get("observed_store_name", "")
    observed_menu_name = candidate.get("observed_menu_name", "")
    amount = candidate.get("amount")
    request_option_tags = _extract_option_tags(menu_name)
    candidate_option_tags = _merge_option_tags(
        _extract_option_tags(observed_menu_name),
        candidate.get("option_tags"),
    )

    store_match_score = _compute_store_match_score(confirmed_store_name, observed_store_name)
    menu_match_score = _compute_menu_match_score(menu_name, observed_menu_name)
    option_match_score, option_penalty, fatal_conflict = _compute_option_match_score(
        request_option_tags=request_option_tags,
        candidate_option_tags=candidate_option_tags,
    )
    evidence_quality_score = _compute_evidence_quality_score(candidate)
    cross_source_bonus = _compute_cross_source_bonus(candidate, amount_counter)

    penalty = 0
    if not isinstance(amount, int) or amount <= 0:
        penalty -= 15
    if not candidate.get("evidence_text"):
        penalty -= 5
    if store_match_score == 0:
        penalty -= 10
    if menu_match_score == 0:
        penalty -= 15
    penalty += option_penalty

    raw_score = (
        SOURCE_RELIABILITY_SCORES.get(candidate.get("source_type"), 0)
        + store_match_score
        + menu_match_score
        + option_match_score
        + evidence_quality_score
        + cross_source_bonus
        + penalty
    )
    final_score = max(0, min(int(raw_score), 100))

    return {
        **candidate,
        "score": final_score,
        "score_breakdown": {
            "source_reliability": SOURCE_RELIABILITY_SCORES.get(candidate.get("source_type"), 0),
            "store_match": store_match_score,
            "menu_match": menu_match_score,
            "option_match": option_match_score,
            "evidence_quality": evidence_quality_score,
            "cross_source_bonus": cross_source_bonus,
            "penalty": penalty,
        },
        "fatal_conflict": fatal_conflict,
        "request_option_tags": request_option_tags,
        "candidate_option_tags": candidate_option_tags,
    }


def _has_top_price_conflict(ranked_candidates: List[Dict[str, Any]]) -> bool:
    explicit_candidates = [
        candidate
        for candidate in ranked_candidates
        if isinstance(candidate.get("amount"), int)
        and candidate["amount"] > 0
        and not candidate.get("fatal_conflict")
    ]
    if len(explicit_candidates) < 2:
        return False

    first = explicit_candidates[0]
    second = explicit_candidates[1]
    if first["amount"] == second["amount"]:
        return False
    return abs(first["score"] - second["score"]) <= 8


def _build_match_reason(best_candidate: Dict[str, Any]) -> str:
    if best_candidate["source_type"] in OFFICIAL_SOURCE_TYPES and best_candidate["score_breakdown"]["cross_source_bonus"] > 0:
        return "공식 출처 가격이 확인됐고 다른 출처와도 일치합니다."
    if best_candidate["source_type"] in OFFICIAL_SOURCE_TYPES:
        return "공식 출처에서 메뉴 가격이 확인됐습니다."
    if best_candidate["score_breakdown"]["cross_source_bonus"] > 0:
        return "여러 출처에서 같은 가격이 확인됐습니다."
    return "가격 근거가 비교적 선명해 자동 입력 기준을 충족했습니다."


def _log_scoring_result(
    confirmed_store_name: str,
    menu_name: str,
    result: Dict[str, Any],
    ranked_candidates: List[Dict[str, Any]],
) -> None:
    candidate_logs = []
    for index, candidate in enumerate(ranked_candidates, start=1):
        candidate_logs.append(
            {
                "rank": index,
                "source_type": candidate.get("source_type") or "unknown",
                "source_url": candidate.get("source_url") or "",
                "observed_store_name": candidate.get("observed_store_name") or "",
                "observed_menu_name": candidate.get("observed_menu_name") or "",
                "amount": candidate.get("amount"),
                "category": candidate.get("category") or "기타",
                "score": candidate.get("score", 0),
                "score_breakdown": candidate.get("score_breakdown") or {},
                "fatal_conflict": bool(candidate.get("fatal_conflict")),
                "is_price_explicit": bool(candidate.get("is_price_explicit")),
            }
        )

    logger.info(
        "Image match price scoring | store=%s | menu=%s | final_status=%s | final_amount=%s | reason=%s | candidates=%s",
        confirmed_store_name,
        menu_name,
        result.get("status"),
        result.get("amount"),
        result.get("reason") or "",
        candidate_logs,
    )


def score_candidates(
    confirmed_store_name: str,
    menu_name: str,
    candidates: List[Dict[str, Any]],
) -> Dict[str, Any]:
    normalized_store_name = _normalize_text(confirmed_store_name)
    normalized_menu_name = _normalize_text(menu_name)
    normalized_candidates = candidates or []

    if not normalized_candidates:
        result = _build_not_found_result(
            reason="가격 근거를 찾지 못함",
        )
        _log_scoring_result(normalized_store_name, normalized_menu_name, result, [])
        return result

    amount_counter = Counter(
        candidate.get("amount")
        for candidate in normalized_candidates
        if isinstance(candidate.get("amount"), int) and candidate.get("amount", 0) > 0
    )

    scored_candidates = [
        _score_single_candidate(normalized_store_name, normalized_menu_name, candidate, amount_counter)
        for candidate in normalized_candidates
    ]

    ranked_candidates = sorted(
        scored_candidates,
        key=lambda item: (
            item["score"],
            item["source_type"] in OFFICIAL_SOURCE_TYPES,
            item["is_price_explicit"],
            item.get("amount") or 0,
        ),
        reverse=True,
    )
    positive_ranked_candidates = [
        candidate
        for candidate in ranked_candidates
        if isinstance(candidate.get("amount"), int) and candidate["amount"] > 0
    ]

    if not positive_ranked_candidates:
        result = _build_not_found_result(
            best_candidate=ranked_candidates[0],
            reason="가격 근거를 찾지 못함",
        )
        _log_scoring_result(normalized_store_name, normalized_menu_name, result, ranked_candidates)
        return result

    best = positive_ranked_candidates[0]
    price_conflict = _has_top_price_conflict(positive_ranked_candidates)

    meets_standard_threshold = best["score"] >= IMAGE_MATCH_THRESHOLD
    meets_official_threshold = (
        best["score"] >= IMAGE_MATCH_OFFICIAL_FALLBACK_THRESHOLD
        and best["source_type"] in OFFICIAL_SOURCE_TYPES
    )
    is_high_confidence = (
        not best["fatal_conflict"]
        and not price_conflict
        and (meets_standard_threshold or meets_official_threshold)
    )

    if best["fatal_conflict"]:
        reason = "옵션 충돌 가능성이 있어 가장 가능성 높은 가격을 제안합니다."
    elif price_conflict:
        reason = "상위 가격 후보가 서로 달라 가장 가능성 높은 가격을 제안합니다."
    elif not is_high_confidence:
        reason = "신뢰도는 낮지만 가장 가능성 높은 가격 후보를 제안합니다."
    else:
        reason = _build_match_reason(best)

    result = {
        "status": "matched",
        "amount": best["amount"],
        "category": _normalize_category_value(best.get("category")),
        "reason": reason,
    }
    _log_scoring_result(normalized_store_name, normalized_menu_name, result, ranked_candidates)
    return result


def _build_not_found_result(
    *,
    reason: str,
    best_candidate: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    best_candidate = best_candidate or {}
    return {
        "status": "not_found",
        "amount": 0,
        "category": _normalize_category_value(best_candidate.get("category")),
        "reason": reason,
    }


# ============================================================
# 지출 입력 데이터 빌더 (모듈 함수)
# ============================================================

def build_transaction_prefill(
    *,
    confirmed_store_name: str,
    menu_name: str,
    amount: Optional[int] = None,
    category: Optional[str] = None,
) -> Dict[str, Any]:
    return {
        "store": _normalize_text(confirmed_store_name),
        "item": _normalize_text(menu_name),
        "amount": _normalize_amount(amount),
        "category": _normalize_category_value(category),
        "date": timezone.localdate().isoformat(),
    }

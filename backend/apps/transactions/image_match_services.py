import logging
from typing import Any, Dict, Optional

from django.utils import timezone

from apps.common.categories import TRANSACTION_CATEGORIES
from external.ai.client import AIClient

logger = logging.getLogger(__name__)


ALLOWED_CATEGORY_SET = set(TRANSACTION_CATEGORIES)
ALLOWED_WEB_SOURCE_TYPE_SET = {
    "diningcode",
    "official_menu_page",
    "official_order_page",
}


def _normalize_text(value: Any) -> str:
    return " ".join(str(value or "").strip().split())


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


def _normalize_web_source_type(source_type: Any) -> str:
    normalized = _normalize_text(source_type)
    if normalized in ALLOWED_WEB_SOURCE_TYPE_SET:
        return normalized
    return ""


def _build_matched_result(
    *,
    amount: Optional[int],
    category: Optional[str],
) -> Dict[str, Any]:
    return {
        "status": "matched",
        "amount": _normalize_amount(amount),
        "category": _normalize_category_value(category),
    }


def _build_not_found_result() -> Dict[str, Any]:
    return {
        "status": "not_found",
        "amount": 0,
        "category": "기타",
    }


def _build_resolve_failure_reason(
    *,
    raw_found: bool,
    amount: Optional[int],
    raw_source_type: str,
    normalized_source_type: str,
    source_url: str,
) -> str:
    reasons = []

    if not raw_found:
        reasons.append("gemini_found_false")
    if amount is None or amount <= 0:
        reasons.append("amount_missing_or_non_positive")
    if not normalized_source_type:
        reasons.append(f"invalid_source_type:{raw_source_type or 'empty'}")
    if not source_url:
        reasons.append("source_url_missing")

    if not reasons:
        return "가격 근거를 찾지 못함"

    return ", ".join(reasons)


def _log_analyze_result(menu_name: str, result: Dict[str, Any]) -> None:
    image_price_match = result.get("image_price_match") or {}
    logger.info(
        "Image match analyze | menu=%s | store=%s | image_price_found=%s | amount=%s | observed_menu=%s",
        menu_name,
        result.get("store_name") or "",
        bool(image_price_match.get("found")),
        image_price_match.get("amount"),
        image_price_match.get("observed_menu_name") or "",
    )


def _log_resolve_result(confirmed_store_name: str, menu_name: str, result: Dict[str, Any]) -> None:
    logger.info(
        "Image match resolve | store=%s | menu=%s | path=%s | amount=%s | status=%s | reason=%s | source_url=%s",
        confirmed_store_name,
        menu_name,
        result.get("path") or "not_found",
        result.get("amount"),
        result.get("status"),
        result.get("reason") or "",
        result.get("source_url") or "",
    )


class ImageStoreAnalyzerService:
    def __init__(self, ai_client: Optional[AIClient] = None):
        self.ai_client = ai_client or AIClient(purpose="analysis")

    def analyze_image_match(
        self,
        *,
        image_data: str,
        image_format: str,
        menu_name: str,
    ) -> Optional[Dict[str, Any]]:
        normalized_menu_name = _normalize_text(menu_name)
        if not image_data or not normalized_menu_name:
            return None

        result = self.ai_client.analyze_image_match(
            image_base64=image_data,
            image_format=_normalize_text(image_format).lower(),
            menu_name=normalized_menu_name,
        )
        if result is None:
            return None

        store_name = _normalize_text(result.get("store_name")) or None
        raw_image_price_match = result.get("image_price_match") or {}
        raw_found = bool(raw_image_price_match.get("found"))
        amount = _normalize_amount(raw_image_price_match.get("amount"))
        found = raw_found and amount is not None and amount > 0

        normalized_result = {
            "store_name": store_name,
            "image_price_match": {
                "found": found,
                "amount": amount if found else None,
                "category": _normalize_category_value(raw_image_price_match.get("category")),
                "observed_menu_name": _normalize_text(raw_image_price_match.get("observed_menu_name")) if found else "",
            },
        }
        _log_analyze_result(normalized_menu_name, normalized_result)
        return normalized_result


class MenuPriceResolverService:
    def __init__(self, ai_client: Optional[AIClient] = None):
        self.ai_client = ai_client or AIClient(purpose="analysis")

    def resolve_price(
        self,
        *,
        confirmed_store_name: str,
        menu_name: str,
    ) -> Optional[Dict[str, Any]]:
        normalized_store_name = _normalize_text(confirmed_store_name)
        normalized_menu_name = _normalize_text(menu_name)
        if not normalized_store_name or not normalized_menu_name:
            normalized_result = _build_not_found_result()
            _log_resolve_result(
                normalized_store_name,
                normalized_menu_name,
                {
                    **normalized_result,
                    "path": "",
                    "reason": "missing_store_or_menu",
                    "source_url": "",
                },
            )
            return normalized_result

        result = self.ai_client.resolve_price_from_web_search(
            store_name=normalized_store_name,
            menu_name=normalized_menu_name,
        )
        if result is None:
            return None

        raw_found = bool(result.get("found"))
        amount = _normalize_amount(result.get("amount"))
        raw_source_type = _normalize_text(result.get("source_type"))
        source_type = _normalize_web_source_type(raw_source_type)
        source_url = _normalize_text(result.get("source_url"))
        category = _normalize_category_value(result.get("category"))

        if not raw_found or amount is None or amount <= 0 or not source_type or not source_url:
            failure_reason = _build_resolve_failure_reason(
                raw_found=raw_found,
                amount=amount,
                raw_source_type=raw_source_type,
                normalized_source_type=source_type,
                source_url=source_url,
            )
            normalized_result = _build_not_found_result()
            _log_resolve_result(
                normalized_store_name,
                normalized_menu_name,
                {
                    **normalized_result,
                    "path": raw_source_type,
                    "reason": failure_reason,
                    "source_url": source_url,
                },
            )
            return normalized_result

        normalized_result = _build_matched_result(
            amount=amount,
            category=category,
        )
        _log_resolve_result(
            normalized_store_name,
            normalized_menu_name,
            {
                **normalized_result,
                "path": source_type,
                "reason": "web_price_confirmed",
                "source_url": source_url,
            },
        )
        return normalized_result


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

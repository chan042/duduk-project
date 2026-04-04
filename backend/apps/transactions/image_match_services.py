import logging
import re
from typing import Any, Dict, List, Optional, Tuple

from django.utils import timezone

from apps.common.categories import TRANSACTION_CATEGORIES
from apps.common.menu_options import (
    AMBIGUOUS_OPTION_TOKENS,
    has_conflicting_menu_option_tokens,
)
from external.ai.client import AIClient

logger = logging.getLogger(__name__)


ALLOWED_CATEGORY_SET = set(TRANSACTION_CATEGORIES)
ALLOWED_WEB_SOURCE_TYPE_SET = {
    "diningcode",
    "official_menu_page",
    "official_order_page",
    "web_search",
}
DEBUG_STAGE_STATUS_SET = {"success", "failed", "skipped"}
PARSE_MODE_SET = {"deterministic", "ai_fallback", "ambiguous"}
MENU_LIST_DELIMITER_PATTERN = re.compile(r"\s*[,，、]\s*")
QUANTITY_PATTERN = re.compile(
    r"^(?P<name>.+?)\s*(?P<quantity>\d+)\s*(?P<unit>개|잔|병|캔|인분|판|세트|컵|봉지|팩|알|줄|개입|pcs?)$",
    re.IGNORECASE,
)
BARE_TRAILING_NUMBER_PATTERN = re.compile(r"^(?P<name>.+?)\s+(?P<quantity>\d+)$")


def _normalize_text(value: Any) -> str:
    return " ".join(str(value or "").strip().split())


def _tokenize_menu_name(menu_name: str) -> List[str]:
    return [token for token in _normalize_text(menu_name).split() if token]


def _normalize_amount(amount: Any) -> Optional[int]:
    if amount in (None, ""):
        return None
    try:
        normalized = int(amount)
    except (TypeError, ValueError):
        return None
    return max(normalized, 0)


def _normalize_quantity(quantity: Any) -> int:
    try:
        normalized = int(quantity)
    except (TypeError, ValueError):
        return 1
    return normalized if normalized > 0 else 1


def _normalize_category_value(category: Any) -> str:
    normalized = _normalize_text(category)
    if normalized in ALLOWED_CATEGORY_SET:
        return normalized
    return "기타"


def _normalize_web_source_type(source_type: Any) -> str:
    normalized = _normalize_text(source_type)
    if normalized in ALLOWED_WEB_SOURCE_TYPE_SET:
        return normalized
    return ""

def _merge_parsed_menu_items(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    merged_items: List[Dict[str, Any]] = []
    name_to_item: Dict[str, Dict[str, Any]] = {}

    for item in items:
        name = _normalize_text(item.get("name"))
        if not name:
            continue

        quantity = _normalize_quantity(item.get("quantity"))
        if name in name_to_item:
            name_to_item[name]["quantity"] += quantity
            continue

        normalized_item = {
            "name": name,
            "quantity": quantity,
        }
        name_to_item[name] = normalized_item
        merged_items.append(normalized_item)

    return merged_items


def _extract_quantity_and_menu(menu_name: str) -> Tuple[str, int]:
    normalized_menu_name = _normalize_text(menu_name)
    if not normalized_menu_name:
        return "", 1

    quantity_match = QUANTITY_PATTERN.match(normalized_menu_name)
    if quantity_match:
        return (
            _normalize_text(quantity_match.group("name")),
            _normalize_quantity(quantity_match.group("quantity")),
        )

    return normalized_menu_name, 1


def _has_explicit_quantity_pattern(menu_name: str) -> bool:
    return QUANTITY_PATTERN.match(_normalize_text(menu_name)) is not None


def _split_menu_items_deterministically(menu_name: str) -> List[Dict[str, Any]]:
    normalized_menu_name = _normalize_text(menu_name)
    if not normalized_menu_name:
        return []

    parts = [part for part in MENU_LIST_DELIMITER_PATTERN.split(normalized_menu_name) if part]
    if not parts:
        return []

    parsed_items = []
    for part in parts:
        name, quantity = _extract_quantity_and_menu(part)
        if not name:
            continue
        parsed_items.append(
            {
                "name": name,
                "quantity": quantity,
            }
        )

    return _merge_parsed_menu_items(parsed_items)


def _looks_like_ambiguous_multi_menu(menu_name: str) -> bool:
    normalized_menu_name = _normalize_text(menu_name)
    if not normalized_menu_name or MENU_LIST_DELIMITER_PATTERN.search(normalized_menu_name):
        return False

    if _has_explicit_quantity_pattern(normalized_menu_name):
        return False

    tokens = _tokenize_menu_name(normalized_menu_name)
    if len(tokens) < 2:
        return False

    shorthand_quantity_match = BARE_TRAILING_NUMBER_PATTERN.match(normalized_menu_name)
    if shorthand_quantity_match:
        return True

    option_count = sum(1 for token in tokens if token.lower() in AMBIGUOUS_OPTION_TOKENS)
    if option_count >= 2:
        return True

    core_tokens = [
        token.lower()
        for token in tokens
        if token.lower() not in AMBIGUOUS_OPTION_TOKENS and not token.isdigit()
    ]
    if not core_tokens:
        return False

    seen_core_tokens = set()
    for token in core_tokens:
        if token in seen_core_tokens:
            return True
        seen_core_tokens.add(token)

    return len(core_tokens) == 2 and all(len(token) >= 4 for token in core_tokens)


def _should_attempt_ai_menu_parse(
    menu_name: str,
    *,
    force: bool = False,
) -> bool:
    normalized_menu_name = _normalize_text(menu_name)
    if not normalized_menu_name:
        return False

    if force:
        return True

    if MENU_LIST_DELIMITER_PATTERN.search(normalized_menu_name):
        return False

    if _has_explicit_quantity_pattern(normalized_menu_name):
        return False

    return _looks_like_ambiguous_multi_menu(normalized_menu_name)


def _normalize_parsed_menu_items(raw_items: Any) -> List[Dict[str, Any]]:
    normalized_items = []
    for raw_item in raw_items or []:
        if not isinstance(raw_item, dict):
            continue
        name = _normalize_text(raw_item.get("name"))
        if not name:
            continue
        normalized_items.append(
            {
                "name": name,
                "quantity": _normalize_quantity(raw_item.get("quantity")),
            }
        )

    return _merge_parsed_menu_items(normalized_items)


def _normalize_ai_menu_parse_items(result: Any) -> List[Dict[str, Any]]:
    if not isinstance(result, dict):
        return []
    return _normalize_parsed_menu_items(result.get("items") or [])


def _normalize_parse_mode(parse_mode: Any, *, default: str = "ambiguous") -> str:
    normalized = _normalize_text(parse_mode)
    if normalized in PARSE_MODE_SET:
        return normalized
    return default


def _request_ai_menu_parse(
    menu_name: str,
    *,
    ai_client: Optional[AIClient] = None,
    confirmed_store_name: str = "",
    force: bool = False,
) -> Optional[Dict[str, Any]]:
    normalized_menu_name = _normalize_text(menu_name)
    if (
        ai_client is None
        or not normalized_menu_name
        or not _should_attempt_ai_menu_parse(normalized_menu_name, force=force)
    ):
        return None

    ai_result = ai_client.parse_menu_expression(
        normalized_menu_name,
        store_name=_normalize_text(confirmed_store_name) or None,
    )
    if ai_result is None:
        return None

    ai_items = _normalize_ai_menu_parse_items(ai_result)
    if ai_items and not bool((ai_result or {}).get("is_ambiguous")):
        return {
            "items": ai_items,
            "parse_mode": "ai_fallback",
            "ai_attempted": True,
        }

    return {
        "items": [],
        "parse_mode": "ambiguous",
        "ai_attempted": True,
    }


def _parse_menu_expression(
    menu_name: str,
    *,
    ai_client: Optional[AIClient] = None,
    confirmed_store_name: str = "",
) -> Dict[str, Any]:
    normalized_menu_name = _normalize_text(menu_name)
    if not normalized_menu_name:
        return {
            "items": [],
            "parse_mode": "ambiguous",
            "ai_attempted": False,
        }

    has_delimiter = bool(MENU_LIST_DELIMITER_PATTERN.search(normalized_menu_name))
    if has_delimiter:
        return {
            "items": _split_menu_items_deterministically(normalized_menu_name),
            "parse_mode": "deterministic",
            "ai_attempted": False,
        }

    quantity_name, quantity_value = _extract_quantity_and_menu(normalized_menu_name)
    parsed_items = []
    if quantity_name:
        parsed_items.append(
            {
                "name": quantity_name,
                "quantity": quantity_value,
            }
        )

    if _has_explicit_quantity_pattern(normalized_menu_name):
        return {
            "items": parsed_items,
            "parse_mode": "deterministic",
            "ai_attempted": False,
        }

    tokens = _tokenize_menu_name(normalized_menu_name)
    if len(tokens) <= 1:
        return {
            "items": parsed_items,
            "parse_mode": "deterministic",
            "ai_attempted": False,
        }

    ai_parse_result = _request_ai_menu_parse(
        normalized_menu_name,
        ai_client=ai_client,
        confirmed_store_name=confirmed_store_name,
    )
    if ai_parse_result and ai_parse_result.get("items"):
        return ai_parse_result

    if ai_parse_result is not None:
        return ai_parse_result

    looks_ambiguous = _looks_like_ambiguous_multi_menu(normalized_menu_name)
    if not looks_ambiguous:
        return {
            "items": parsed_items,
            "parse_mode": "deterministic",
            "ai_attempted": False,
        }

    return {
        "items": parsed_items,
        "parse_mode": "ambiguous",
        "ai_attempted": False,
    }


def _resolve_parse_result(
    menu_name: str,
    *,
    ai_client: Optional[AIClient] = None,
    parsed_items: Any = None,
    parse_mode: Any = None,
    confirmed_store_name: str = "",
) -> Dict[str, Any]:
    normalized_items = _normalize_parsed_menu_items(parsed_items)
    if normalized_items:
        return {
            "items": normalized_items,
            "parse_mode": _normalize_parse_mode(parse_mode, default="deterministic"),
            "ai_attempted": False,
        }

    return _parse_menu_expression(
        menu_name,
        ai_client=ai_client,
        confirmed_store_name=confirmed_store_name,
    )

def _build_common_category(categories: List[str]) -> str:
    normalized_categories = [_normalize_category_value(category) for category in categories if category]
    if not normalized_categories:
        return "기타"
    unique_categories = set(normalized_categories)
    if len(unique_categories) == 1:
        return normalized_categories[0]
    return "기타"


def _normalize_image_item_matches(
    parsed_items: List[Dict[str, Any]],
    raw_item_matches: Any,
) -> List[Dict[str, Any]]:
    normalized_by_name: Dict[str, Dict[str, Any]] = {}
    for raw_item in raw_item_matches or []:
        if not isinstance(raw_item, dict):
            continue
        requested_name = _normalize_text(raw_item.get("requested_name"))
        if not requested_name or requested_name in normalized_by_name:
            continue

        unit_amount = _normalize_amount(raw_item.get("unit_amount"))
        observed_menu_name = _normalize_text(raw_item.get("observed_menu_name"))
        found = (
            bool(raw_item.get("found"))
            and unit_amount is not None
            and unit_amount > 0
            and not has_conflicting_menu_option_tokens(requested_name, observed_menu_name)
        )
        normalized_by_name[requested_name] = {
            "requested_name": requested_name,
            "quantity": _normalize_quantity(raw_item.get("quantity")),
            "found": found,
            "unit_amount": unit_amount if found else None,
            "category": _normalize_category_value(raw_item.get("category")),
            "observed_menu_name": observed_menu_name if found else "",
        }

    normalized_item_matches = []
    for parsed_item in parsed_items:
        requested_name = parsed_item["name"]
        raw_match = normalized_by_name.get(requested_name, {})
        normalized_item_matches.append(
            {
                "requested_name": requested_name,
                "quantity": parsed_item["quantity"],
                "found": bool(raw_match.get("found")),
                "unit_amount": raw_match.get("unit_amount"),
                "category": _normalize_category_value(raw_match.get("category")),
                "observed_menu_name": _normalize_text(raw_match.get("observed_menu_name")),
            }
        )

    return normalized_item_matches


def _build_image_price_summary(
    *,
    menu_name: str,
    item_matches: List[Dict[str, Any]],
) -> Dict[str, Any]:
    found_item_matches = [
        item_match
        for item_match in item_matches
        if item_match.get("found") and item_match.get("unit_amount")
    ]
    if not item_matches or len(found_item_matches) != len(item_matches):
        return {
            "found": False,
            "amount": None,
            "category": _build_common_category([item.get("category") for item in found_item_matches]),
            "observed_menu_name": "",
        }

    total_amount = sum(
        int(item_match["unit_amount"]) * int(item_match["quantity"])
        for item_match in found_item_matches
    )
    observed_menu_name = (
        found_item_matches[0]["observed_menu_name"]
        if len(found_item_matches) == 1
        else _normalize_text(menu_name)
    )
    return {
        "found": True,
        "amount": total_amount,
        "category": _build_common_category([item.get("category") for item in found_item_matches]),
        "observed_menu_name": observed_menu_name,
    }

def _build_default_lookup_trace() -> Dict[str, str]:
    return {
        "diningcode": "failed",
        "official_page": "failed",
        "web_search": "failed",
    }


def _normalize_lookup_trace(raw_lookup_trace: Any) -> Dict[str, str]:
    normalized_lookup_trace = _build_default_lookup_trace()
    if not isinstance(raw_lookup_trace, dict):
        return normalized_lookup_trace

    for key in normalized_lookup_trace:
        raw_status = _normalize_text(raw_lookup_trace.get(key))
        if raw_status in DEBUG_STAGE_STATUS_SET:
            normalized_lookup_trace[key] = raw_status

    return normalized_lookup_trace

def _build_lookup_trace_from_source_type(source_type: str) -> Dict[str, str]:
    if source_type == "diningcode":
        return {
            "diningcode": "success",
            "official_page": "skipped",
            "web_search": "skipped",
        }

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

    return _build_default_lookup_trace()


def _normalize_web_lookup_result(result: Any) -> Dict[str, Any]:
    if not isinstance(result, dict):
        return {
            "found": False,
            "amount": None,
            "category": "기타",
            "source_type": "",
            "source_url": "",
            "observed_menu_name": "",
            "lookup_trace": _build_default_lookup_trace(),
            "grounded_sources": [],
            "web_search_queries": [],
        }

    amount = _normalize_amount(result.get("amount"))
    source_type = _normalize_web_source_type(result.get("source_type"))
    source_url = _normalize_text(result.get("source_url"))
    grounded_sources = result.get("grounded_sources") if isinstance(result.get("grounded_sources"), list) else []
    web_search_queries = []
    for raw_query in result.get("web_search_queries") or []:
        normalized_query = _normalize_text(raw_query)
        if normalized_query:
            web_search_queries.append(normalized_query)
    found = bool(result.get("found")) and amount is not None and amount > 0 and bool(source_type) and bool(source_url)
    lookup_trace = _normalize_lookup_trace(result.get("lookup_trace"))
    if found and lookup_trace == _build_default_lookup_trace():
        lookup_trace = _build_lookup_trace_from_source_type(source_type)
    return {
        "found": found,
        "amount": amount if found else None,
        "category": _normalize_category_value(result.get("category")),
        "source_type": source_type if found else "",
        "source_url": source_url if found else "",
        "observed_menu_name": _normalize_text(result.get("observed_menu_name")) if found else "",
        "lookup_trace": lookup_trace,
        "grounded_sources": grounded_sources,
        "web_search_queries": web_search_queries,
    }


def _build_failed_result(
    *,
    category: Optional[str] = None,
) -> Dict[str, Any]:
    return {
        "status": "failed",
        "amount": 0,
        "category": _normalize_category_value(category),
    }


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


def _resolve_menu_items_once(
    *,
    ai_client: AIClient,
    confirmed_store_name: str,
    menu_name: str,
    parsed_items: List[Dict[str, Any]],
    item_matches: Optional[List[Dict[str, Any]]] = None,
) -> Optional[Dict[str, Any]]:
    normalized_image_item_matches = _normalize_image_item_matches(parsed_items, item_matches)
    image_item_match_by_name = {
        item_match["requested_name"]: item_match
        for item_match in normalized_image_item_matches
    }

    total_amount = 0
    resolved_categories = []

    for parsed_item in parsed_items:
        menu_item_name = parsed_item["name"]
        quantity = parsed_item["quantity"]
        cached_image_item = image_item_match_by_name.get(menu_item_name) or {}
        cached_unit_amount = _normalize_amount(cached_image_item.get("unit_amount"))
        cached_found = bool(cached_image_item.get("found")) and cached_unit_amount is not None and cached_unit_amount > 0

        if cached_found:
            resolved_amount = cached_unit_amount * quantity
            resolved_categories.append(cached_image_item.get("category"))
            total_amount += resolved_amount
            continue

        raw_web_result = ai_client.resolve_price_from_web_search(
            store_name=confirmed_store_name,
            menu_name=menu_item_name,
        )
        if raw_web_result is None:
            return None

        normalized_web_result = _normalize_web_lookup_result(raw_web_result)
        if normalized_web_result.get("found") and has_conflicting_menu_option_tokens(
            menu_item_name,
            normalized_web_result.get("observed_menu_name"),
            allow_optional_single=True,
        ):
            normalized_web_result = {
                **normalized_web_result,
                "found": False,
                "amount": None,
                "source_type": "",
                "source_url": "",
            }

        if not normalized_web_result.get("found"):
            return {
                "ok": False,
                "result": _build_failed_result(
                    category=normalized_web_result.get("category"),
                ),
            }

        resolved_amount = int(normalized_web_result["amount"]) * quantity
        total_amount += resolved_amount
        resolved_categories.append(normalized_web_result.get("category"))

    return {
        "ok": True,
        "result": _build_matched_result(
            amount=total_amount,
            category=_build_common_category(resolved_categories),
        ),
    }


def _should_retry_with_ai_reparse(
    *,
    menu_name: str,
    ai_client: Optional[AIClient],
    parse_mode: str,
    parsed_items: List[Dict[str, Any]],
    ai_parse_attempted: bool,
) -> bool:
    if ai_client is None or ai_parse_attempted:
        return False

    if parse_mode == "ai_fallback":
        return False

    if len(parsed_items) != 1:
        return False

    return _should_attempt_ai_menu_parse(menu_name)


def _log_analyze_result(menu_name: str, result: Dict[str, Any]) -> None:
    image_price_match = result.get("image_price_match") or {}
    logger.info(
        "Image match analyze | menu=%s | store=%s | image_price_found=%s | amount=%s",
        menu_name,
        result.get("store_name") or "",
        bool(image_price_match.get("found")),
        image_price_match.get("amount"),
    )


def _log_resolve_result(confirmed_store_name: str, menu_name: str, result: Dict[str, Any]) -> None:
    logger.info(
        "Image match resolve | store=%s | menu=%s | status=%s | amount=%s",
        confirmed_store_name,
        menu_name,
        result.get("status"),
        result.get("amount"),
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

        parse_result = _resolve_parse_result(
            normalized_menu_name,
            ai_client=self.ai_client,
        )
        requested_menu_items = parse_result.get("items") or []

        result = self.ai_client.analyze_image_match(
            image_base64=image_data,
            image_format=_normalize_text(image_format).lower(),
            menu_name=normalized_menu_name,
            menu_items=requested_menu_items,
        )
        if result is None:
            return None

        normalized_item_matches = _normalize_image_item_matches(
            requested_menu_items,
            result.get("item_matches"),
        )

        summary_match = _build_image_price_summary(
            menu_name=normalized_menu_name,
            item_matches=normalized_item_matches,
        )
        normalized_result = {
            "store_name": _normalize_text(result.get("store_name")) or None,
            "image_price_match": summary_match,
            "item_matches": normalized_item_matches,
            "parsed_items": requested_menu_items,
            "parse_mode": _normalize_parse_mode(parse_result.get("parse_mode")),
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
        item_matches: Optional[List[Dict[str, Any]]] = None,
        parsed_items: Optional[List[Dict[str, Any]]] = None,
        parse_mode: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        normalized_store_name = _normalize_text(confirmed_store_name)
        normalized_menu_name = _normalize_text(menu_name)
        if not normalized_store_name or not normalized_menu_name:
            result = _build_failed_result()
            _log_resolve_result(normalized_store_name, normalized_menu_name, result)
            return result

        parse_result = _resolve_parse_result(
            normalized_menu_name,
            ai_client=self.ai_client,
            parsed_items=parsed_items,
            parse_mode=parse_mode,
            confirmed_store_name=normalized_store_name,
        )
        parsed_items = parse_result.get("items") or []
        parse_mode = _normalize_parse_mode(parse_result.get("parse_mode"))
        ai_parse_attempted = bool(parse_result.get("ai_attempted"))

        if parse_mode == "ambiguous" or not parsed_items:
            result = _build_failed_result()
            _log_resolve_result(normalized_store_name, normalized_menu_name, result)
            return result

        resolution_outcome = _resolve_menu_items_once(
            ai_client=self.ai_client,
            confirmed_store_name=normalized_store_name,
            menu_name=normalized_menu_name,
            parsed_items=parsed_items,
            item_matches=item_matches,
        )
        if resolution_outcome is None:
            return None

        if not resolution_outcome.get("ok") and _should_retry_with_ai_reparse(
            menu_name=normalized_menu_name,
            ai_client=self.ai_client,
            parse_mode=parse_mode,
            parsed_items=parsed_items,
            ai_parse_attempted=ai_parse_attempted,
        ):
            retry_parse_result = _request_ai_menu_parse(
                normalized_menu_name,
                ai_client=self.ai_client,
                confirmed_store_name=normalized_store_name,
                force=True,
            )
            retry_items = _normalize_parsed_menu_items((retry_parse_result or {}).get("items") or [])
            if retry_items and retry_items != parsed_items:
                retry_outcome = _resolve_menu_items_once(
                    ai_client=self.ai_client,
                    confirmed_store_name=normalized_store_name,
                    menu_name=normalized_menu_name,
                    parsed_items=retry_items,
                    item_matches=item_matches,
                )
                if retry_outcome is None:
                    return None
                resolution_outcome = retry_outcome

        result = resolution_outcome["result"]
        _log_resolve_result(normalized_store_name, normalized_menu_name, result)
        return result


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

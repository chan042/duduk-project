import json
import logging
import re
import unicodedata
from difflib import SequenceMatcher
from typing import Any, Dict, List, Optional
from urllib.parse import quote, urlsplit, urlunsplit

import requests as http_requests

from apps.common.menu_options import has_conflicting_menu_option_tokens

logger = logging.getLogger(__name__)


class DiningCodeClient:
    _REQUEST_HEADERS = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/131.0.0.0 Safari/537.36"
        ),
        "Accept-Language": "ko-KR,ko;q=0.9",
    }
    _REQUEST_TIMEOUT = 10
    _LIST_DATA_PATTERN = re.compile(
        r"localStorage\.setItem\(\s*['\"]listData['\"]\s*,\s*'(.*?)'\s*\)",
        re.DOTALL,
    )
    _MENU_STATE_PATTERN = re.compile(
        r"window\.MenuV2InitialState\s*=\s*(\{.*?\})\s*;",
        re.DOTALL,
    )
    _MENU_TOKEN_PATTERN = re.compile(r"[0-9a-z가-힣]+")
    _TRADEMARK_PATTERN = re.compile(r"[®™℠]")
    _OPTIONAL_SINGLE_TOKENS = frozenset({"단품"})

    def _load_embedded_json(self, raw_value: Any) -> Any:
        text = str(raw_value or "").strip()
        if not text:
            raise ValueError("embedded JSON payload is empty")

        last_error: Optional[Exception] = None
        candidate_texts = [text]
        if "\\'" in text:
            candidate_texts.append(text.replace("\\'", "'"))

        for candidate in candidate_texts:
            try:
                return json.loads(candidate)
            except (json.JSONDecodeError, ValueError) as exc:
                last_error = exc

            try:
                decoded = json.loads(f'"{candidate}"')
                return json.loads(decoded)
            except (json.JSONDecodeError, ValueError) as exc:
                last_error = exc

        if last_error is not None:
            raise last_error
        raise ValueError("failed to decode embedded JSON payload")

    def _extract_js_array_literal(self, script_text: Any, key_name: str) -> str:
        text = str(script_text or "")
        key_index = text.find(f"{key_name}:")
        if key_index < 0:
            return ""

        array_start = text.find("[", key_index)
        if array_start < 0:
            return ""

        depth = 0
        in_string = False
        quote_char = ""
        escape = False

        for index in range(array_start, len(text)):
            char = text[index]

            if in_string:
                if escape:
                    escape = False
                elif char == "\\":
                    escape = True
                elif char == quote_char:
                    in_string = False
                continue

            if char in {'"', "'"}:
                in_string = True
                quote_char = char
                continue

            if char == "[":
                depth += 1
            elif char == "]":
                depth -= 1
                if depth == 0:
                    return text[array_start : index + 1]

        return ""

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

    def is_profile_url(self, url: Any) -> bool:
        normalized_url = self._normalize_public_url(url)
        if not normalized_url:
            return False

        parsed = urlsplit(normalized_url)
        domain = self._extract_url_domain(normalized_url)
        query = parsed.query or ""
        return domain.endswith("diningcode.com") and parsed.path == "/profile.php" and "rid=" in query

    def _normalize_store_name_for_match(self, store_name: Any) -> str:
        return re.sub(r"\s+", "", str(store_name or "").strip()).lower()

    def _store_names_match(self, requested_store_name: str, observed_store_name: Any) -> bool:
        requested = self._normalize_store_name_for_match(requested_store_name)
        observed = self._normalize_store_name_for_match(observed_store_name)
        if not requested or not observed:
            return False
        return requested in observed or observed in requested

    def search_rid(self, store_name: str) -> Optional[str]:
        normalized_store_name = (store_name or "").strip()
        if not normalized_store_name:
            return None

        encoded_query = quote(normalized_store_name)
        url = f"https://www.diningcode.com/list.php?query={encoded_query}"

        try:
            response = http_requests.get(
                url,
                headers=self._REQUEST_HEADERS,
                timeout=self._REQUEST_TIMEOUT,
            )
            if response.status_code != 200:
                logger.warning(
                    "다이닝코드 검색 페이지 HTTP %d | store=%s",
                    response.status_code,
                    normalized_store_name,
                )
                return None
        except http_requests.RequestException as exc:
            logger.warning("다이닝코드 검색 페이지 요청 실패 | store=%s | error=%s", normalized_store_name, exc)
            return None

        match = self._LIST_DATA_PATTERN.search(response.text)
        if not match:
            logger.info("다이닝코드 검색 페이지에서 listData를 찾지 못함 | store=%s", normalized_store_name)
            return None

        try:
            list_data = self._load_embedded_json(match.group(1))
        except (json.JSONDecodeError, ValueError) as exc:
            logger.warning("다이닝코드 listData JSON 파싱 실패 | store=%s | error=%s", normalized_store_name, exc)
            return None

        poi_section = list_data.get("poi_section") if isinstance(list_data, dict) else None
        poi_list = None
        if isinstance(poi_section, dict):
            poi_list = poi_section.get("poi_list")
            if not isinstance(poi_list, list) or not poi_list:
                poi_list = poi_section.get("list")
        if not isinstance(poi_list, list) or not poi_list:
            logger.info("다이닝코드 검색 결과 없음 | store=%s", normalized_store_name)
            return None

        for poi in poi_list:
            if not isinstance(poi, dict):
                continue
            v_rid = str(poi.get("v_rid") or "").strip()
            if not v_rid:
                continue
            nm = str(poi.get("nm") or "").strip()
            branch = str(poi.get("branch") or "").strip()
            observed_name = f"{nm} {branch}".strip() if branch else nm
            if self._store_names_match(normalized_store_name, observed_name):
                logger.info(
                    "다이닝코드 검색 매칭 성공 | store=%s | matched=%s | rid=%s",
                    normalized_store_name,
                    observed_name,
                    v_rid,
                )
                return v_rid

        first_poi = poi_list[0]
        if isinstance(first_poi, dict):
            v_rid = str(first_poi.get("v_rid") or "").strip()
            if v_rid:
                first_nm = str(first_poi.get("nm") or "").strip()
                first_branch = str(first_poi.get("branch") or "").strip()
                logger.info(
                    "다이닝코드 검색 정확 매칭 실패, 첫 번째 결과 사용 | store=%s | first=%s %s | rid=%s",
                    normalized_store_name,
                    first_nm,
                    first_branch,
                    v_rid,
                )
                return v_rid

        return None

    def fetch_menu_data(self, profile_url: str) -> Optional[List[Dict[str, str]]]:
        normalized_url = self._normalize_public_url(profile_url)
        if not self.is_profile_url(normalized_url):
            return None

        try:
            response = http_requests.get(
                normalized_url,
                headers=self._REQUEST_HEADERS,
                timeout=self._REQUEST_TIMEOUT,
            )
            if response.status_code != 200:
                logger.warning("다이닝코드 프로필 페이지 HTTP %d | url=%s", response.status_code, normalized_url)
                return None
        except http_requests.RequestException as exc:
            logger.warning("다이닝코드 프로필 페이지 요청 실패 | url=%s | error=%s", normalized_url, exc)
            return None

        match = self._MENU_STATE_PATTERN.search(response.text)
        if not match:
            logger.info("다이닝코드 프로필 페이지에서 MenuV2InitialState를 찾지 못함 | url=%s", normalized_url)
            return None

        state_text = match.group(1)
        menu_data_literal = self._extract_js_array_literal(state_text, "menuData")
        if not menu_data_literal:
            logger.info("다이닝코드 프로필 페이지에서 menuData 배열을 찾지 못함 | url=%s", normalized_url)
            return None

        try:
            menu_data = json.loads(menu_data_literal)
        except (json.JSONDecodeError, ValueError) as exc:
            logger.warning("다이닝코드 menuData JSON 파싱 실패 | url=%s | error=%s", normalized_url, exc)
            return None

        if not isinstance(menu_data, list) or not menu_data:
            logger.info("다이닝코드 menuData가 비어 있음 | url=%s", normalized_url)
            return None

        return menu_data

    @staticmethod
    def parse_price(price_str: str) -> Optional[int]:
        normalized = str(price_str or "").strip()
        if not normalized or any(token in normalized for token in ("변동", "시가", "문의")):
            return None
        cleaned = re.sub(r"[,원\s]", "", normalized)
        try:
            value = int(cleaned)
        except (ValueError, TypeError):
            return None
        return value if value > 0 else None

    def _build_menu_signature(self, menu_name: Any) -> Dict[str, Any]:
        normalized = unicodedata.normalize("NFKC", str(menu_name or ""))
        normalized = self._TRADEMARK_PATTERN.sub("", normalized)
        normalized = normalized.lower()
        normalized = re.sub(r"(?<=\d)(?=[a-z가-힣])", " ", normalized)
        normalized = re.sub(r"(?<=[a-z가-힣])(?=\d)", " ", normalized)
        tokens = self._MENU_TOKEN_PATTERN.findall(normalized)
        compact = "".join(tokens)
        tokens_without_single = [token for token in tokens if token not in self._OPTIONAL_SINGLE_TOKENS]
        compact_without_single = "".join(tokens_without_single) or compact
        return {
            "tokens": tokens,
            "token_set": set(tokens),
            "compact": compact,
            "compact_without_single": compact_without_single,
        }

    def _normalize_menu_entries(self, menu_data: List[Dict[str, str]]) -> List[Dict[str, Any]]:
        normalized_entries: List[Dict[str, Any]] = []
        for item in menu_data:
            if not isinstance(item, dict):
                continue
            name = str(item.get("menu") or "").strip()
            price_text = str(item.get("price") or "").strip()
            if not name:
                continue
            signature = self._build_menu_signature(name)
            normalized_entries.append(
                {
                    "name": name,
                    "price_text": price_text,
                    "amount": self.parse_price(price_text),
                    **signature,
                }
            )
        return normalized_entries

    def _score_candidate(
        self,
        *,
        requested_menu_name: str,
        requested_signature: Dict[str, Any],
        entry: Dict[str, Any],
    ) -> Optional[Dict[str, Any]]:
        observed_name = entry["name"]
        if has_conflicting_menu_option_tokens(
            requested_menu_name,
            observed_name,
            allow_optional_single=True,
        ):
            return None

        requested_compact = requested_signature["compact"]
        observed_compact = entry["compact"]
        requested_compact_without_single = requested_signature["compact_without_single"]
        observed_compact_without_single = entry["compact_without_single"]
        requested_token_set = requested_signature["token_set"]
        observed_token_set = entry["token_set"]
        common_tokens = len(requested_token_set & observed_token_set)
        length_delta = abs(
            len(observed_compact_without_single or observed_compact)
            - len(requested_compact_without_single or requested_compact)
        )

        match_level = ""
        score: Optional[int] = None
        ratio = 0.0

        if requested_compact and observed_compact and requested_compact == observed_compact:
            match_level = "exact"
            score = 5000 - length_delta
        elif (
            requested_compact_without_single
            and observed_compact_without_single
            and requested_compact_without_single == observed_compact_without_single
        ):
            match_level = "exact_without_single"
            score = 4800 - length_delta
        elif (
            requested_compact_without_single
            and observed_compact_without_single
            and (
                requested_compact_without_single in observed_compact_without_single
                or observed_compact_without_single in requested_compact_without_single
            )
        ):
            match_level = "contains"
            score = 3600 + (common_tokens * 50) - (length_delta * 10)
        elif requested_token_set and observed_token_set and (
            requested_token_set.issubset(observed_token_set)
            or observed_token_set.issubset(requested_token_set)
        ):
            match_level = "token_subset"
            score = 2600 + (common_tokens * 60) - (length_delta * 10)
        else:
            if requested_compact_without_single and observed_compact_without_single:
                ratio = max(
                    ratio,
                    SequenceMatcher(
                        None,
                        requested_compact_without_single,
                        observed_compact_without_single,
                    ).ratio(),
                )
            if requested_compact and observed_compact:
                ratio = max(
                    ratio,
                    SequenceMatcher(None, requested_compact, observed_compact).ratio(),
                )

            if ratio < 0.72 or common_tokens == 0:
                return None

            match_level = "similar"
            score = 1500 + int(ratio * 100) + (common_tokens * 40) - (length_delta * 10)

        if score is None or score <= 0:
            return None

        return {
            "name": observed_name,
            "price_text": entry["price_text"],
            "amount": entry["amount"],
            "match_level": match_level,
            "score": score + (5 if entry["amount"] is not None else 0),
        }

    def _select_menu_candidates(
        self,
        *,
        requested_menu_name: str,
        menu_entries: List[Dict[str, Any]],
        limit: int,
    ) -> List[Dict[str, Any]]:
        requested_signature = self._build_menu_signature(requested_menu_name)
        ranked_candidates: List[Dict[str, Any]] = []

        for entry in menu_entries:
            candidate = self._score_candidate(
                requested_menu_name=requested_menu_name,
                requested_signature=requested_signature,
                entry=entry,
            )
            if candidate is not None:
                ranked_candidates.append(candidate)

        if not ranked_candidates and len(menu_entries) <= limit:
            ranked_candidates = [
                {
                    "name": entry["name"],
                    "price_text": entry["price_text"],
                    "amount": entry["amount"],
                    "match_level": "fallback_all",
                    "score": 0,
                }
                for entry in menu_entries
            ]

        ranked_candidates.sort(
            key=lambda item: (
                item["score"],
                1 if item["amount"] is not None else 0,
                -abs(len(item["name"]) - len(requested_menu_name)),
                -len(item["name"]),
            ),
            reverse=True,
        )

        deduped_candidates: List[Dict[str, Any]] = []
        seen = set()
        for candidate in ranked_candidates:
            dedupe_key = (candidate["name"], candidate["price_text"])
            if dedupe_key in seen:
                continue
            seen.add(dedupe_key)
            deduped_candidates.append(candidate)
            if len(deduped_candidates) >= limit:
                break

        return deduped_candidates

    def lookup_menu_candidates(
        self,
        *,
        store_name: str,
        menu_name: str,
        candidate_limit: int = 8,
    ) -> Dict[str, Any]:
        normalized_store_name = str(store_name or "").strip()
        normalized_menu_name = str(menu_name or "").strip()
        lookup_result: Dict[str, Any] = {
            "profile_url": "",
            "menu_count": 0,
            "candidate_count": 0,
            "candidates": [],
        }
        if not normalized_store_name or not normalized_menu_name:
            return lookup_result

        rid = self.search_rid(normalized_store_name)
        if not rid:
            logger.info("다이닝코드 rid 탐색 실패 | store=%s", normalized_store_name)
            return lookup_result

        profile_url = f"https://www.diningcode.com/profile.php?rid={rid}"
        menu_data = self.fetch_menu_data(profile_url)
        if not menu_data:
            logger.info(
                "다이닝코드 메뉴 데이터 추출 실패 | store=%s | url=%s",
                normalized_store_name,
                profile_url,
            )
            lookup_result["profile_url"] = profile_url
            return lookup_result

        menu_entries = self._normalize_menu_entries(menu_data)
        candidates = self._select_menu_candidates(
            requested_menu_name=normalized_menu_name,
            menu_entries=menu_entries,
            limit=max(1, candidate_limit),
        )

        lookup_result["profile_url"] = profile_url
        lookup_result["menu_count"] = len(menu_entries)
        lookup_result["candidate_count"] = len(candidates)
        lookup_result["candidates"] = candidates

        logger.info(
            "다이닝코드 후보 추출 | store=%s | menu=%s | total=%s | candidates=%s | levels=%s | url=%s",
            normalized_store_name,
            normalized_menu_name,
            len(menu_entries),
            len(candidates),
            [candidate.get("match_level") for candidate in candidates],
            profile_url,
        )
        return lookup_result

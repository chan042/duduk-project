import os
import json
import re
import time
import datetime
import logging
import google.generativeai as genai
from typing import Optional, Any, Dict

logger = logging.getLogger(__name__)

# ============================================================
# 상수 정의
# ============================================================

# TODO: 이 카테고리 목록은 추후 DB나 전역 설정과 동기화 필요
CATEGORIES = [
    "식비", "생활", "카페/간식", "온라인 쇼핑", "패션/쇼핑", "뷰티/미용",
    "교통", "자동차", "주거/통신", "의료/건강", "문화/여가", "여행/숙박",
    "교육/학습", "자녀/육아", "반려동물", "경조/선물", "술/유흥", "기타"
]

# 난이도별 포인트 범위 (규칙 기반)
DIFFICULTY_POINTS = {
    'easy': (100, 200),
    'normal': (200, 350),
    'hard': (350, 500)
}

# AI 챌린지 생성용 JSON 스키마
CHALLENGE_SCHEMA = """
[반환 형식]
반드시 아래 JSON 형식으로만 반환하세요:
{{
    "name": "챌린지 이름 (10자 이내)",
    "difficulty": "easy/normal/hard 중 하나",
    "description": "동기부여가 되는 챌린지 설명 (50자 이내, 친근한 말투)",
    "success_conditions": ["성공 조건 1 (구체적이고 측정 가능하게)", "성공 조건 2 (선택)"],
    "numeric_constraints": {{
        "duration_days": "챌린지 기간(일 단위, 정수. 예: 7)",
        "target_amount": "목표 절감 금액(정수, 없으면 null. 예: 30000)"
    }},
    "target_keywords": ["지출 매칭 키워드1", "키워드2"],
    "target_categories": ["관련 카테고리1", "카테고리2"]
}}

JSON 외에 다른 말은 하지 마세요.
"""

# 난이도별 성공 조건 가이드
DIFFICULTY_GUIDE = """
[난이도별 성공 조건 가이드]
EASY: 느슨한 제한, 단일 조건, 실패해도 만회 가능 (예: 주 3회 이하, 주 15,000원 이하)
NORMAL: 복합 조건 또는 연속 달성 요구 (예: 3일 연속, 횟수+금액 동시 제한)
HARD: 엄격한 제한, 0회 또는 완전 금지 (예: 7일 연속 0회)
"""

# ============================================================
# 헬퍼 함수 - AI 응답 파싱
# ============================================================

def parse_json_response(text: str) -> Optional[dict]:
    """AI 응답에서 JSON을 추출하고 파싱"""
    # 1차: 코드블록 내부 JSON 추출
    code_block = re.search(r'```(?:json)?\s*([\s\S]*?)```', text)
    if code_block:
        try:
            return json.loads(code_block.group(1).strip())
        except json.JSONDecodeError:
            pass

    # 2차: 전체 텍스트에서 가장 바깥쪽 {...} 추출
    brace_match = re.search(r'\{[\s\S]*\}', text)
    if brace_match:
        try:
            return json.loads(brace_match.group(0))
        except json.JSONDecodeError:
            pass

    # 3차: 기존 방식 (단순 클리닝)
    try:
        cleaned = text.replace("```json", "").replace("```", "").strip()
        return json.loads(cleaned)
    except json.JSONDecodeError:
        return None


# ============================================================
# 헬퍼 함수 - 백엔드 처리
# ============================================================

def calculate_points(difficulty: str) -> int:
    """난이도에 따른 포인트 계산"""
    min_pts, max_pts = DIFFICULTY_POINTS.get(difficulty, (200, 350))
    # 중간값 반환
    return (min_pts + max_pts) // 2


# ============================================================
# GeminiClient 클래스
# ============================================================

class GeminiClient:
    def __init__(self, purpose: str = "analysis"):
        """
        Args:
            purpose: API 키 선택 용도
                - "coaching": 코칭 카드 + 챌린지 생성 (GEMINI_API_KEY_COACHING)
                - "analysis": 지출 분석 - 자연어, OCR, 이미지 매칭 (GEMINI_API_KEY_ANALYSIS)
        """
        if purpose == "coaching":
            self.api_key = os.environ.get("GEMINI_API_KEY_COACHING")
        else:  # "analysis" 또는 기타
            self.api_key = os.environ.get("GEMINI_API_KEY_ANALYSIS")
        
        if self.api_key:
            genai.configure(api_key=self.api_key)
            # 기본 모델 사용 (Google Search는 프롬프트에서 지시)
            self.model = genai.GenerativeModel('gemini-2.5-flash-lite')
        else:
            self.model = None

    def _generate(self, prompt: str, max_retries: int = 1) -> Optional[dict]:
        """공통 생성 로직 (할당량 초과 시 자동 재시도)"""
        if not self.model:
            logger.warning("Gemini 모델이 초기화되지 않았습니다 (API 키 확인 필요)")
            return None
        for attempt in range(max_retries + 1):
            try:
                response = self.model.generate_content(prompt)
                result = parse_json_response(response.text)
                if result is None:
                    logger.error(
                        "Gemini JSON 파싱 실패. 원본 응답(앞 500자): %s",
                        response.text[:500]
                    )
                return result
            except Exception as e:
                error_str = str(e).lower()
                is_rate_limit = (
                    '429' in error_str
                    or 'resource' in error_str
                    or 'quota' in error_str
                )
                if is_rate_limit and attempt < max_retries:
                    wait_time = 10 * (attempt + 1)
                    logger.warning(
                        "Gemini API 할당량 초과 (시도 %d/%d). %d초 후 재시도...",
                        attempt + 1, max_retries, wait_time,
                    )
                    time.sleep(wait_time)
                else:
                    logger.error(f"Gemini API Error: {e}", exc_info=True)
                    return None

    def analyze_image(self, prompt: str, image_base64: str, mime_type: str = "image/jpeg") -> Optional[dict]:
        """
        Sends image + prompt to Gemini and parses JSON response.
        Returns None on any failure.
        """
        if not self.model:
            logger.warning("Gemini 모델이 초기화되지 않았습니다 (API 키 확인 필요)")
            return None

        if not image_base64:
            return None

        try:
            response = self.model.generate_content(
                [
                    prompt,
                    {
                        "inline_data": {
                            "mime_type": mime_type,
                            "data": image_base64,
                        }
                    },
                ]
            )
            return parse_json_response(response.text)
        except Exception as exc:
            logger.warning("Gemini image analysis failed: %s", exc)
            return None

    def analyze_image_with_context(
        self,
        prompt: str,
        image_base64: str,
        mime_type: str = "image/jpeg",
        context: Optional[Dict[str, Any]] = None,
    ) -> Optional[dict]:
        """
        Helper that appends structured context to prompt for stable image analysis.
        """
        context_text = ""
        if context:
            try:
                context_text = f"\n\n[추가 문맥]\n{json.dumps(context, ensure_ascii=False)}"
            except Exception:
                context_text = ""
        return self.analyze_image(f"{prompt}{context_text}", image_base64, mime_type=mime_type)

    def analyze_cash_photo(
        self,
        image_base64: str,
        expected_remaining: int,
        mime_type: str = "image/jpeg",
    ) -> Optional[dict]:
        prompt = """
        당신은 사진 속 현금 금액을 판정하는 심사기입니다.
        사진에 보이는 지폐/동전의 권종과 개수를 추정하고 합계를 계산하세요.

        반드시 아래 JSON만 출력하세요:
        {
        "is_cash_photo": true/false,
        "detected_cash_total": 0 이상의 정수,
        "denominations": [{"value": 10000, "count": 1}],
        "confidence": 0.0~1.0 사이 실수
        }
        """
        return self.analyze_image_with_context(
            prompt=prompt,
            image_base64=image_base64,
            mime_type=mime_type,
            context={
                "expected_remaining": expected_remaining,
                "rule": "detected_cash_total must exactly equal expected_remaining",
            },
        )

    def analyze_marketplace_post_photo(
        self,
        image_base64: str,
        mime_type: str = "image/jpeg",
    ) -> Optional[dict]:
        prompt = """
        사진이 '중고거래 사이트/앱에 게시글(상품 등록 글)을 올린 화면'인지 판정하세요.
        단순 채팅/목록 화면은 false입니다.

        반드시 아래 JSON만 출력하세요:
        {
        "is_marketplace_post": true/false,
        "platform_hint": "예: 당근/번개장터/중고나라/unknown",
        "evidence": ["근거1", "근거2"],
        "confidence": 0.0~1.0
        }
        """
        return self.analyze_image(
            prompt=prompt,
            image_base64=image_base64,
            mime_type=mime_type,
        )

    def analyze_one_plus_one_photo(
        self,
        image_base64: str,
        ocr_text: str = "",
        mime_type: str = "image/jpeg",
    ) -> Optional[dict]:
        prompt = """
        사진과 OCR 텍스트를 함께 보고 다음을 판정하세요.
        1) 편의점 구매 증거가 있는지 (브랜드/매장 단서 포함)
        2) 1+1 또는 2+1 프로모션 증거가 있는지

        반드시 아래 JSON만 출력하세요:
        {
        "is_convenience_purchase": true/false,
        "has_promotion_1p1_or_2p1": true/false,
        "promotion_type": "1+1|2+1|none",
        "evidence": ["근거1", "근거2"],
        "confidence": 0.0~1.0
        }
        """
        return self.analyze_image_with_context(
            prompt=prompt,
            image_base64=image_base64,
            mime_type=mime_type,
            context={
                "ocr_text": ocr_text or "",
                "convenience_keywords": ["편의점", "GS25", "CU", "이마트24", "세븐일레븐"],
            },
        )

    def analyze_text(self, text: str) -> Optional[dict]:
        """
        Parses natural language transaction text into structured JSON.
        """
        today = datetime.date.today().strftime("%Y-%m-%d")
        categories_str = ", ".join(CATEGORIES)

        prompt = f"""
        당신은 텍스트에서 소비 정보를 추출하는 AI입니다.
        다음 텍스트를 분석하여 JSON 형식으로 반환하세요.
        
        [기준 정보]
        - 오늘 날짜: {today} (텍스트에 날짜가 명시되지 않은 경우 이 날짜를 사용하세요)

        [입력 텍스트]
        {text}

        [반환 형식]
        {{
            "category": "카테고리 ({categories_str})",
            "item": "품목 (예: 아메리카노, 택시비)",
            "store": "소비처 (예: 스타벅스, 카카오택시)",
            "amount": 금액(쉼표와 원 단위를 제거한 순수 정수. 예: 15000),
            "date": "YYYY-MM-DD 형식의 날짜",
            "memo": "기타 메모",
            "address": "추정되는 위치 (없으면 빈 문자열)",
            "is_fixed": true/false (고정 지출 여부: 구독료, 월세, 보험료 등 매달 나가는 돈이면 true)
        }}
        
        JSON 외에 다른 말은 하지 마세요.
        """

        result = self._generate(prompt)
        if result:
            # Ensure no None values for string fields
            for field in ['category', 'item', 'store', 'memo', 'address', 'date']:
                if result.get(field) is None:
                    result[field] = ""
            # Ensure is_fixed is boolean
            if 'is_fixed' not in result:
                result['is_fixed'] = False
        return result

    def get_advice(self, transaction_list_str: str) -> Optional[dict]:
        """
        Generates financial advice based on transaction history.
        """
        prompt = f"""
        [역할]
        당신은 '두둑' 서비스의 AI 소비 코치이자, 친근하고 간결한 성격의 소비 코칭 전문가입니다. 
        당신은 사용자의 소비 취향을 존중하면서 만족도 높은 대안이나 실천 가능한 행동 변화를 제안합니다.

        [지출 내역]
        {transaction_list_str}

        [소비 분석]
        - 지출 내역을 분석하여 사용자의 소비 패턴과 소비 성향을 분석
        - 개선 가능성이 있는 항목 식별 (불필요한 지출, 과다 금액, 대체 가능 항목)

        [코칭 주제(1~4 중 하나를 선택 후 코칭을 진행)]
        1. 키워드 기반 대안
        - 동일 품목의 더 저렴하고 가성비 좋은 대안 제안
        - 사용자의 소비 항목에서 키워드를 추출해 이와 비슷한 키워드를 가진 대안을 추천
        - 대안 추천을 따랐을 때의 예상 절감액 제시(절감액 = 현재소비금액 - 대안소비금액)
        - 가격비교, 취향 적합 키워드 일치, 평점·후기 등을 검색 후 객관적 근거 제공
        - Google Search 도구를 사용하여 실제 상품 정보와 현재 가격 정보를 검색한 후 제안하세요.
        - 검색 결과가 없는 경우, 거짓 정보를 생성하지 말고 일반적인 소비 습관 개선 조언(행동 변화 제안)으로 대체하세요.
        
        2. 행동 변화 제안 
        - 불필요한 지출이나 과다 금액을 줄일 수 있는 구체적이고 실천 가능한 행동 제안
        - 제안하는 행동의 구체적 실행 방법
        - 행동 변화를 통해 예상되는 월 절감액을 제공(월 절감액 = 예상 절감액 x 월평균 빈도)
        - 행동 변화를 제안하는 객관적 근거 제공
        
        3. 위치 기반 대안
        - 동일한 성격의 품목이지만 더 저렴한 주변 가게를 찾아서 사용자에게 제안(예: 카페, 음식점)
        - 대안 소비 위치는 현재 소비 위치로부터 1km 이내여야 함.
        - 대안 추천을 따랐을 때의 예상 절감액 제시(절감액 = 현재금액 - 대안금액)
        - 가격비교, 거리/시간 제약 충족, 평점·후기 등 객관적 근거 제공
        - Google Search 도구를 사용하여 사용자 주변의 실제 상점 정보와 현재 가격 정보를 검색한 후 제안하세요.
        - 검색 결과가 없거나 위치를 특정할 수 없는 경우, 거짓 정보를 생성하지 말고 일반적인 소비 습관 개선 조언(행동 변화 제안)으로 대체하세요.
        
        4. 누수 소비 방지
        - 누수 소비는 습관적, 반복적으로 빠져나가는 소액 지출을 의미 (예: 택시비, 수수료, 미사용 구독)
        - 사용자의 지출 내역에서 누수 소비를 분석하여 사용자에게 인지시키고 누수 소비라고 판단한 객관 근거 제공
        - 해당 누수 소비를 줄일 수 있는 구체적이고 실천 가능한 방안 제안
        - 이를 통해 예상되는 절감액을 제시(절감액 = 현재금액 x 월평균 빈도)

        [주제 선정 기준]
        - 만족도 저하가 낮고 실행 장벽이 낮은 주제 우선 추천
        - 같은 조건이면 절감액이 큰 주제 선택
        - 반드시 하나의 주제에 대한 코칭 내용만 출력

        [어투 및 태도]
        - 강요/훈계 금지
        - 친근하고 격려하는 톤("~는 건 어떨까요?", "~해보면 좋을 것 같아요")
        - 모든 금액 원 단위 콤마 표기 필수
        - 사용자의 취향과 만족도를 최우선으로 고려하며 실현 가능성이 낮은 극단적 제안 지양

        [생성 규칙]
        1. 주제는 다음 4가지 주제 중 하나를 선택하세요: "행동 변화 제안", "누수 소비 방지", "위치 기반 대안", "키워드 기반 대안"
        2. 내용은 소비 내역 분석과 그에 따른 코칭 내용이 포함되어야 합니다.
        3. 내역 분석은 100자 이내로 작성하세요.
        4. 코칭 내용은 100자 이내로 작성하세요.
        5. 제목(title)은 코칭 내용을 한줄 요약하여 10자 이내의 짧은 문구로 작성하세요.
        6. 반드시 JSON 형식으로 반환하세요.

        [반환 형식]
        {{
            "subject": "선택한 주제",
            "title": "코칭 제목 (예: 편의점 간식 줄이기)",
            "coaching_content": "코칭 내용",
            "analysis": "소비 분석 내용",
            "estimated_savings": 예상 월 절감액(숫자만, 컴마표시 필수)
        }}
        
        JSON 외에 다른 말은 하지 마세요.
        """

        return self._generate(prompt)

    def generate_challenge(self, details: str, difficulty: str = None,
                          user_spending_summary: str = None) -> Optional[dict]:
        """
        사용자 입력을 바탕으로 맞춤 챌린지를 생성합니다.

        Args:
            details: 상세 내용
            difficulty: 난이도
            user_spending_summary: 사용자 지출 요약

        Returns:
            생성된 챌린지 정보 (JSON)
        """
        spending_context = ""
        if user_spending_summary:
            spending_context = f"[사용자 소비 패턴] {user_spending_summary}"

        # 난이도 컨텍스트
        if difficulty:
            difficulty_context = f"[난이도: {difficulty.upper()}]"
        else:
            difficulty_context = "[난이도: 내용에 따라 EASY/NORMAL/HARD 중 선택]"

        categories_str = ", ".join(CATEGORIES)

        prompt = f"""
        [역할] 당신은 '두둑' 서비스의 AI 챌린지 설계자입니다.

        [사용자 입력] {details}
        {spending_context}

        {difficulty_context}
        {DIFFICULTY_GUIDE}

        [사용 가능한 카테고리]
        {categories_str}

        [규칙]
        1. 성공 조건은 구체적이고 측정 가능하게 생성할 것(예: "주 3회 이하", "7일간 5만원 이하")
        2. target_keywords는 지출 항목에서 매칭할 키워드(예: ["커피", "카페", "스타벅스"])
        3. target_categories는 위 카테고리 목록에서 관련된 것만 선택(예: ["카페/간식"])
        4. 챌린지 설명은 친근하고 동기부여가 되는 말투로

        {CHALLENGE_SCHEMA}
        """

        result = self._generate(prompt)
        if result:
            self._process_challenge_result(result, details, difficulty)
        return result

    def generate_challenge_from_coaching(self, coaching_data: dict,
                                         difficulty: str = None) -> Optional[dict]:
        """
        코칭 카드 데이터를 바탕으로 맞춤 챌린지를 생성합니다.

        Args:
            coaching_data: 코칭 정보 dict
            difficulty: 난이도 (선택, None이면 AI가 결정)

        Returns:
            생성된 챌린지 정보 (JSON)
        """
        # 난이도 컨텍스트
        if difficulty:
            difficulty_context = f"[난이도: {difficulty.upper()}]"
        else:
            difficulty_context = "[난이도: 코칭 내용에 따라 EASY/NORMAL/HARD 중 선택]"

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
        1. 성공 조건은 구체적이고 측정 가능하게 생성할 것(예: "주 3회 이하", "7일간 5만원 이하")
        2. target_keywords는 지출 항목에서 매칭할 키워드(예: ["커피", "카페", "스타벅스"])
        3. target_categories는 위 카테고리 목록에서 관련된 것만 선택(예: ["카페/간식"])
        4. 챌린지 설명은 친근하고 동기부여가 되는 말투로

        {CHALLENGE_SCHEMA}
        """

        result = self._generate(prompt)
        if result:
            default_name = coaching_data.get('title', '코칭 기반 챌린지')
            self._process_challenge_result(result, default_name, difficulty)
            result['coaching_id'] = coaching_data.get('id')
        return result

    def _process_challenge_result(self, result: dict, fallback_name: str,
                                   user_difficulty: str = None):
        """
        AI 응답에 백엔드 규칙 기반 처리 적용

        Args:
            result: AI 응답 결과
            fallback_name: 기본 챌린지 이름
            user_difficulty: 사용자 지정 난이도
        """
        # 난이도 결정
        difficulty = user_difficulty or result.get('difficulty', 'normal')
        result['difficulty'] = difficulty

        # 백엔드 규칙 기반 포인트 계산
        result['base_points'] = calculate_points(difficulty)

        # numeric_constraints에서 직접 데이터 추출 (AI 응답 사용)
        constraints = result.get('numeric_constraints', {})
        result['duration_days'] = constraints.get('duration_days', 7)
        result['target_amount'] = constraints.get('target_amount')

        # target_categories: AI가 생성한 값 사용, 없으면 기본값
        if not result.get('target_categories'):
            result['target_categories'] = ["기타"]

        # 기본값 설정
        result.setdefault('name', fallback_name[:20] if fallback_name else '맞춤 챌린지')
        result.setdefault('description', '')
        result.setdefault('success_conditions', [])
        result.setdefault('target_keywords', [])

    # ============================================================
    # AI 분석 메서드 - 윤택지수 계산용
    # ============================================================

    def _get_transactions_summary(self, user_id: int, year: int, month: int) -> str:
        """
        해당 월의 거래 내역을 텍스트로 요약 (AI 분석용)
        
        Args:
            user_id: 사용자 ID
            year: 연도
            month: 월
        
        Returns:
            거래 내역 요약 문자열
        """
        from apps.transactions.models import Transaction
        from datetime import datetime
        from django.utils import timezone
        from django.contrib.auth import get_user_model
        
        User = get_user_model()
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return ""
        
        # 해당 월의 시작일과 종료일
        start_date = timezone.make_aware(datetime(year, month, 1))
        if month == 12:
            end_date = timezone.make_aware(datetime(year + 1, 1, 1))
        else:
            end_date = timezone.make_aware(datetime(year, month + 1, 1))
        
        # 거래 내역 조회
        transactions = Transaction.objects.filter(
            user=user,
            date__gte=start_date,
            date__lt=end_date
        ).order_by('-date')[:50]  # 최대 50건
        
        if not transactions:
            return "이번 달 지출 내역이 없습니다."
        
        # 요약 생성
        summary_lines = [f"{year}년 {month}월 지출 내역:"]
        for t in transactions:
            summary_lines.append(
                f"- {t.date.strftime('%Y-%m-%d')} | {t.category} | {t.item} | {t.store} | {t.amount:,}원"
            )
        
        return "\n".join(summary_lines)

    def analyze_health_score(self, user_id: int, year: int, month: int) -> int:
        """
        건강 점수 분석 (15점 만점)
        
        사용자의 지출 내역을 분석하여 건강 관련 지출을 평가하고 점수를 반환합니다.
        - 건강한 식품, 운동, 의료비 등 건강 관련 지출의 적절성 평가
        - 패스트푸드, 배달음식, 술/유흥 등 건강하지 않은 지출 패턴 분석
        
        Args:
            user_id: 사용자 ID
            year: 연도
            month: 월
        
        Returns:
            건강 점수 (0~15)
        """
        transactions_summary = self._get_transactions_summary(user_id, year, month)
        
        if not transactions_summary or transactions_summary == "이번 달 지출 내역이 없습니다.":
            return 0
        
        prompt = f"""
        [역할]
        당신은 소비 패턴을 분석하여 건강 점수를 산출하는 AI입니다.
        
        [지출 내역]
        {transactions_summary}
        
        [분석 기준]
        1. 건강한 지출 (+점수)
           - 신선 식품, 건강식품 구매
           - 운동 관련 지출 (헬스장, 운동용품, 스포츠)
           - 의료/건강 관련 지출 (병원, 약국, 건강검진)
           - 홈쿡, 직접 조리 관련 지출
        
        2. 건강하지 않은 지출 (-점수)
           - 패스트푸드, 인스턴트 식품 과다
           - 배달음식 과다 (주 3회 이상)
           - 술/유흥 과다
           - 카페/간식 과다
           - 야식 관련 지출
        
        3. 건강 패턴 평가
           - 규칙적인 식사 패턴
           - 운동의 지속성
           - 건강 관리 노력의 일관성
        
        [점수 산출 기준]
        - 13~15점: 매우 건강한 소비 패턴, 운동/건강식 지출이 우수, 불건강 지출 거의 없음
        - 10~12점: 양호한 건강 관리, 일부 개선 여지 있음
        - 7~9점: 보통 수준, 건강한 지출과 불건강한 지출이 혼재
        - 4~6점: 개선 필요, 불건강한 지출이 많음
        - 0~3점: 건강 관리가 거의 없거나 매우 불건강한 소비 패턴
        
        [반환 형식]
        반드시 아래 JSON 형식으로만 반환하세요:
        {{
            "score": 점수(0~15 사이의 정수),
            "reason": "점수 산출 근거 (1줄, 50자 이내)"
        }}
        
        JSON 외에 다른 말은 하지 마세요.
        """
        
        result = self._generate(prompt)
        if result and 'score' in result:
            score = int(result['score'])
            # 0~15 범위로 제한
            return max(0, min(15, score))
        
        return 0

    def analyze_leakage_spending(self, user_id: int, year: int, month: int) -> int:
        """
        누수 지출 분석
        
        습관적, 반복적으로 빠져나가는 소액 지출을 분석하여 총액을 반환합니다.
        - 택시비, 수수료, 미사용 구독, 편의점 충동구매 등
        
        Args:
            user_id: 사용자 ID
            year: 연도
            month: 월
        
        Returns:
            누수 지출 총액 (원)
        """
        transactions_summary = self._get_transactions_summary(user_id, year, month)
        
        if not transactions_summary or transactions_summary == "이번 달 지출 내역이 없습니다.":
            return 0
        
        prompt = f"""
        [역할]
        당신은 소비 패턴을 분석하여 '누수 지출'을 찾아내는 AI입니다.
        
        [지출 내역]
        {transactions_summary}
        
        [누수 지출(Leakage Spending) 정의]
        습관적이고 반복적으로 빠져나가는 소액 지출로, 사용자가 인지하지 못한 채 누적되는 지출
        
        [누수 지출 예시]
        1. 교통 누수
           - 잦은 택시 이용 (대중교통 대체 가능한 경우)
           - 주차비, 톨게이트 등 비효율적 교통비
        
        2. 편의점 충동구매
           - 습관적인 편의점 방문
           - 소액이지만 반복되는 간식, 음료 구매
        
        3. 구독/멤버십 누수
           - 거의 사용하지 않는 구독 서비스
           - 자동결제되는 멤버십
        
        4. 수수료 누수
           - ATM 수수료, 송금 수수료
           - 각종 플랫폼 수수료
        
        5. 배달 앱 과다 이용
           - 소액 배달 주문의 배달비
           - 충동적인 야식 주문
        
        6. 기타 습관적 소비
           - 매일 반복되는 커피/음료
           - 습관적인 온라인 쇼핑
        
        [분석 방법]
        - 지출 내역에서 누수 지출에 해당하는 항목들을 식별
        - 각 항목의 금액을 합산하여 총 누수 지출액 계산
        - 누수 지출이 아닌 필요한 지출(예: 계획적인 구독, 정기 교통비)은 제외
        
        [반환 형식]
        반드시 아래 JSON 형식으로만 반환하세요:
        {{
            "total_leakage": 누수 지출 총액(정수, 원 단위),
            "reason": "누수 지출 항목들 (1줄, 50자 이내)"
        }}
        
        JSON 외에 다른 말은 하지 마세요.
        """
        
        result = self._generate(prompt)
        if result and 'total_leakage' in result:
            return int(result['total_leakage'])
        
        return 0

    def analyze_growth_spending(self, user_id: int, year: int, month: int) -> int:
        """
        성장 소비 분석
        
        자기계발, 교육, 투자 등 개인의 성장에 기여하는 지출을 분석하여 총액을 반환합니다.
        
        Args:
            user_id: 사용자 ID
            year: 연도
            month: 월
        
        Returns:
            성장 지출 총액 (원)
        """
        transactions_summary = self._get_transactions_summary(user_id, year, month)
        
        if not transactions_summary or transactions_summary == "이번 달 지출 내역이 없습니다.":
            return 0
        
        prompt = f"""
        [역할]
        당신은 소비 패턴을 분석하여 '성장 소비'를 찾아내는 AI입니다.
        
        [지출 내역]
        {transactions_summary}
        
        [성장 소비(Growth Spending) 정의]
        개인의 성장, 발전, 미래 가치 증진에 기여하는 지출
        
        [성장 소비 예시]
        1. 교육/학습
           - 온라인/오프라인 강의, 강좌
           - 학원, 과외
           - 자격증, 시험 준비
           - 세미나, 워크샵 참가비
        
        2. 도서/콘텐츠
           - 전문 서적, 실용 도서
           - 교육 관련 콘텐츠 구독
           - 업무/학습 관련 소프트웨어
        
        3. 자기계발
           - 코칭, 멘토링
           - 심리상담, 커리어 코칭
           - 생산성 도구, 앱 구독
        
        4. 건강/운동
           - 헬스, 요가 등 규칙적인 운동
           - 건강 관리 (건강검진 등)
        
        5. 네트워킹/관계
           - 직무 관련 모임, 네트워킹
           - 전문가 커뮤니티 회비
        
        6. 투자 관련
           - 재테크 교육
           - 투자 정보 구독
        
        [제외 항목]
        - 순수 오락/여가 (게임, 영화 등)
        - 단순 소비재 구매
        - 술/유흥
        - 일반적인 식비, 생활비
        
        [분석 방법]
        - 지출 내역에서 성장 소비에 해당하는 항목들을 식별
        - 각 항목이 정말 성장에 기여하는지 평가 (명목상 학습이지만 실제 불필요한 경우 제외)
        - 성장 지출 항목들의 금액을 합산
        
        [반환 형식]
        반드시 아래 JSON 형식으로만 반환하세요:
        {{
            "total_growth": 성장 지출 총액(정수, 원 단위),
            "reason": "성장 지출 항목들 (1줄, 50자 이내)"
        }}
        
        JSON 외에 다른 말은 하지 마세요.
        """
        
        result = self._generate(prompt)
        if result and 'total_growth' in result:
            return int(result['total_growth'])
        
        return 0

    # ============================================================
    # 월간 리포트 생성
    # ============================================================

    def generate_monthly_report(self, report_data: dict) -> Optional[dict]:
        """
        월간 소비 분석 리포트 생성 (JSON 형식)

        사용자의 페르소나(직업, 취미, 결혼 여부 등)와 AI가 축적한
        소비 성향 요약(ai_persona_summary)을 프롬프트에 주입하여
        초개인화된 리포트를 생성합니다.

        Args:
            report_data: 리포트 생성에 필요한 데이터
                - 기존 지출/점수 데이터
                - job, hobbies, marital_status, has_children,
                  self_development_field, ai_persona_summary (페르소나)

        Returns:
            {
                "report": { ... 구조화된 리포트 JSON ... },
                "updated_persona_summary": "업데이트된 성향 요약 문자열"
            }
            또는 실패 시 None
        """
        year = report_data.get('year')
        month = report_data.get('month')
        monthly_budget = report_data.get('monthly_budget', 0)
        total_spending = report_data.get('total_spending', 0)
        prev_total_spending = report_data.get('prev_total_spending', 0)
        category_spending = report_data.get('category_spending', [])
        yuntaek_score = report_data.get('yuntaek_score', 0)
        prev_yuntaek_score = report_data.get('prev_yuntaek_score', 0)
        score_breakdown = report_data.get('score_breakdown', {})
        challenge_count = report_data.get('challenge_count', 0)
        challenge_success_count = report_data.get('challenge_success_count', 0)

        # ── 페르소나 정보 추출 ──
        job = report_data.get('job', '')
        hobbies = report_data.get('hobbies', '')
        marital_status = report_data.get('marital_status', '')
        has_children = report_data.get('has_children', False)
        self_dev = report_data.get('self_development_field', '')
        ai_persona_summary = report_data.get('ai_persona_summary', '')

        # 페르소나 컨텍스트 문자열 생성
        persona_lines = []
        if job:
            persona_lines.append(f"- 직업: {job}")
        if hobbies:
            persona_lines.append(f"- 취미: {hobbies}")
        if marital_status:
            persona_lines.append(f"- 결혼 여부: {marital_status}")
        persona_lines.append(f"- 자녀 유무: {'있음' if has_children else '없음'}")
        if self_dev:
            persona_lines.append(f"- 자기개발 분야: {self_dev}")

        if ai_persona_summary:
            persona_lines.append(f"- 지난달까지 축적된 소비 성향 요약:\n  \"{ai_persona_summary}\"")
        else:
            persona_lines.append(
                "- 지난달까지 축적된 소비 성향 요약: (정보 없음 — 첫 분석이므로 "
                "이번 달 데이터를 토대로 새롭게 작성하세요)"
            )

        persona_context = "\n".join(persona_lines)

        # 카테고리별 지출 문자열 생성
        category_lines = []
        for cat in category_spending[:5]:
            category_lines.append(f"- {cat['category']}: {cat['total']:,}원")
        category_str = "\n".join(category_lines) if category_lines else "- 데이터 없음"

        # 변화율 계산
        has_prev_data = prev_total_spending > 0
        if has_prev_data:
            change_rate = ((total_spending - prev_total_spending) / prev_total_spending) * 100
            change_str = f"{change_rate:+.1f}%"
        else:
            change_str = None

        prompt = f"""
        [역할]
        당신은 '두둑' 서비스의 AI 재무 분석가입니다.
        사용자의 월간 소비 데이터를 분석하여 구조화된 JSON 리포트를 작성합니다.

        [사용자 페르소나]
        {persona_context}

        [지시사항]
        1. 위 사용자 페르소나(직업, 취미, 과거 소비 성향 요약 등)를 반드시 참고하여
           사용자가 공감할 수 있는 어조와 맥락으로 리포트를 작성하세요.
        2. 예를 들어, 직업이 '개발자'이고 취미가 '독서'라면
           자기계발 도서 구매는 긍정적으로 평가하되, 야식/배달 과다는
           직업 특성(야근)과 연관지어 분석하세요.
        3. 과거 성향 요약(ai_persona_summary)이 있다면, 지난달과 비교하여
           개선된 점과 새로 나타난 패턴을 분석에 포함하세요.
        4. 성향 요약이 없는 경우(첫 분석), 이번 달 데이터만으로 새롭게 작성하세요.

        [분석 데이터]
        - 기간: {year}년 {month}월
        - 월 예산: {monthly_budget:,.0f}원
        - 총 지출: {total_spending:,.0f}원
        - 전월 지출: {prev_total_spending:,.0f}원 (변화율: {change_str if change_str else '비교 데이터 없음'})
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
        - 누수지출 개선: {score_breakdown.get('leakage_improvement', 0)}/10점
        - 챌린지 참여: {score_breakdown.get('challenge_success', 0)}/3점

        [핵심 원칙]
        1. 단순 통계 나열이 아닌 '왜 그런 소비를 했는지' 지출 패턴을 분석
        2. 전문가적 관점에서 객관적으로 정확한 진단 제공
        3. 숫자와 데이터 기반의 논리적 분석
        4. 개선이 필요한 부분은 명확히 지적하되, 실현 가능한 솔루션을 제시
        5. 전월 데이터가 없을 경우({has_prev_data=}), 전월 관련 필드는 null로 설정
        6. 사용자의 직업과 취미, 과거 성향을 고려하여 공감가는 맞춤 조언 제공

        [출력 형식]
        반드시 아래 JSON 스키마를 정확히 따라 응답하세요.
        JSON 외의 텍스트(설명, 마크다운 코드블록 등)는 절대 포함하지 마세요.

    {{
      "updated_persona_summary": "이번 달 소비 내역을 분석하여 기존 성향 요약을 업데이트한 3~5문장의 요약글. 기존 성향이 없으면 이번 달 데이터를 토대로 새로 작성. 예: '충동구매는 줄었으나 식비 지출이 늘어남. 자기개발 욕구가 강하며 도서 구매가 눈에 띔.'",

      "summary": {{
        "period": "{year}년 {month}월",
        "overview": "300자 이내 전체 소비 현황 요약",
        "budget_status": {{
          "budget": {monthly_budget},
          "spent": {total_spending},
          "remaining": {monthly_budget - total_spending},
          "status": "under_budget | over_budget | on_track",
          "message": "예산 대비 상황을 긍정적 또는 개선 필요 톤으로 표현"
        }},
        "top_categories": [
          {{
            "category": "카테고리명",
            "amount": 금액,
            "percentage": 전체대비비율
          }}
        ]
      }},

      "weakness_analysis": {{
        "impulse_spending": {{
          "items": [
            {{
              "description": "충동 소비 내역",
              "amount": 금액,
              "reason": "발생 이유/상황/감정 상태 추론",
              "date": "발생일 (알 수 있는 경우)"
            }}
          ],
          "total_amount": 총액,
          "percentage_of_total": 전체지출대비비율
        }},
        "leakage_areas": [
          {{
            "pattern": "반복적 불필요 소비 패턴 설명",
            "frequency": "주 N회 또는 월 N회",
            "monthly_total": 월누적금액,
            "potential_savings": "줄였을 때 절약 가능 금액"
          }}
        ]
      }},

      "coaching_performance": {{
        "total_coaching_count": 제공된코칭수,
        "success_rate": 성공률퍼센트,
        "estimated_savings": 코칭으로절약한추정금액,
        "best_cases": [
          {{
            "situation": "코칭 상황",
            "action": "사용자 행동",
            "result": "결과/절약 금액"
          }}
        ]
      }},

      "monthly_comparison": {{
        "has_previous_data": {str(has_prev_data).lower()},
        "spending_change": {{
          "amount": {total_spending - prev_total_spending if has_prev_data else 'null'},
          "percentage": {f'{change_rate:.1f}' if has_prev_data else 'null'},
          "direction": "increase | decrease | same"
        }},
        "improvements": [
          "개선된 점 1",
          "개선된 점 2"
        ],
        "areas_to_improve": [
          "악화된 점 (개선 기회로 프레이밍)"
        ],
        "category_changes": [
          {{
            "category": "카테고리명",
            "change_amount": 변동금액,
            "change_percentage": 변동비율,
            "note": "변동 원인 분석"
          }}
        ]
      }},

      "yuntaek_analysis": {{
        "current_score": {yuntaek_score},
        "previous_score": {prev_yuntaek_score if prev_yuntaek_score else 'null'},
        "score_level": "excellent | good | caution | warning",
        "score_message": "점수 수준에 맞는 메시지",
        "factors": [
          {{
            "name": "예산 준수도",
            "key": "budget_achievement",
            "current_score": {score_breakdown.get('budget_achievement', 0)},
            "max_score": 35,
            "change": "up | down | same",
            "change_amount": 전월대비변동점수,
            "influencing_transactions": [
              "영향을 준 주요 소비 내역 1",
              "영향을 준 주요 소비 내역 2"
            ],
            "improvement_tip": "개선을 위한 구체적 팁"
          }},
          {{
            "name": "대체 행동 실현",
            "key": "alternative_action",
            "current_score": {score_breakdown.get('alternative_action', 0)},
            "max_score": 20,
            "change": "up | down | same",
            "change_amount": null,
            "influencing_transactions": [],
            "improvement_tip": "개선을 위한 구체적 팁"
          }},
          {{
            "name": "성장 소비",
            "key": "growth_consumption",
            "current_score": {score_breakdown.get('growth_consumption', 0)},
            "max_score": 10,
            "change": "up | down | same",
            "change_amount": null,
            "influencing_transactions": [],
            "improvement_tip": "개선을 위한 구체적 팁"
          }},
          {{
            "name": "건강 점수",
            "key": "health_score",
            "current_score": {score_breakdown.get('health_score', 0)},
            "max_score": 15,
            "change": "up | down | same",
            "change_amount": null,
            "influencing_transactions": [],
            "improvement_tip": "개선을 위한 구체적 팁"
          }},
          {{
            "name": "소비 일관성",
            "key": "spending_consistency",
            "current_score": {score_breakdown.get('spending_consistency', 0)},
            "max_score": 7,
            "change": "up | down | same",
            "change_amount": null,
            "influencing_transactions": [],
            "improvement_tip": "개선을 위한 구체적 팁"
          }},
          {{
            "name": "누수지출 개선",
            "key": "leakage_improvement",
            "current_score": {score_breakdown.get('leakage_improvement', 0)},
            "max_score": 10,
            "change": "up | down | same",
            "change_amount": null,
            "influencing_transactions": [],
            "improvement_tip": "개선을 위한 구체적 팁"
          }},
          {{
            "name": "챌린지 참여",
            "key": "challenge_success",
            "current_score": {score_breakdown.get('challenge_success', 0)},
            "max_score": 3,
            "change": "up | down | same",
            "change_amount": null,
            "influencing_transactions": [],
            "improvement_tip": "개선을 위한 구체적 팁"
          }}
        ]
      }},

      "next_month_strategy": {{
        "priority_tasks": [
          {{
            "rank": 1,
            "title": "가장 시급한 개선 과제",
            "current_state": "현재 상황",
            "target_state": "목표 상태",
            "action_steps": [
              "구체적 실행 방법 1",
              "구체적 실행 방법 2",
              "구체적 실행 방법 3"
            ],
            "expected_savings": 예상절약금액
          }}
        ],
        "recommended_challenges": [
          {{
            "name": "추천 챌린지명",
            "description": "챌린지 설명",
            "target_weakness": "이 챌린지가 해결하는 문제",
            "expected_benefit": "기대 효과"
          }}
        ],
        "suggested_budget": {{
          "total": 권장총예산,
          "categories": [
            {{
              "category": "카테고리명",
              "amount": 권장금액,
              "reason": "이 금액을 권장하는 이유"
            }}
          ]
        }}
      }},

      "expert_summary": {{
        "overall_assessment": "3-4문장의 전문가적 종합 의견",
        "key_achievement": "이번 달 핵심 성과",
        "key_improvement_area": "핵심 개선점",
        "professional_advice": "다음 달 재무 계획을 위한 전문적 조언"
      }}
    }}

        [작성 가이드라인]
        1. 톤앤매너: 전문 재무 상담가의 객관적이고 정중한 어조.
           사용자 페르소나를 참고하여 공감가는 맞춤형 조언을 제공하세요.
        2. 구체성: 모든 금액은 숫자로, 모호한 표현 대신 정확한 수치
        3. 패턴 분석:
        - 충동 소비: 같은 카테고리 내 평균 대비 고액 지출
        - 소비 누수: 주 2회 이상 반복되는 소형 지출 패턴
        4. 윤택지수 해석:
        - 70점 이상: "excellent" → "훌륭한 소비 습관"
        - 50-69점: "good" → "안정적인 관리"
        - 30-49점: "caution" → "개선 여지가 있어요"
        - 30점 미만: "warning" → "함께 개선해봐요"
        5. 금지 사항:
        - 과도한 부정적 표현 지양
        - 일반적인 재테크 조언 나열 금지 (사용자 데이터 기반 분석만)
        - 불가능한 목표 제시 금지
        6. updated_persona_summary 작성 규칙:
        - 3~5문장으로 이번 달 소비 성향을 요약
        - 기존 성향(ai_persona_summary)이 있으면 변화를 반영하여 업데이트
        - 기존 성향이 없으면 이번 달 데이터를 기반으로 새로 작성
        - 예: "충동구매는 줄었으나 식비 지출이 늘어남. 자기개발 욕구가 강하며 도서 구매가 눈에 띔."
      """

        raw_result = self._generate(prompt)
        if not raw_result:
            return None

        # AI 응답에서 리포트와 페르소나 요약 분리
        updated_persona = raw_result.pop('updated_persona_summary', '')

        return {
            'report': raw_result,
            'updated_persona_summary': updated_persona,
        }

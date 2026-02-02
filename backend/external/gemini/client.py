import os
import json
import re
import datetime
import google.generativeai as genai

# ============================================================
# 상수 정의
# ============================================================

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
    "name": "챌린지 이름 (20자 이내)",
    "difficulty": "easy/normal/hard 중 하나",
    "description": "동기부여가 되는 챌린지 설명 (100자 이내, 친근한 말투)",
    "success_conditions": ["성공 조건 1 (구체적이고 측정 가능하게)", "성공 조건 2 (선택)"],
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

def parse_json_response(text: str) -> dict | None:
    """AI 응답에서 JSON을 추출하고 파싱"""
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


def parse_duration_from_conditions(conditions: list) -> int:
    """성공 조건에서 기간 추출"""
    if not conditions:
        return 7  # 기본 7일
    
    text = " ".join(conditions)
    
    # "N일 연속" 패턴
    match = re.search(r'(\d+)일\s*연속', text)
    if match:
        days = int(match.group(1))
        return days + 2  # N+2일
    
    # "주" 단위 조건
    if '주' in text or '일주일' in text:
        return 7
    
    # "월" 단위 조건
    if '월' in text or '한달' in text or '30일' in text:
        return 30
    
    # "N일" 패턴
    match = re.search(r'(\d+)일', text)
    if match:
        return int(match.group(1))
    
    return 7  # 기본 7일


def parse_target_amount(conditions: list) -> int | None:
    """성공 조건에서 목표 금액 추출"""
    if not conditions:
        return None
    
    text = " ".join(conditions)
    
    # "N원" 또는 "N,NNN원" 패턴
    # 쉼표 제거 후 숫자 추출
    patterns = [
        r'(\d{1,3}(?:,\d{3})*)\s*원',  # 1,000원, 10,000원
        r'(\d+)\s*원',  # 1000원
    ]
    
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            amount_str = match.group(1).replace(',', '')
            return int(amount_str)
    
    return None


# ============================================================
# GeminiClient 클래스
# ============================================================

class GeminiClient:
    def __init__(self):
        self.api_key = os.environ.get("GEMINI_API_KEY")
        if self.api_key:
            genai.configure(api_key=self.api_key)
            self.model = genai.GenerativeModel('gemini-2.5-flash')
        else:
            self.model = None

    def _generate(self, prompt: str) -> dict | None:
        """공통 생성 로직"""
        if not self.model:
            return None
        try:
            response = self.model.generate_content(prompt)
            return parse_json_response(response.text)
        except Exception as e:
            print(f"Gemini API Error: {e}")
            import traceback
            traceback.print_exc()
            return None

    def analyze_text(self, text: str) -> dict | None:
        """
        Parses natural language transaction text into structured JSON.
        """
        today = datetime.date.today().strftime("%Y-%m-%d")
        categories_str = ", ".join(CATEGORIES)

        prompt = f"""
        당신은 텍스트에서 소비 정보를 추출하는 AI입니다.
        다음 텍스트를 분석하여 JSON 형식으로 반환해주세요.
        
        [기준 정보]
        - 오늘 날짜: {today} (텍스트에 날짜가 명시되지 않은 경우 이 날짜를 사용하세요)

        [입력 텍스트]
        {text}

        [반환 형식]
        {{
            "category": "카테고리 ({categories_str})",
            "item": "품목 (예: 아메리카노, 택시비)",
            "store": "소비처 (예: 스타벅스, 카카오택시)",
            "amount": 금액(숫자만),
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

    def get_advice(self, transaction_list_str: str) -> dict | None:
        """
        Generates financial advice based on transaction history.
        """
        prompt = f"""
        [역할]
        당신은 '두둑' 서비스의 AI 소비 코치이자, 친근하고 공감적인 소비 코칭 전문가입니다. 
        사용자의 소비 취향을 존중하면서 만족도 높은 대안이나 실천 가능한 행동 변화를 제안합니다.

        [지출 내역]
        {transaction_list_str}

        [소비 분석]
        - 지출 내역을 분석하여 사용자의 소비 패턴과 소비 취향을 분석
        - 개선 가능성이 있는 항목 식별 (불필요한 지출, 과다 금액 항목)

        [코칭 주제(넷 중 하나만 선택)]
        1. 키워드 기반 대안
        - 사용자의 소비 취향은 유지하되, 더 저렴하고 가성비 좋은 대안 제안
        - 사용자의 소비 항목에서 키워드를 추출해 이와 비슷한 키워드를 가진 대안을 추천
        - 대안 추천을 따랐을 때의 예상 절감액 제시(절감액 = 현재금액 - 대안금액)
        - 가격비교, 취향 적합 키워드 일치, 평점·후기 등 객관 근거 제공
        2. 행동 변화 제안 
        - 불필요한 지출이나 과다 금액을 줄일 수 있는 구체적이고 실천 가능한 행동 제안
        - 제안하는 행동의 구체적 방법
        - 이를 통해 예상되는 월 절감액을 제공(월 절감액 = 절감액 x 월평균 빈도)
        - 행동 변화를 제안하는 근거 제공
        3. 위치 기반 대안
        - 같은 소비 품목이지만 더 저렴한 위치의 가게를 찾아서 사용자에게 제안
        - 소비 위치로부터 1km 이내여야 함.
        - 대안 추천을 따랐을 때의 예상 절감액 제시(절감액 = 현재금액 - 대안금액)
        - 가격비교, 거리/시간 제약 충족, 평점·후기 등 객관 근거 제공
        4. 누수 소비
        - 누수 소비는 습관적, 반복적으로 빠져나가는 소액 지출을 의미 (예: 택시비, 수수료, 미사용 구독)
        - 사용자의 지출 내역에서 누수 소비를 분석하여 사용자에게 인지시키고 누수 소비라고 판단한 객관 근거 제공
        - 해당 누수 소비를 줄일 수 있는 구체적이고 실천 가능한 방안 제안
        - 이를 통해 예상되는 절감액을 제공

        [주제 선정 기준]
        - 만족도 저하가 낮고 실행 장벽이 낮은 주제 우선
        - 같은 조건이면 절감액이 큰 쪽 선택
        - 반드시 하나만 출력

        [어투 및 태도]
        - 강요/훈계 금지
        - 친근하고 격려하는 톤("~는 건 어떨까요?", "~해보면 좋을 것 같아요")
        - 모든 금액 원 단위 콤마 표기
        - 사용자의 취향과 만족도를 최우선으로 고려하며 실현 가능성이 낮은 극단적 제안 지양

        [생성 규칙]
        1. 주제는 위 4가지 중 하나를 선택하세요: "행동 변화 제안", "누수 소비", "위치 기반 대안", "키워드 기반 대안"
        2. 내용은 소비 내역 분석과 그에 따른 코칭 내용이 포함되어야 합니다.
        3. 내역 분석 + 코칭 내용은 300자 이내로 작성하세요.
        4. 제목(title)은 코칭 내용을 한눈에 알 수 있는 20자 이내의 짧은 문구로 작성하세요.
        5. 반드시 JSON 형식으로 반환하세요.

        [반환 형식]
        {{
            "subject": "선택한 주제",
            "title": "코칭 제목 (예: 편의점 간식 줄이기)",
            "analysis": "소비 분석 내용",
            "coaching_content": "코칭 내용",
            "estimated_savings": 예상 월 절감액(숫자만, 없으면 0)
        }}
        
        JSON 외에 다른 말은 하지 마세요.
        """

        return self._generate(prompt)

    def generate_challenge(self, details: str, difficulty: str = None,
                          user_spending_summary: str = None) -> dict | None:
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
        1. 성공 조건은 구체적이고 측정 가능하게 (예: "주 3회 이하", "7일간 5만원 이하")
        2. target_keywords는 지출 항목에서 매칭할 키워드 (예: ["커피", "카페", "스타벅스"])
        3. target_categories는 위 카테고리 목록에서 관련된 것만 선택 (예: ["카페/간식"])
        4. 챌린지 설명은 친근하고 동기부여가 되는 말투로

        {CHALLENGE_SCHEMA}
        """

        result = self._generate(prompt)
        if result:
            self._process_challenge_result(result, details, difficulty)
        return result

    def generate_challenge_from_coaching(self, coaching_data: dict,
                                         difficulty: str = None) -> dict | None:
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
        1. 성공 조건은 구체적이고 측정 가능하게 (예: "주 3회 이하", "7일간 5만원 이하")
        2. target_keywords는 지출 항목에서 매칭할 키워드 (예: ["커피", "카페", "스타벅스"])
        3. target_categories는 위 카테고리 목록에서 관련된 것만 선택 (예: ["카페/간식"])
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

        # 성공 조건 가져오기
        conditions = result.get('success_conditions', [])

        # 백엔드 규칙 기반 처리
        result['base_points'] = calculate_points(difficulty)
        result['duration_days'] = parse_duration_from_conditions(conditions)
        result['target_amount'] = parse_target_amount(conditions)

        # target_categories: AI가 생성한 값 사용, 없으면 기본값
        if not result.get('target_categories'):
            result['target_categories'] = ["기타"]


        # 기본값 설정
        result.setdefault('name', fallback_name[:20] if fallback_name else '맞춤 챌린지')
        result.setdefault('description', '')
        result.setdefault('success_conditions', [])
        result.setdefault('target_keywords', [])
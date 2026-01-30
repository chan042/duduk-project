import os
import json
import google.generativeai as genai

class GeminiClient:
    def __init__(self):
        self.api_key = os.environ.get("GEMINI_API_KEY")
        if self.api_key:
            genai.configure(api_key=self.api_key)
            self.model = genai.GenerativeModel('gemini-2.5-flash')
        else:
            self.model = None

    def analyze_text(self, text):
        """
        Parses natural language transaction text into structured JSON.
        """
        if not self.model:
            return None

        import datetime
        today = datetime.date.today().strftime("%Y-%m-%d")

        prompt = f"""
        당신은 텍스트에서 소비 정보를 추출하는 AI입니다.
        다음 텍스트를 분석하여 JSON 형식으로 반환해주세요.
        
        [기준 정보]
        - 오늘 날짜: {today} (텍스트에 날짜가 명시되지 않은 경우 이 날짜를 사용하세요)

        [입력 텍스트]
        {text}

        [반환 형식]
        {{
            "category": "카테고리 (식비, 생활, 카페/간식, 온라인 쇼핑, 패션/쇼핑, 뷰티/미용, 교통, 자동차, 주거/통신, 의료/건강, 문화/여가, 여행/숙박, 교육/학습, 자녀/육아, 반려동물, 경조/선물, 술/유흥, 기타)",
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
        
        try:
            response = self.model.generate_content(prompt)        
            cleaned_text = response.text.replace("```json", "").replace("```", "").strip()
            data = json.loads(cleaned_text)
            
            # Ensure no None values for string fields
            for field in ['category', 'item', 'store', 'memo', 'address', 'date']:
                if data.get(field) is None:
                    data[field] = ""
            
            # Ensure is_fixed is boolean
            if 'is_fixed' not in data:
                data['is_fixed'] = False
                
            return data
        except Exception as e:
            import traceback
            print(f"DEBUG: Gemini Analysis Error Detailed: {e}")
            traceback.print_exc() # 전체 에러 스택 출력
            return None

    def get_advice(self, transaction_list_str):
        """
        Generates financial advice based on transaction history.
        """
        if not self.model:
            return None

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
        
        try:
            response = self.model.generate_content(prompt)
            cleaned_text = response.text.replace("```json", "").replace("```", "").strip()
            return json.loads(cleaned_text)
        except Exception as e:
            print(f"AI Coaching Error: {e}")
            return None

    def generate_challenge(self, title, details, difficulty, user_spending_summary=None):
        """
        사용자 입력을 바탕으로 맞춤 챌린지를 생성합니다.

        Args:
            title: 챌린지 제목 (예: "스마트 커피 줄이기")
            details: 상세 내용 (예: "매일 만보 걷기")
            difficulty: 난이도 (easy, medium, hard)
            user_spending_summary: 사용자 지출 요약 (선택)

        Returns:
            생성된 챌린지 정보 (JSON)
        """
        if not self.model:
            return None

        difficulty_map = {
            'easy': {'duration_range': '3-7', 'points_range': '100-200', 'desc': 'EASY'},
            'medium': {'duration_range': '7-14', 'points_range': '200-350', 'desc': 'MEDIUM'},
            'hard': {'duration_range': '14-30', 'points_range': '350-500', 'desc': 'HARD'}
        }

        diff_info = difficulty_map.get(difficulty, difficulty_map['medium'])

        spending_context = ""
        if user_spending_summary:
            spending_context = f"""
        [사용자 소비 패턴]
        {user_spending_summary}
        """

        prompt = f"""
        [역할]
        당신은 '두둑' 서비스의 AI 챌린지 설계자입니다.
        사용자가 입력한 제목과 상세 내용을 바탕으로 실천 가능하고 동기부여가 되는 챌린지를 생성합니다.

        [사용자 입력]
        - 제목: {title}
        - 상세 내용: {details}
        - 난이도: {diff_info['desc']}
        {spending_context}

        [챌린지 설계 규칙]
        1. 난이도에 맞게 기간과 포인트를 설정하세요:
           - 기간: {diff_info['duration_range']}일 범위
           - 포인트: {diff_info['points_range']}P 범위
        2. 성공 조건은 1-2개로 구체적이고 측정 가능하게 작성하세요.
        3. 예상 절약 금액은 현실적으로 계산하세요 (없으면 0).
        4. 챌린지 설명은 친근하고 동기부여가 되는 말투로 작성하세요.
        5. 아이콘은 챌린지 주제에 맞게 선택하세요.

        [사용 가능한 아이콘]
        coffee, utensils, shopping-bag, car, home, heart, book,
        piggy-bank, target, flame, star, zap, gift, smile,
        trending-down, wallet, leaf, sun, moon, cloud

        [카테고리 목록]
        식비, 생활, 카페/간식, 온라인 쇼핑, 패션/쇼핑, 뷰티/미용,
        교통, 자동차, 주거/통신, 의료/건강, 문화/여가, 여행/숙박,
        교육/학습, 자녀/육아, 반려동물, 경조/선물, 술/유흥, 기타

        [반환 형식]
        반드시 아래 JSON 형식으로만 반환하세요:
        {{
            "name": "챌린지 이름 (20자 이내)",
            "description": "챌린지 설명 (100자 이내, 친근한 말투)",
            "icon": "아이콘 이름",
            "icon_color": "HEX 색상코드 (예: #4CAF50)",
            "duration_days": 기간(숫자),
            "base_points": 포인트(숫자),
            "estimated_savings": 예상 절약 금액(숫자, 없으면 0),
            "success_conditions": [
                "성공 조건 1",
                "성공 조건 2"
            ],
            "target_amount": 목표 금액(숫자, 해당시),
            "target_categories": ["관련 카테고리1", "관련 카테고리2"]
        }}

        JSON 외에 다른 말은 하지 마세요.
        """

        try:
            response = self.model.generate_content(prompt)
            cleaned_text = response.text.replace("```json", "").replace("```", "").strip()
            result = json.loads(cleaned_text)

            # 필수 필드 기본값 설정
            result.setdefault('name', title)
            result.setdefault('description', details)
            result.setdefault('icon', 'target')
            result.setdefault('icon_color', '#4CAF50')
            result.setdefault('duration_days', 7)
            result.setdefault('base_points', 100)
            result.setdefault('estimated_savings', 0)
            result.setdefault('success_conditions', [])
            result.setdefault('target_amount', None)
            result.setdefault('target_categories', [])

            result['difficulty'] = difficulty

            return result
        except Exception as e:
            print(f"AI Challenge Generation Error: {e}")
            return None

    def generate_challenge_from_coaching(self, coaching_data, difficulty='medium'):
        """
        코칭 카드 데이터를 바탕으로 맞춤 챌린지를 생성합니다.

        Args:
            coaching_data: 코칭 정보 dict
                - title: 코칭 제목
                - subject: 코칭 주제
                - analysis: 소비 분석
                - coaching_content: 코칭 내용
                - estimated_savings: 예상 절약액
            difficulty: 난이도 (easy, medium, hard)

        Returns:
            생성된 챌린지 정보 (JSON)
        """
        if not self.model:
            return None

        difficulty_map = {
            'easy': {'duration_range': '3-7', 'points_range': '100-200', 'desc': 'EASY'},
            'medium': {'duration_range': '7-14', 'points_range': '200-350', 'desc': 'MEDIUM'},
            'hard': {'duration_range': '14-30', 'points_range': '350-500', 'desc': 'HARD'}
        }

        diff_info = difficulty_map.get(difficulty, difficulty_map['medium'])

        prompt = f"""
        [역할]
        당신은 '두둑' 서비스의 AI 챌린지 설계자입니다.
        AI 소비 코칭 분석 결과를 바탕으로 사용자가 실천할 수 있는 챌린지를 생성합니다.

        [코칭 분석 결과]
        - 코칭 제목: {coaching_data.get('title', '')}
        - 코칭 주제: {coaching_data.get('subject', '')}
        - 소비 분석: {coaching_data.get('analysis', '')}
        - 코칭 내용: {coaching_data.get('coaching_content', '')}
        - 예상 절약액: {coaching_data.get('estimated_savings', 0)}원

        [선택된 난이도]
        {diff_info['desc']}

        [챌린지 설계 규칙]
        1. 코칭 내용을 실천할 수 있는 구체적인 챌린지로 변환하세요.
        2. 난이도에 맞게 기간과 포인트를 설정하세요:
           - 기간: {diff_info['duration_range']}일 범위
           - 포인트: {diff_info['points_range']}P 범위
        3. 성공 조건은 1-2개로 구체적이고 측정 가능하게 작성하세요.
        4. 코칭의 예상 절약액을 참고하여 현실적인 목표 금액을 설정하세요.
        5. 챌린지 설명은 친근하고 동기부여가 되는 말투로 작성하세요.
        6. 아이콘은 챌린지 주제에 맞게 선택하세요.

        [사용 가능한 아이콘]
        coffee, utensils, shopping-bag, car, home, heart, book,
        piggy-bank, target, flame, star, zap, gift, smile,
        trending-down, wallet, leaf, sun, moon, cloud

        [카테고리 목록]
        식비, 생활, 카페/간식, 온라인 쇼핑, 패션/쇼핑, 뷰티/미용,
        교통, 자동차, 주거/통신, 의료/건강, 문화/여가, 여행/숙박,
        교육/학습, 자녀/육아, 반려동물, 경조/선물, 술/유흥, 기타

        [반환 형식]
        반드시 아래 JSON 형식으로만 반환하세요:
        {{
            "name": "챌린지 이름 (20자 이내)",
            "description": "챌린지 설명 (100자 이내, 친근한 말투)",
            "icon": "아이콘 이름",
            "icon_color": "HEX 색상코드 (예: #4CAF50)",
            "duration_days": 기간(숫자),
            "base_points": 포인트(숫자),
            "estimated_savings": 예상 절약 금액(숫자),
            "success_conditions": [
                "성공 조건 1",
                "성공 조건 2"
            ],
            "target_amount": 목표 금액(숫자, 해당시),
            "target_categories": ["관련 카테고리1", "관련 카테고리2"]
        }}

        JSON 외에 다른 말은 하지 마세요.
        """

        try:
            response = self.model.generate_content(prompt)
            cleaned_text = response.text.replace("```json", "").replace("```", "").strip()
            result = json.loads(cleaned_text)

            # 필수 필드 기본값 설정
            result.setdefault('name', coaching_data.get('title', '코칭 기반 챌린지'))
            result.setdefault('description', coaching_data.get('coaching_content', '')[:100])
            result.setdefault('icon', 'target')
            result.setdefault('icon_color', '#4CAF50')
            result.setdefault('duration_days', 7)
            result.setdefault('base_points', 150)
            result.setdefault('estimated_savings', coaching_data.get('estimated_savings', 0))
            result.setdefault('success_conditions', [])
            result.setdefault('target_amount', None)
            result.setdefault('target_categories', [])

            result['difficulty'] = difficulty
            result['coaching_id'] = coaching_data.get('id')

            return result
        except Exception as e:
            print(f"AI Challenge from Coaching Error: {e}")
            return None

"""
[파일 역할]
- 두두(Dudu) AI 상담사 서비스 로직을 담당합니다.
- 사용자 프로필, 재정 상태, 진행 중 챌린지를 DB에서 수집하여 AI 컨텍스트를 구성합니다.
- Gemini API를 호출하여 개인화된 소비 코칭 응답을 생성합니다.
- 대화 이력을 ChatMessage 모델에 저장합니다.
"""
import logging
from typing import Optional

from django.utils import timezone

logger = logging.getLogger(__name__)

# 프롬프트 설정 파일 로드
from external.ai.client import AIClient, DUDU_PROMPT_CONFIG


class DuduChatService:
    """
    두두 AI 상담사 서비스.
    - build_context(): 사용자 데이터를 DB에서 수집
    - chat(): Gemini 호출 + 응답 저장
    """

    def __init__(self):
        self.ai_client = AIClient(purpose="coaching")

    # ------------------------------------------------------------------ #
    # 컨텍스트 수집
    # ------------------------------------------------------------------ #

    def build_context(self, user) -> dict:
        """
        사용자 프로필, 재정 상태, 진행 중 챌린지를 DB에서 수집하여
        프롬프트에 포함할 컨텍스트 dict를 반환합니다.
        """
        # 1) 사용자 프로필
        hobbies = []
        if user.hobbies:
            # hobbies는 쉼표로 구분된 문자열로 저장됨
            hobbies = [h.strip() for h in user.hobbies.split(",") if h.strip()]

        age_group = ""
        if user.age:
            decade = (user.age // 10) * 10
            age_group = f"{decade}대"

        display_name = user.character_name or user.username or user.email.split("@")[0]

        user_profile = {
            "name": display_name,
            "age_group": age_group,
            "job": user.job or "미입력",
            "hobbies": hobbies,
        }

        # 2) 재정 상태
        financial_status = self._get_financial_status(user)

        # 3) 진행 중 챌린지
        active_challenges = self._get_active_challenges(user)

        return {
            "user_profile": user_profile,
            "financial_status": financial_status,
            "active_challenges": active_challenges,
        }

    def _get_financial_status(self, user) -> dict:
        """이번 달 잔여 예산과 오늘 지출을 계산합니다."""
        from apps.transactions.models import Transaction

        now = timezone.localtime()
        today = now.date()

        monthly_budget = int(user.monthly_budget or 0)

        # 이번 달 총 지출
        month_start = today.replace(day=1)
        month_transactions = Transaction.objects.filter(
            user=user,
            date__date__gte=month_start,
            date__date__lte=today,
        )
        month_total = sum(t.amount for t in month_transactions)
        remaining_budget = monthly_budget - month_total

        # 오늘 지출
        today_transactions = Transaction.objects.filter(
            user=user,
            date__date=today,
        )
        today_spending = sum(t.amount for t in today_transactions)

        return {
            "monthly_budget": monthly_budget,
            "remaining_budget": remaining_budget,
            "today_spending": today_spending,
        }

    def _get_active_challenges(self, user) -> list:
        """현재 진행 중(active)인 챌린지 목록을 반환합니다."""
        from apps.challenges.models import UserChallenge

        challenges = UserChallenge.objects.filter(
            user=user,
            status="active",
        ).values("name", "status")

        return [{"name": c["name"], "status": c["status"]} for c in challenges]

    # ------------------------------------------------------------------ #
    # 시스템 프롬프트 구성
    # ------------------------------------------------------------------ #

    def _build_system_prompt(self, context: dict) -> str:
        """
        DUDU_PROMPT_CONFIG의 설정과 실시간 사용자 컨텍스트를 결합하여
        Gemini에 전달할 시스템 프롬프트 문자열을 생성합니다.
        """
        config = DUDU_PROMPT_CONFIG["system_prompt"]
        identity = config["agent_identity"]
        rules = config["core_rules"]
        guidelines = config.get("response_guidelines", {})
        few_shots = config.get("few_shot_examples", [])

        # 퓨샷 예시 구성
        few_shot_text = ""
        for i, ex in enumerate(few_shots, 1):
            few_shot_text += (
                f"\n[예시 {i}]\n"
                f"사용자: {ex['user_input']}\n"
                f"두두: {ex['agent_response']}\n"
            )

        # 챌린지 텍스트
        challenges = context.get("active_challenges", [])
        if challenges:
            challenges_text = ", ".join(
                f"'{c['name']}'" for c in challenges
            )
        else:
            challenges_text = "없음"

        fs = context["financial_status"]
        up = context["user_profile"]

        system_prompt = f"""
당신은 '{identity['name']}'입니다.
역할: {identity['role']}

[말투 및 태도]
{chr(10).join(f"- {t}" for t in identity['tone_and_manner'])}

[핵심 규칙]
{chr(10).join(f"{r}" for r in rules)}

[현재 사용자 정보]
- 이름: {up['name']}
- 나이대: {up['age_group']}
- 직업: {up['job']}
- 취미: {', '.join(up['hobbies']) if up['hobbies'] else '미입력'}
- 이번 달 예산: {fs['monthly_budget']:,}원
- 잔여 예산: {fs['remaining_budget']:,}원
- 오늘 지출: {fs['today_spending']:,}원
- 진행 중 챌린지: {challenges_text}

[응답 가이드라인]
- 최대 길이: {guidelines.get('max_length', '200자 이내')}
- 구조: {guidelines.get('structure', '공감 → 상황 언급 → 대안 제시')}
- 이모지: {guidelines.get('emoji_usage', '자연스럽게 1~2개')}
- 금지 표현: {', '.join(guidelines.get('forbidden', []))}

[응답 예시]
{few_shot_text}

위 정보를 바탕으로 사용자의 메시지에 두두의 페르소나로 답변하세요.
답변은 자연스러운 대화체로, 공감을 먼저 표현한 뒤 상황에 맞는 조언을 제공하세요.
""".strip()

        return system_prompt

    # ------------------------------------------------------------------ #
    # 대화 실행
    # ------------------------------------------------------------------ #

    def chat(self, session, user_message_content: str) -> Optional[str]:
        """
        사용자 메시지를 받아 AI 응답을 생성하고 두 메시지를 DB에 저장합니다.

        Args:
            session: ChatSession 인스턴스
            user_message_content: 사용자가 입력한 메시지 텍스트

        Returns:
            AI 응답 텍스트 (실패 시 None)
        """
        from .models import ChatMessage

        # 1) 사용자 메시지 저장
        user_msg = ChatMessage.objects.create(
            session=session,
            role="user",
            content=user_message_content,
        )

        # 2) 컨텍스트 수집
        context = self.build_context(session.user)

        # 3) 시스템 프롬프트 구성
        system_prompt = self._build_system_prompt(context)

        # 4) 대화 이력 구성 (현재 세션의 이전 메시지들, 최근 20개)
        history_qs = (
            ChatMessage.objects.filter(session=session)
            .exclude(id=user_msg.id)  # 방금 저장한 메시지 제외
            .order_by("-created_at")[:20]
        )
        history = list(reversed(history_qs))  # 오래된 순으로

        history_messages = [
            {
                "role": msg.role,
                "content": msg.content,
            }
            for msg in history
        ]

        # 5) Gemini 호출
        if not self.ai_client.client:
            assistant_content = "죄송해요, 지금 AI 서비스에 일시적인 문제가 생겼어요. 잠시 후 다시 시도해주세요. 😅"
        else:
            assistant_content = self.ai_client.generate_chat_reply(
                system_prompt=system_prompt,
                history=history_messages,
                user_message_content=user_message_content,
            )
            if not assistant_content:
                assistant_content = "죄송해요, 잠시 연결이 불안정해요. 조금 뒤에 다시 말씀해주세요. 🙏"

        # 6) AI 응답 저장
        assistant_msg = ChatMessage.objects.create(
            session=session,
            role="assistant",
            content=assistant_content,
        )

        # 7) 세션 updated_at 갱신
        session.save(update_fields=["updated_at"])

        return user_msg, assistant_msg

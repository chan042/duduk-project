from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import SimpleTestCase, TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.coaching.models import Coaching, CoachingGenerationRequest
from apps.coaching.services import (
    process_pending_coaching_generation_requests,
    schedule_coaching_generation_requests,
)
from apps.challenges.models import UserChallenge
from apps.transactions.models import Transaction
from external.ai.client import AIClient, CoachingAdviceResponse


class AIClientCoachingTests(SimpleTestCase):
    def _build_client(self):
        client = AIClient.__new__(AIClient)
        client.client = object()
        client.default_model = "gemini-test"
        client.model = "gemini-test"
        client.purpose = "coaching"
        return client

    def test_parse_omits_json_mime_type_when_using_web_search(self):
        ai_client = self._build_client()
        captured = {}

        def fake_generate_content_with_fallback(*, contents, config, model):
            captured["config"] = config
            return SimpleNamespace(
                parsed={
                    "subject": "행동 변화 제안",
                    "title": "커피줄임",
                    "coaching_content": "이번 주는 커피 횟수를 한 번만 줄여보세요.",
                    "analysis": "카페 지출이 반복되고 있어요.",
                    "generation_reason": "카페 지출이 반복되어 우선 코칭했어요.",
                    "estimated_savings": 4500,
                }
            )

        ai_client._generate_content_with_fallback = fake_generate_content_with_fallback

        result, _ = ai_client._parse(
            "test prompt",
            CoachingAdviceResponse,
            use_web_search=True,
        )

        config_dict = captured["config"].model_dump(exclude_none=True)

        self.assertEqual(result["subject"], "행동 변화 제안")
        self.assertIn("tools", config_dict)
        self.assertNotIn("response_mime_type", config_dict)

    def test_get_advice_falls_back_to_non_search_prompt(self):
        ai_client = self._build_client()
        calls = []
        parse_results = [
            (None, None),
            (
                {
                    "subject": "행동 변화 제안",
                    "title": "커피줄임",
                    "coaching_content": "이번 주는 테이크아웃을 한 번 줄여보세요.",
                    "analysis": "카페 소비가 잦아요.",
                    "generation_reason": "카페 소비가 반복되어 먼저 코칭했어요.",
                    "estimated_savings": 4500,
                },
                None,
            ),
        ]

        def fake_parse(prompt, response_model, **kwargs):
            calls.append({"prompt": prompt, **kwargs})
            return parse_results.pop(0)

        ai_client._parse = fake_parse
        ai_client._extract_search_sources = lambda response: []

        result = ai_client.get_advice("- 2026-03-18 카페/간식 / 아이스라떼 (카페) / 4500원")

        self.assertEqual(result["sources"], [])
        self.assertEqual(len(calls), 2)
        self.assertTrue(calls[0]["use_web_search"])
        self.assertFalse(calls[1]["use_web_search"])
        self.assertIn("위치 기반 대안과 키워드 기반 대안은 선택하지 마세요.", calls[1]["prompt"])

    def test_get_advice_includes_spending_to_improve_priority_context(self):
        ai_client = self._build_client()
        captured = {}

        def fake_parse(prompt, response_model, **kwargs):
            captured["prompt"] = prompt
            return (
                {
                    "subject": "행동 변화 제안",
                    "title": "배달줄임",
                    "coaching_content": "이번 주는 배달을 한 번 줄여보세요.",
                    "analysis": "배달 지출이 반복되고 있어요.",
                    "generation_reason": "배달 음식 소비를 줄이고 싶다고 입력해 우선 코칭했어요.",
                    "estimated_savings": 12000,
                },
                None,
            )

        ai_client._parse = fake_parse
        ai_client._extract_search_sources = lambda response: []

        result = ai_client.get_advice(
            "- 2026-03-18 식비 / 배달 떡볶이 (배달앱) / 18000원",
            user_context={"spending_to_improve": "배달 음식"},
        )

        self.assertEqual(
            result["generation_reason"],
            "배달 음식 소비를 줄이고 싶다고 입력해 우선 코칭했어요.",
        )
        self.assertIn("개선하고 싶은 소비", captured["prompt"])
        self.assertIn("배달 음식", captured["prompt"])
        self.assertIn("generation_reason", captured["prompt"])


class CoachingSignalTests(TestCase):
    def setUp(self):
        user_model = get_user_model()
        self.user = user_model.objects.create_user(
            username="coach-user",
            email="coach@example.com",
            password="password123",
        )

    @patch("apps.coaching.tasks.run_coaching_generation_queue.delay")
    def test_third_transaction_creates_generation_request_after_commit(self, mock_delay):
        with self.captureOnCommitCallbacks(execute=True):
            transactions = [
                Transaction.objects.create(
                    user=self.user,
                    category="카페/간식",
                    item=f"아메리카노 {index + 1}",
                    store="테스트카페",
                    amount=4500,
                    date=timezone.now(),
                )
                for index in range(3)
            ]

        generation_requests = CoachingGenerationRequest.objects.filter(user=self.user)

        self.assertEqual(Coaching.objects.filter(user=self.user).count(), 0)
        self.assertEqual(generation_requests.count(), 1)
        self.assertEqual(generation_requests.get().start_after_transaction_id, None)
        self.assertEqual(generation_requests.get().end_transaction_id, transactions[-1].id)
        mock_delay.assert_called_once_with(self.user.id)

    @patch("apps.coaching.signals.schedule_coaching_generation_requests")
    def test_schedule_failure_does_not_break_transaction_save(self, mock_schedule):
        mock_schedule.side_effect = RuntimeError("queue unavailable")

        with self.captureOnCommitCallbacks(execute=True):
            transaction = Transaction.objects.create(
                user=self.user,
                category="카페/간식",
                item="아메리카노",
                store="테스트카페",
                amount=4500,
                date=timezone.now(),
            )

        self.assertTrue(
            Transaction.objects.filter(id=transaction.id, user=self.user).exists()
        )


class CoachingGenerationQueueTests(TestCase):
    def setUp(self):
        user_model = get_user_model()
        self.user = user_model.objects.create_user(
            username="coach-queue-user",
            email="coach-queue@example.com",
            password="password123",
            spending_to_improve="배달 음식",
        )

    @patch("apps.coaching.tasks.run_coaching_generation_queue.delay")
    def test_schedule_creates_requests_in_batches_of_three(self, mock_delay):
        transactions = [
            Transaction.objects.create(
                user=self.user,
                category="카페/간식",
                item=f"아메리카노 {index + 1}",
                store="테스트카페",
                amount=4500,
                date=timezone.now(),
            )
            for index in range(6)
        ]

        created_request_ids = schedule_coaching_generation_requests(self.user.id)
        generation_requests = list(
            CoachingGenerationRequest.objects.filter(user=self.user).order_by("end_transaction_id")
        )

        self.assertEqual(len(created_request_ids), 2)
        self.assertEqual(len(generation_requests), 2)
        self.assertEqual(generation_requests[0].start_after_transaction_id, None)
        self.assertEqual(generation_requests[0].end_transaction_id, transactions[2].id)
        self.assertEqual(generation_requests[1].start_after_transaction_id, transactions[2].id)
        self.assertEqual(generation_requests[1].end_transaction_id, transactions[5].id)
        mock_delay.assert_called_once_with(self.user.id)

    @patch("apps.coaching.tasks.run_coaching_generation_queue.delay")
    def test_schedule_uses_transaction_created_at_order_for_batches(self, mock_delay):
        base_time = timezone.now()
        transactions = [
            Transaction.objects.create(
                user=self.user,
                category="카페/간식",
                item=f"정렬 확인 {index + 1}",
                store="테스트카페",
                amount=4500,
                date=timezone.now(),
            )
            for index in range(6)
        ]
        created_at_offsets = [0, 40, 10, 50, 20, 60]

        for transaction, offset in zip(transactions, created_at_offsets):
            Transaction.objects.filter(pk=transaction.pk).update(
                created_at=base_time + timedelta(seconds=offset)
            )

        created_request_ids = schedule_coaching_generation_requests(self.user.id)
        generation_requests = list(
            CoachingGenerationRequest.objects.filter(user=self.user).order_by("id")
        )

        self.assertEqual(len(created_request_ids), 2)
        self.assertEqual(len(generation_requests), 2)
        self.assertEqual(generation_requests[0].start_after_transaction_id, None)
        self.assertEqual(generation_requests[0].end_transaction_id, transactions[4].id)
        self.assertEqual(generation_requests[1].start_after_transaction_id, transactions[4].id)
        self.assertEqual(generation_requests[1].end_transaction_id, transactions[5].id)
        mock_delay.assert_called_once_with(self.user.id)

    @patch("apps.coaching.services.AIClient")
    @patch("apps.coaching.tasks.run_coaching_generation_queue.delay")
    def test_processes_queued_requests_sequentially_without_duplicates(
        self,
        mock_delay,
        mock_ai_client_class,
    ):
        for index in range(6):
            Transaction.objects.create(
                user=self.user,
                category="카페/간식",
                item=f"아메리카노 {index + 1}",
                store="테스트카페",
                amount=4500,
                date=timezone.now(),
            )

        schedule_coaching_generation_requests(self.user.id)

        mock_ai_client = mock_ai_client_class.return_value
        mock_ai_client.get_advice.side_effect = [
            {
                "subject": "행동 변화 제안",
                "title": "코칭1",
                "coaching_content": "첫 번째 코칭",
                "analysis": "첫 번째 분석",
                "estimated_savings": 3000,
                "sources": [],
            },
            {
                "subject": "행동 변화 제안",
                "title": "코칭2",
                "coaching_content": "두 번째 코칭",
                "analysis": "두 번째 분석",
                "estimated_savings": 5000,
                "sources": [],
            },
        ]

        first_run_result = process_pending_coaching_generation_requests(self.user.id)
        second_run_result = process_pending_coaching_generation_requests(self.user.id)

        coachings = list(Coaching.objects.filter(user=self.user).order_by("id"))
        generation_requests = list(
            CoachingGenerationRequest.objects.filter(user=self.user).order_by("end_transaction_id")
        )

        self.assertEqual(first_run_result["processed_request_ids"], [generation_requests[0].id, generation_requests[1].id])
        self.assertEqual(first_run_result["failed_request_ids"], [])
        self.assertEqual(second_run_result["processed_request_ids"], [])
        self.assertEqual(len(coachings), 2)
        self.assertEqual(coachings[0].title, "코칭1")
        self.assertEqual(coachings[1].title, "코칭2")
        self.assertTrue(
            all(
                generation_request.status == CoachingGenerationRequest.Status.COMPLETED
                for generation_request in generation_requests
            )
        )
        self.assertEqual(mock_ai_client.get_advice.call_count, 2)
        mock_delay.assert_called_once_with(self.user.id)

    @patch("apps.coaching.services.AIClient")
    @patch("apps.coaching.tasks.run_coaching_generation_queue.delay")
    def test_process_uses_transaction_created_at_order_for_context(
        self,
        mock_delay,
        mock_ai_client_class,
    ):
        base_time = timezone.now()
        transactions = [
            Transaction.objects.create(
                user=self.user,
                category="식비",
                item=f"생성순서 {index + 1}",
                store="배달앱",
                amount=18000,
                date=timezone.now(),
            )
            for index in range(3)
        ]
        created_at_offsets = [0, 20, 10]

        for transaction, offset in zip(transactions, created_at_offsets):
            Transaction.objects.filter(pk=transaction.pk).update(
                created_at=base_time + timedelta(seconds=offset)
            )

        schedule_coaching_generation_requests(self.user.id)

        mock_ai_client = mock_ai_client_class.return_value
        mock_ai_client.get_advice.return_value = {
            "subject": "행동 변화 제안",
            "title": "정렬 점검",
            "coaching_content": "등록 순서대로 코칭합니다.",
            "analysis": "등록 시간 순 3건을 분석했어요.",
            "estimated_savings": 1000,
            "sources": [],
        }

        result = process_pending_coaching_generation_requests(self.user.id)
        prompt = mock_ai_client.get_advice.call_args.args[0]
        generation_request = CoachingGenerationRequest.objects.get(user=self.user)

        self.assertEqual(len(result["processed_request_ids"]), 1)
        self.assertEqual(generation_request.end_transaction_id, transactions[1].id)
        self.assertLess(prompt.index("생성순서 1"), prompt.index("생성순서 3"))
        self.assertLess(prompt.index("생성순서 3"), prompt.index("생성순서 2"))
        mock_delay.assert_called_once_with(self.user.id)

    @patch("apps.coaching.services.AIClient")
    @patch("apps.coaching.tasks.run_coaching_generation_queue.delay")
    def test_process_passes_spending_to_improve_context_and_saves_generation_reason(
        self,
        mock_delay,
        mock_ai_client_class,
    ):
        for index in range(3):
            Transaction.objects.create(
                user=self.user,
                category="식비",
                item=f"배달 음식 {index + 1}",
                store="배달앱",
                amount=18000,
                date=timezone.now(),
            )

        schedule_coaching_generation_requests(self.user.id)

        mock_ai_client = mock_ai_client_class.return_value
        mock_ai_client.get_advice.return_value = {
            "subject": "행동 변화 제안",
            "title": "배달줄임",
            "coaching_content": "이번 주는 배달을 한 번 줄여보세요.",
            "analysis": "배달 지출이 반복되고 있어요.",
            "generation_reason": "배달 음식 소비를 줄이고 싶다고 입력해 우선 코칭했어요.",
            "estimated_savings": 12000,
            "sources": [],
        }

        result = process_pending_coaching_generation_requests(self.user.id)
        coaching = Coaching.objects.get(user=self.user)

        self.assertEqual(len(result["processed_request_ids"]), 1)
        self.assertEqual(coaching.generation_reason, "배달 음식 소비를 줄이고 싶다고 입력해 우선 코칭했어요.")
        _, kwargs = mock_ai_client.get_advice.call_args
        self.assertEqual(kwargs["user_context"]["spending_to_improve"], "배달 음식")
        mock_delay.assert_called_once_with(self.user.id)

    @patch("apps.coaching.tasks.run_coaching_generation_queue.delay")
    def test_existing_coaching_defines_initial_boundary(self, mock_delay):
        old_transactions = [
            Transaction.objects.create(
                user=self.user,
                category="카페/간식",
                item=f"기존 아메리카노 {index + 1}",
                store="테스트카페",
                amount=4500,
                date=timezone.now(),
            )
            for index in range(3)
        ]
        Coaching.objects.create(
            user=self.user,
            title="기존 코칭",
            subject="행동 변화 제안",
            analysis="기존 분석",
            coaching_content="기존 코칭 내용",
            estimated_savings=4500,
            sources=[],
        )

        for index in range(2):
            Transaction.objects.create(
                user=self.user,
                category="카페/간식",
                item=f"새 아메리카노 {index + 1}",
                store="테스트카페",
                amount=4500,
                date=timezone.now(),
            )

        self.assertEqual(schedule_coaching_generation_requests(self.user.id), [])

        third_new_transaction = Transaction.objects.create(
            user=self.user,
            category="카페/간식",
            item="새 아메리카노 3",
            store="테스트카페",
            amount=4500,
            date=timezone.now(),
        )

        created_request_ids = schedule_coaching_generation_requests(self.user.id)
        generation_request = CoachingGenerationRequest.objects.get(id=created_request_ids[0])

        self.assertEqual(len(created_request_ids), 1)
        self.assertEqual(generation_request.start_after_transaction_id, old_transactions[-1].id)
        self.assertEqual(generation_request.end_transaction_id, third_new_transaction.id)
        mock_delay.assert_called_once_with(self.user.id)


class CoachingChallengeGenerationTests(APITestCase):
    def setUp(self):
        user_model = get_user_model()
        self.user = user_model.objects.create_user(
            username='coach-api-user',
            email='coach-api@example.com',
            password='password123',
        )
        self.client.force_authenticate(user=self.user)
        self.coaching = Coaching.objects.create(
            user=self.user,
            title='커피 줄이기',
            subject='행동 변화 제안',
            analysis='카페 지출이 반복되고 있어요.',
            generation_reason='카페 지출이 반복되어 우선 코칭을 생성했어요.',
            coaching_content='이번 주는 커피를 한 번 덜 사보세요.',
            estimated_savings=4500,
            sources=[],
        )
        self.challenge_payload = {
            'coaching_id': self.coaching.id,
            'name': '카페 줄이기 챌린지',
            'description': '일주일 동안 카페 지출 줄이기',
            'difficulty': 'normal',
            'duration_days': 7,
            'base_points': 100,
            'success_conditions': ['카페 지출 10,000원 이하로 유지하기'],
            'target_amount': 10000,
            'target_categories': ['all'],
            'target_keywords': [],
            'condition_type': 'amount_limit',
        }

    def test_coaching_advice_includes_generated_challenge_flag(self):
        self.coaching.has_generated_challenge = True
        self.coaching.save(update_fields=['has_generated_challenge'])

        response = self.client.get('/api/coaching/advice/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertTrue(response.data[0]['has_generated_challenge'])
        self.assertEqual(response.data[0]['generation_reason'], '카페 지출이 반복되어 우선 코칭을 생성했어요.')

    def test_start_from_coaching_marks_coaching_as_generated(self):
        response = self.client.post('/api/challenges/my/start_from_coaching/', self.challenge_payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.coaching.refresh_from_db()

        self.assertTrue(self.coaching.has_generated_challenge)
        self.assertEqual(UserChallenge.objects.filter(source_coaching=self.coaching).count(), 1)

    def test_start_from_coaching_rejects_duplicate_generation(self):
        first_response = self.client.post('/api/challenges/my/start_from_coaching/', self.challenge_payload, format='json')
        second_response = self.client.post('/api/challenges/my/start_from_coaching/', self.challenge_payload, format='json')

        self.assertEqual(first_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(second_response.data['error'], '이미 챌린지가 생성된 코칭 카드입니다.')

    @patch('apps.challenges.views.AIClient')
    def test_generate_from_coaching_rejects_used_card(self, mock_ai_client_class):
        self.coaching.has_generated_challenge = True
        self.coaching.save(update_fields=['has_generated_challenge'])

        response = self.client.post(
            '/api/challenges/my/generate_from_coaching/',
            {'coaching_id': self.coaching.id, 'difficulty': 'normal'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['error'], '이미 챌린지가 생성된 코칭 카드입니다.')
        mock_ai_client_class.assert_not_called()

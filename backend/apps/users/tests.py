from unittest.mock import Mock, patch

from django.contrib.auth import get_user_model
from django.test import SimpleTestCase, override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from apps.users.models import SocialAccount
from external.ai.client import AIClient

User = get_user_model()


class AIClientGrowthPromptTests(SimpleTestCase):
    def _build_client(self):
        client = AIClient.__new__(AIClient)
        client.client = object()
        client.default_model = 'gemini-test'
        client.model = 'gemini-test'
        client.purpose = 'analysis'
        return client

    def test_growth_prompt_includes_self_development_field(self):
        ai_client = self._build_client()
        captured = {}

        ai_client._get_transactions_summary = (
            lambda user_id, year, month: '- 2026-03-10 | Education | Online lecture | Example | 59000 KRW'
        )

        def fake_parse(prompt, response_model, **kwargs):
            captured['prompt'] = prompt
            return ({'total_growth': 59000, 'reason': 'Growth spending detected.'}, None)

        ai_client._parse = fake_parse

        result = ai_client.analyze_growth_spending(
            1,
            2026,
            3,
            self_development_field='Career growth',
        )

        self.assertEqual(result, 59000)
        self.assertIn('Career growth', captured['prompt'])


class GoogleLoginViewTests(APITestCase):
    @override_settings(
        GOOGLE_OAUTH_ALLOWED_CLIENT_IDS=[
            'local-web.apps.googleusercontent.com',
            'staging-web.apps.googleusercontent.com',
        ]
    )
    @patch('apps.users.oauth_views.requests.get')
    def test_google_login_accepts_any_allowed_client_id(self, mock_get):
        mock_response = Mock()
        mock_response.ok = True
        mock_response.json.return_value = {
            'aud': 'staging-web.apps.googleusercontent.com',
            'email': 'google-user@example.com',
            'sub': 'google-user-123',
            'name': 'Google User',
            'email_verified': 'true',
        }
        mock_get.return_value = mock_response

        response = self.client.post(
            '/api/users/auth/google/',
            {
                'credential': 'valid-id-token',
                'client_id': 'staging-web.apps.googleusercontent.com',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['user']['email'], 'google-user@example.com')
        self.assertTrue(User.objects.filter(email='google-user@example.com').exists())
        self.assertTrue(
            SocialAccount.objects.filter(
                provider=SocialAccount.Provider.GOOGLE,
                provider_user_id='google-user-123',
            ).exists()
        )

    @override_settings(
        GOOGLE_OAUTH_ALLOWED_CLIENT_IDS=['expected-web.apps.googleusercontent.com']
    )
    @patch('apps.users.oauth_views.requests.get')
    def test_google_login_rejects_unexpected_client_id(self, mock_get):
        mock_response = Mock()
        mock_response.ok = True
        mock_response.json.return_value = {
            'aud': 'different-web.apps.googleusercontent.com',
            'email': 'google-user@example.com',
            'sub': 'google-user-123',
            'name': 'Google User',
        }
        mock_get.return_value = mock_response

        response = self.client.post(
            '/api/users/auth/google/',
            {
                'credential': 'valid-id-token',
                'client_id': 'different-web.apps.googleusercontent.com',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn('NEXT_PUBLIC_GOOGLE_CLIENT_ID', response.data['error'])

    @override_settings(
        GOOGLE_OAUTH_ALLOWED_CLIENT_IDS=['expected-web.apps.googleusercontent.com']
    )
    @patch('apps.users.oauth_views.requests.get')
    def test_google_login_links_to_existing_email_user(self, mock_get):
        existing_user = User.objects.create(
            email='shared@example.com',
            username='Existing User',
            auth_provider='email',
        )

        mock_response = Mock()
        mock_response.ok = True
        mock_response.json.return_value = {
            'aud': 'expected-web.apps.googleusercontent.com',
            'email': 'shared@example.com',
            'sub': 'google-linked-123',
            'name': 'Google User',
            'email_verified': 'true',
        }
        mock_get.return_value = mock_response

        response = self.client.post(
            '/api/users/auth/google/',
            {
                'credential': 'valid-id-token',
                'client_id': 'expected-web.apps.googleusercontent.com',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['user']['id'], existing_user.id)
        self.assertTrue(
            SocialAccount.objects.filter(
                user=existing_user,
                provider=SocialAccount.Provider.GOOGLE,
                provider_user_id='google-linked-123',
            ).exists()
        )


class KakaoLoginViewTests(APITestCase):
    @override_settings(
        KAKAO_REST_API_KEY='kakao-rest-key',
        KAKAO_CLIENT_SECRET='kakao-client-secret',
    )
    @patch('apps.users.oauth_views.requests.get')
    @patch('apps.users.oauth_views.requests.post')
    def test_kakao_login_creates_user(self, mock_post, mock_get):
        token_response = Mock()
        token_response.ok = True
        token_response.json.return_value = {
            'access_token': 'kakao-access-token',
        }
        mock_post.return_value = token_response

        profile_response = Mock()
        profile_response.ok = True
        profile_response.json.return_value = {
            'id': 987654321,
            'kakao_account': {
                'email': 'kakao-user@example.com',
                'is_email_valid': True,
                'is_email_verified': True,
                'profile': {
                    'nickname': 'Kakao User',
                },
            },
        }
        mock_get.return_value = profile_response

        response = self.client.post(
            '/api/users/auth/kakao/',
            {
                'code': 'kakao-auth-code',
                'redirect_uri': 'http://localhost:3000/login/callback/kakao',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['user']['email'], 'kakao-user@example.com')
        self.assertTrue(User.objects.filter(email='kakao-user@example.com').exists())
        self.assertTrue(
            SocialAccount.objects.filter(
                provider=SocialAccount.Provider.KAKAO,
                provider_user_id='987654321',
            ).exists()
        )

        request_payload = mock_post.call_args.kwargs['data']
        self.assertEqual(request_payload['client_id'], 'kakao-rest-key')
        self.assertEqual(request_payload['client_secret'], 'kakao-client-secret')
        self.assertEqual(
            request_payload['redirect_uri'],
            'http://localhost:3000/login/callback/kakao',
        )

    @patch('apps.users.oauth_views.requests.get')
    @patch('apps.users.oauth_views.requests.post')
    def test_kakao_login_accepts_access_token_without_code_exchange(self, mock_post, mock_get):
        profile_response = Mock()
        profile_response.ok = True
        profile_response.json.return_value = {
            'id': 987654321,
            'kakao_account': {
                'email': 'kakao-user@example.com',
                'is_email_valid': True,
                'is_email_verified': True,
                'profile': {
                    'nickname': 'Kakao User',
                },
            },
        }
        mock_get.return_value = profile_response

        response = self.client.post(
            '/api/users/auth/kakao/',
            {
                'access_token': 'kakao-access-token',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['user']['email'], 'kakao-user@example.com')
        self.assertTrue(User.objects.filter(email='kakao-user@example.com').exists())
        self.assertTrue(
            SocialAccount.objects.filter(
                provider=SocialAccount.Provider.KAKAO,
                provider_user_id='987654321',
            ).exists()
        )
        mock_post.assert_not_called()
        self.assertEqual(
            mock_get.call_args.kwargs['headers']['Authorization'],
            'Bearer kakao-access-token',
        )

    def test_kakao_login_requires_code_or_access_token(self):
        response = self.client.post(
            '/api/users/auth/kakao/',
            {},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['error_code'], 'SOCIAL_AUTH_INPUT_REQUIRED')

    @override_settings(KAKAO_REST_API_KEY='kakao-rest-key')
    @patch('apps.users.oauth_views.requests.get')
    @patch('apps.users.oauth_views.requests.post')
    def test_kakao_login_links_to_existing_google_user_with_same_email(self, mock_post, mock_get):
        existing_user = User.objects.create(
            email='shared@example.com',
            username='Existing User',
            auth_provider='google',
            social_id='google-user-123',
        )
        SocialAccount.objects.create(
            user=existing_user,
            provider=SocialAccount.Provider.GOOGLE,
            provider_user_id='google-user-123',
            email='shared@example.com',
            email_verified=True,
            display_name='Existing User',
        )

        token_response = Mock()
        token_response.ok = True
        token_response.json.return_value = {
            'access_token': 'kakao-access-token',
        }
        mock_post.return_value = token_response

        profile_response = Mock()
        profile_response.ok = True
        profile_response.json.return_value = {
            'id': 987654321,
            'kakao_account': {
                'email': 'shared@example.com',
                'is_email_valid': True,
                'is_email_verified': True,
                'profile': {
                    'nickname': 'Kakao User',
                },
            },
        }
        mock_get.return_value = profile_response

        response = self.client.post(
            '/api/users/auth/kakao/',
            {
                'code': 'kakao-auth-code',
                'redirect_uri': 'http://localhost:3000/login/callback/kakao',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['user']['id'], existing_user.id)
        self.assertTrue(
            SocialAccount.objects.filter(
                user=existing_user,
                provider=SocialAccount.Provider.KAKAO,
                provider_user_id='987654321',
            ).exists()
        )

    @override_settings(KAKAO_REST_API_KEY='kakao-rest-key')
    @patch('apps.users.oauth_views.requests.get')
    @patch('apps.users.oauth_views.requests.post')
    def test_kakao_login_rejects_second_kakao_account_for_same_user(self, mock_post, mock_get):
        existing_user = User.objects.create(
            email='shared@example.com',
            username='Existing User',
            auth_provider='google',
            social_id='google-user-123',
        )
        SocialAccount.objects.create(
            user=existing_user,
            provider=SocialAccount.Provider.KAKAO,
            provider_user_id='111111',
            email='shared@example.com',
            email_verified=True,
            display_name='Existing User',
        )

        token_response = Mock()
        token_response.ok = True
        token_response.json.return_value = {
            'access_token': 'kakao-access-token',
        }
        mock_post.return_value = token_response

        profile_response = Mock()
        profile_response.ok = True
        profile_response.json.return_value = {
            'id': 987654321,
            'kakao_account': {
                'email': 'shared@example.com',
                'is_email_valid': True,
                'is_email_verified': True,
                'profile': {
                    'nickname': 'Kakao User',
                },
            },
        }
        mock_get.return_value = profile_response

        response = self.client.post(
            '/api/users/auth/kakao/',
            {
                'code': 'kakao-auth-code',
                'redirect_uri': 'http://localhost:3000/login/callback/kakao',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(response.data['error_code'], 'SOCIAL_ACCOUNT_ALREADY_LINKED')

    @override_settings(KAKAO_REST_API_KEY='kakao-rest-key')
    @patch('apps.users.oauth_views.requests.get')
    @patch('apps.users.oauth_views.requests.post')
    def test_kakao_login_requires_verified_email(self, mock_post, mock_get):
        token_response = Mock()
        token_response.ok = True
        token_response.json.return_value = {
            'access_token': 'kakao-access-token',
        }
        mock_post.return_value = token_response

        profile_response = Mock()
        profile_response.ok = True
        profile_response.json.return_value = {
            'id': 987654321,
            'kakao_account': {
                'email': 'kakao-user@example.com',
                'is_email_valid': True,
                'is_email_verified': False,
                'profile': {
                    'nickname': 'Kakao User',
                },
            },
        }
        mock_get.return_value = profile_response

        response = self.client.post(
            '/api/users/auth/kakao/',
            {
                'code': 'kakao-auth-code',
                'redirect_uri': 'http://localhost:3000/login/callback/kakao',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['error_code'], 'SOCIAL_EMAIL_NOT_VERIFIED')

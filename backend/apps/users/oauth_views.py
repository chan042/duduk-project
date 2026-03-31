"""
OAuth login views for Google, Kakao, and Naver.
"""
import logging

import requests
from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import SocialAccount

logger = logging.getLogger(__name__)

User = get_user_model()


class SocialAuthError(Exception):
    def __init__(self, message, *, error_code=None, status_code=status.HTTP_400_BAD_REQUEST):
        super().__init__(message)
        self.message = message
        self.error_code = error_code
        self.status_code = status_code


def _normalize_verified_flag(value, *, default=False):
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.lower() == 'true'
    return bool(value)


def _build_auth_response(user):
    refresh = RefreshToken.for_user(user)
    return {
        'access': str(refresh.access_token),
        'refresh': str(refresh),
        'user': {
            'id': user.id,
            'email': user.email,
            'username': user.username,
            'is_profile_complete': user.is_profile_complete,
        },
    }


def _build_error_response(error):
    payload = {'error': error.message}
    if error.error_code:
        payload['error_code'] = error.error_code
    return Response(payload, status=error.status_code)


def _provider_label(provider):
    return {
        'google': 'Google',
        'kakao': 'Kakao',
        'naver': 'Naver',
    }.get(provider, provider)


def _sync_legacy_user_social_fields(user, provider, provider_user_id):
    updated_fields = []

    if user.auth_provider == 'email':
        user.auth_provider = provider
        updated_fields.append('auth_provider')

    if not user.social_id:
        user.social_id = str(provider_user_id)
        updated_fields.append('social_id')

    if updated_fields:
        user.save(update_fields=updated_fields)


def _upsert_social_account(user, profile):
    provider = profile['provider']
    provider_user_id = str(profile['provider_user_id'])

    linked_account = SocialAccount.objects.filter(
        provider=provider,
        provider_user_id=provider_user_id,
    ).select_related('user').first()
    if linked_account:
        if linked_account.user_id != user.id:
            raise SocialAuthError(
                f'이미 다른 Duduk 계정에 연결된 {_provider_label(provider)} 계정입니다.',
                error_code='SOCIAL_ACCOUNT_ALREADY_LINKED',
                status_code=status.HTTP_409_CONFLICT,
            )
        social_account = linked_account
    else:
        social_account = SocialAccount.objects.filter(user=user, provider=provider).first()
        if social_account and social_account.provider_user_id != provider_user_id:
            raise SocialAuthError(
                f'이미 다른 {_provider_label(provider)} 계정이 연결되어 있습니다.',
                error_code='SOCIAL_ACCOUNT_ALREADY_LINKED',
                status_code=status.HTTP_409_CONFLICT,
            )

        if not social_account:
            social_account = SocialAccount(
                user=user,
                provider=provider,
                provider_user_id=provider_user_id,
            )

    social_account.email = profile.get('email')
    social_account.email_verified = profile.get('email_verified', False)
    social_account.display_name = profile.get('display_name', '')
    social_account.profile_image_url = profile.get('profile_image_url', '')
    social_account.raw_profile = profile.get('raw_profile', {})
    social_account.last_login_at = timezone.now()
    social_account.save()

    _sync_legacy_user_social_fields(user, provider, provider_user_id)
    return social_account


def _resolve_social_user(profile):
    provider = profile['provider']
    provider_user_id = str(profile['provider_user_id'])
    email = profile.get('email')
    display_name = profile.get('display_name')

    if not provider_user_id:
        raise SocialAuthError(
            '소셜 로그인 계정 정보가 없습니다.',
            error_code='SOCIAL_ID_REQUIRED',
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    if not email:
        raise SocialAuthError(
            '이메일 정보를 가져올 수 없습니다.',
            error_code='SOCIAL_EMAIL_REQUIRED',
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    social_account = SocialAccount.objects.filter(
        provider=provider,
        provider_user_id=provider_user_id,
    ).select_related('user').first()
    if social_account:
        social_account.email = email
        social_account.email_verified = profile.get('email_verified', False)
        social_account.display_name = display_name or social_account.display_name
        social_account.profile_image_url = profile.get('profile_image_url', '')
        social_account.raw_profile = profile.get('raw_profile', {})
        social_account.last_login_at = timezone.now()
        social_account.save()

        _sync_legacy_user_social_fields(social_account.user, provider, provider_user_id)
        return social_account.user

    user = User.objects.filter(email=email).first()
    if not user:
        user = User.objects.create(
            email=email,
            username=display_name or email.split('@')[0],
            auth_provider=provider,
            social_id=provider_user_id,
        )
    elif not user.username and display_name:
        user.username = display_name
        user.save(update_fields=['username'])

    _upsert_social_account(user, profile)
    return user


def _build_google_profile(user_info):
    email = user_info.get('email')
    return {
        'provider': SocialAccount.Provider.GOOGLE,
        'provider_user_id': user_info.get('sub'),
        'email': email,
        'email_verified': _normalize_verified_flag(user_info.get('email_verified'), default=True),
        'display_name': user_info.get('name') or (email.split('@')[0] if email else 'google-user'),
        'profile_image_url': user_info.get('picture', ''),
        'raw_profile': user_info,
    }


def _build_kakao_profile(user_info):
    kakao_account = user_info.get('kakao_account') or {}
    profile = kakao_account.get('profile') or {}
    email = kakao_account.get('email')

    return {
        'provider': SocialAccount.Provider.KAKAO,
        'provider_user_id': user_info.get('id'),
        'email': email,
        'email_verified': (
            _normalize_verified_flag(kakao_account.get('is_email_valid'))
            and _normalize_verified_flag(kakao_account.get('is_email_verified'))
        ),
        'display_name': profile.get('nickname') or (email.split('@')[0] if email else 'kakao-user'),
        'profile_image_url': (
            profile.get('profile_image_url')
            or profile.get('thumbnail_image_url')
            or ''
        ),
        'raw_profile': user_info,
    }


def _build_naver_profile(user_info):
    profile = user_info.get('response') or {}
    email = profile.get('email')
    display_name = (
        profile.get('name')
        or profile.get('nickname')
        or (email.split('@')[0] if email else 'naver-user')
    )

    return {
        'provider': SocialAccount.Provider.NAVER,
        'provider_user_id': profile.get('id'),
        'email': email,
        'email_verified': bool(email),
        'display_name': display_name,
        'profile_image_url': profile.get('profile_image', ''),
        'raw_profile': user_info,
    }


def _exchange_kakao_code_for_access_token(code, redirect_uri):
    if not code:
        raise SocialAuthError(
            '인가 코드(code)가 필요합니다.',
            error_code='SOCIAL_CODE_MISSING',
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    if not redirect_uri:
        raise SocialAuthError(
            'redirect_uri가 필요합니다.',
            error_code='SOCIAL_REDIRECT_URI_MISSING',
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    kakao_rest_api_key = getattr(settings, 'KAKAO_REST_API_KEY', None)
    kakao_client_secret = getattr(settings, 'KAKAO_CLIENT_SECRET', None)
    if not kakao_rest_api_key:
        raise SocialAuthError(
            '서버에 KAKAO_REST_API_KEY가 설정되지 않았습니다.',
            error_code='SOCIAL_PROVIDER_NOT_CONFIGURED',
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    token_response = requests.post(
        'https://kauth.kakao.com/oauth/token',
        data={
            'grant_type': 'authorization_code',
            'client_id': kakao_rest_api_key,
            'redirect_uri': redirect_uri,
            'code': code,
            **({'client_secret': kakao_client_secret} if kakao_client_secret else {}),
        },
        headers={
            'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
        },
        timeout=10,
    )

    if not token_response.ok:
        logger.warning(
            'Kakao token exchange failed: status=%s body=%s',
            token_response.status_code,
            token_response.text,
        )
        raise SocialAuthError(
            '카카오 토큰 교환에 실패했습니다.',
            error_code='SOCIAL_TOKEN_EXCHANGE_FAILED',
            status_code=status.HTTP_401_UNAUTHORIZED,
        )

    return token_response.json().get('access_token')


def _fetch_kakao_profile(access_token):
    if not access_token:
        raise SocialAuthError(
            '카카오 액세스 토큰을 받지 못했습니다.',
            error_code='SOCIAL_TOKEN_EXCHANGE_FAILED',
            status_code=status.HTTP_401_UNAUTHORIZED,
        )

    profile_response = requests.get(
        'https://kapi.kakao.com/v2/user/me',
        headers={'Authorization': f'Bearer {access_token}'},
        timeout=10,
    )

    if not profile_response.ok:
        logger.warning(
            'Kakao profile fetch failed: status=%s body=%s',
            profile_response.status_code,
            profile_response.text,
        )
        raise SocialAuthError(
            '카카오 사용자 정보 조회에 실패했습니다.',
            error_code='SOCIAL_PROFILE_FETCH_FAILED',
            status_code=status.HTTP_401_UNAUTHORIZED,
        )

    return _build_kakao_profile(profile_response.json())


def _validate_kakao_profile(profile):
    if not profile['email']:
        raise SocialAuthError(
            '카카오 계정에서 이메일 정보를 가져올 수 없습니다. 동의 항목에서 이메일 제공을 활성화해 주세요.',
            error_code='SOCIAL_EMAIL_REQUIRED',
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    if not profile['email_verified']:
        raise SocialAuthError(
            '카카오 이메일이 유효하지 않거나 인증되지 않았습니다.',
            error_code='SOCIAL_EMAIL_NOT_VERIFIED',
            status_code=status.HTTP_400_BAD_REQUEST,
        )


def _authenticate_kakao(payload):
    access_token = payload.get('access_token')
    code = payload.get('code')
    redirect_uri = payload.get('redirect_uri')

    if not access_token and not code:
        raise SocialAuthError(
            'access_token 또는 code가 필요합니다.',
            error_code='SOCIAL_AUTH_INPUT_REQUIRED',
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    if not access_token:
        access_token = _exchange_kakao_code_for_access_token(code, redirect_uri)

    profile = _fetch_kakao_profile(access_token)
    _validate_kakao_profile(profile)
    return _resolve_social_user(profile)


def _exchange_naver_code_for_access_token(code, state_token):
    if not code:
        raise SocialAuthError(
            '인가 코드(code)가 필요합니다.',
            error_code='SOCIAL_CODE_MISSING',
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    if not state_token:
        raise SocialAuthError(
            'state가 필요합니다.',
            error_code='SOCIAL_STATE_MISSING',
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    client_id = getattr(settings, 'NAVER_CLIENT_ID', None)
    client_secret = getattr(settings, 'NAVER_CLIENT_SECRET', None)
    if not client_id or not client_secret:
        raise SocialAuthError(
            '서버에 NAVER_CLIENT_ID 또는 NAVER_CLIENT_SECRET이 설정되지 않았습니다.',
            error_code='SOCIAL_PROVIDER_NOT_CONFIGURED',
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    token_response = requests.post(
        'https://nid.naver.com/oauth2.0/token',
        params={
            'grant_type': 'authorization_code',
            'client_id': client_id,
            'client_secret': client_secret,
            'code': code,
            'state': state_token,
        },
        timeout=10,
    )

    if not token_response.ok:
        logger.warning(
            'Naver token exchange failed: status=%s body=%s',
            token_response.status_code,
            token_response.text,
        )
        raise SocialAuthError(
            '네이버 토큰 교환에 실패했습니다.',
            error_code='SOCIAL_TOKEN_EXCHANGE_FAILED',
            status_code=status.HTTP_401_UNAUTHORIZED,
        )

    access_token = token_response.json().get('access_token')
    if not access_token:
        logger.warning('Naver token exchange returned no access token: body=%s', token_response.text)
        raise SocialAuthError(
            '네이버 액세스 토큰을 받지 못했습니다.',
            error_code='SOCIAL_TOKEN_EXCHANGE_FAILED',
            status_code=status.HTTP_401_UNAUTHORIZED,
        )

    return access_token


def _fetch_naver_profile(access_token):
    if not access_token:
        raise SocialAuthError(
            '네이버 액세스 토큰을 받지 못했습니다.',
            error_code='SOCIAL_TOKEN_EXCHANGE_FAILED',
            status_code=status.HTTP_401_UNAUTHORIZED,
        )

    profile_response = requests.get(
        'https://openapi.naver.com/v1/nid/me',
        headers={'Authorization': f'Bearer {access_token}'},
        timeout=10,
    )

    if not profile_response.ok:
        logger.warning(
            'Naver profile fetch failed: status=%s body=%s',
            profile_response.status_code,
            profile_response.text,
        )
        raise SocialAuthError(
            '네이버 사용자 정보 조회에 실패했습니다.',
            error_code='SOCIAL_PROFILE_FETCH_FAILED',
            status_code=status.HTTP_401_UNAUTHORIZED,
        )

    profile_payload = profile_response.json()
    if profile_payload.get('resultcode') not in (None, '00'):
        logger.warning(
            'Naver profile fetch returned unexpected result: body=%s',
            profile_response.text,
        )
        raise SocialAuthError(
            '네이버 사용자 정보 조회에 실패했습니다.',
            error_code='SOCIAL_PROFILE_FETCH_FAILED',
            status_code=status.HTTP_401_UNAUTHORIZED,
        )

    return _build_naver_profile(profile_payload)


def _validate_naver_profile(profile):
    if not profile['email']:
        raise SocialAuthError(
            '네이버 계정에서 이메일 정보를 가져올 수 없습니다. 동의 항목에서 이메일 제공을 활성화해 주세요.',
            error_code='SOCIAL_EMAIL_REQUIRED',
            status_code=status.HTTP_400_BAD_REQUEST,
        )


def _authenticate_naver(payload):
    access_token = payload.get('access_token')
    code = payload.get('code')
    state_token = payload.get('state')

    if not access_token and not code:
        raise SocialAuthError(
            'access_token 또는 code가 필요합니다.',
            error_code='SOCIAL_AUTH_INPUT_REQUIRED',
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    if not access_token:
        access_token = _exchange_naver_code_for_access_token(code, state_token)

    profile = _fetch_naver_profile(access_token)
    _validate_naver_profile(profile)
    return _resolve_social_user(profile)


class GoogleLoginView(APIView):
    permission_classes = [permissions.AllowAny]

    @staticmethod
    def _get_allowed_google_client_ids():
        return list(getattr(settings, 'GOOGLE_OAUTH_ALLOWED_CLIENT_IDS', []) or [])

    def post(self, request):
        access_token = request.data.get('access_token')
        credential = request.data.get('credential')
        request_client_id = request.data.get('client_id')

        if not access_token and not credential:
            return Response(
                {'error': 'access_token 또는 credential이 필요합니다.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            if credential:
                response = requests.get(
                    'https://oauth2.googleapis.com/tokeninfo',
                    params={'id_token': credential},
                    timeout=10,
                )

                if not response.ok:
                    return Response(
                        {'error': '유효하지 않은 Google credential입니다.'},
                        status=status.HTTP_401_UNAUTHORIZED,
                    )

                user_info = response.json()
                allowed_client_ids = self._get_allowed_google_client_ids()
                token_audience = user_info.get('aud')

                if allowed_client_ids and token_audience not in allowed_client_ids:
                    logger.warning(
                        'Rejected Google credential due to client ID mismatch. aud=%s requested_client_id=%s allowed_client_ids=%s',
                        token_audience,
                        request_client_id,
                        allowed_client_ids,
                    )
                    return Response(
                        {
                            'error': (
                                'Google credential의 클라이언트 ID가 서버 설정과 일치하지 않습니다. '
                                '프론트엔드의 NEXT_PUBLIC_GOOGLE_CLIENT_ID와 백엔드의 '
                                'GOOGLE_OAUTH_CLIENT_ID 또는 GOOGLE_OAUTH_ALLOWED_CLIENT_IDS를 '
                                '같은 Google OAuth 프로젝트 값으로 맞춰 주세요.'
                            )
                        },
                        status=status.HTTP_401_UNAUTHORIZED,
                    )

                if request_client_id and token_audience and request_client_id != token_audience:
                    logger.warning(
                        'Google credential client ID mismatch between request payload and token audience. aud=%s requested_client_id=%s',
                        token_audience,
                        request_client_id,
                    )
            else:
                response = requests.get(
                    'https://www.googleapis.com/oauth2/v3/userinfo',
                    params={'access_token': access_token},
                    timeout=10,
                )

                if not response.ok:
                    return Response(
                        {'error': '유효하지 않은 Google 토큰입니다.'},
                        status=status.HTTP_401_UNAUTHORIZED,
                    )

                user_info = response.json()

            user = _resolve_social_user(_build_google_profile(user_info))
            return Response(_build_auth_response(user), status=status.HTTP_200_OK)
        except SocialAuthError as error:
            return _build_error_response(error)
        except Exception as exc:
            logger.exception('Google login failed')
            return Response(
                {'error': f'로그인 처리 중 오류가 발생했습니다: {exc}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class KakaoLoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        try:
            user = _authenticate_kakao(request.data)
            return Response(_build_auth_response(user), status=status.HTTP_200_OK)
        except SocialAuthError as error:
            return _build_error_response(error)
        except requests.RequestException:
            logger.exception('Kakao provider request failed')
            return Response(
                {
                    'error': '카카오 로그인 서버와 통신 중 오류가 발생했습니다.',
                    'error_code': 'SOCIAL_PROVIDER_REQUEST_FAILED',
                },
                status=status.HTTP_502_BAD_GATEWAY,
            )
        except Exception as exc:
            logger.exception('Kakao login failed')
            return Response(
                {'error': f'로그인 처리 중 오류가 발생했습니다: {exc}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class NaverLoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        try:
            user = _authenticate_naver(request.data)
            return Response(_build_auth_response(user), status=status.HTTP_200_OK)
        except SocialAuthError as error:
            return _build_error_response(error)
        except requests.RequestException:
            logger.exception('Naver provider request failed')
            return Response(
                {
                    'error': '네이버 로그인 서버와 통신 중 오류가 발생했습니다.',
                    'error_code': 'SOCIAL_PROVIDER_REQUEST_FAILED',
                },
                status=status.HTTP_502_BAD_GATEWAY,
            )
        except Exception as exc:
            logger.exception('Naver login failed')
            return Response(
                {'error': f'로그인 처리 중 오류가 발생했습니다: {exc}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

import { getSocialCallbackProviderConfig } from './socialCallbackProviders';

const SOCIAL_LOGIN_START_CONFIGS = {
    kakao: {
        authorizeUrl: 'https://kauth.kakao.com/oauth/authorize',
        buildAuthorizeParams({ clientId, redirectUri, state }) {
            return {
                client_id: clientId,
                redirect_uri: redirectUri,
                response_type: 'code',
                state,
            };
        },
    },
};

function createOAuthState() {
    if (typeof window !== 'undefined' && window.crypto?.randomUUID) {
        return window.crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function compactQueryParams(params) {
    return Object.fromEntries(
        Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''),
    );
}

export function startSocialLogin(provider, { clientId }) {
    if (typeof window === 'undefined') {
        return false;
    }

    const callbackConfig = getSocialCallbackProviderConfig(provider);
    const loginStartConfig = SOCIAL_LOGIN_START_CONFIGS[provider];

    if (!callbackConfig || !loginStartConfig) {
        throw new Error(`Unsupported social login provider: ${provider}`);
    }

    const redirectUri = callbackConfig.buildRedirectUri(window.location.origin, provider);
    const state = callbackConfig.usesState ? createOAuthState() : null;
    const authorizeParams = compactQueryParams(
        loginStartConfig.buildAuthorizeParams({
            clientId,
            redirectUri,
            state,
        }),
    );

    if (state) {
        sessionStorage.setItem(`oauth_state_${provider}`, state);
    }

    const authorizeUrl = new URL(loginStartConfig.authorizeUrl);
    authorizeUrl.search = new URLSearchParams(authorizeParams).toString();
    window.location.assign(authorizeUrl.toString());
    return true;
}

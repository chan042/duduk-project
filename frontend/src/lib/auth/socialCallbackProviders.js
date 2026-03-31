const KAKAO_LABEL = '\uce74\uce74\uc624';
const KAKAO_CANCELLED_MESSAGE =
    '\uce74\uce74\uc624 \ub85c\uadf8\uc778\uc774 \ucde8\uc18c\ub418\uc5c8\uac70\ub098 \uad8c\ud55c \ub3d9\uc758\uac00 \uc644\ub8cc\ub418\uc9c0 \uc54a\uc558\uc2b5\ub2c8\ub2e4.';
const KAKAO_MISSING_CODE_MESSAGE =
    '\uc778\uac00 \ucf54\ub4dc\uac00 \uc5c6\uc2b5\ub2c8\ub2e4. \ub2e4\uc2dc \ub85c\uadf8\uc778\ud574 \uc8fc\uc138\uc694.';

export const SOCIAL_CALLBACK_PROVIDERS = {
    kakao: {
        label: KAKAO_LABEL,
        usesState: true,
        buildRedirectUri(origin, provider) {
            return `${origin}/login/callback/${provider}`;
        },
        buildPayload({ searchParams, origin, provider }) {
            return {
                code: searchParams.get('code'),
                state: searchParams.get('state'),
                redirect_uri: this.buildRedirectUri(origin, provider),
            };
        },
        getCancelledMessage() {
            return KAKAO_CANCELLED_MESSAGE;
        },
        getMissingCodeMessage() {
            return KAKAO_MISSING_CODE_MESSAGE;
        },
    },
};

export const SOCIAL_CALLBACK_PROVIDER_NAMES = Object.keys(SOCIAL_CALLBACK_PROVIDERS);

export function getSocialCallbackProviderConfig(provider) {
    return SOCIAL_CALLBACK_PROVIDERS[provider] ?? null;
}

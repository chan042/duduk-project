"use client";

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getSocialCallbackProviderConfig } from '@/lib/auth/socialCallbackProviders';

const UNSUPPORTED_PROVIDER_MESSAGE = '\uc9c0\uc6d0\ud558\uc9c0 \uc54a\ub294 \ub85c\uadf8\uc778 \ubc29\uc2dd\uc785\ub2c8\ub2e4.';
const BROWSER_ENVIRONMENT_MESSAGE = '\ube0c\ub77c\uc6b0\uc800 \ud658\uacbd\uc744 \ud655\uc778\ud560 \uc218 \uc5c6\uc2b5\ub2c8\ub2e4.';
const OAUTH_STATE_MISMATCH_MESSAGE =
    '\ub85c\uadf8\uc778 \uc0c1\ud0dc \uac80\uc99d\uc5d0 \uc2e4\ud328\ud588\uc2b5\ub2c8\ub2e4. \ub2e4\uc2dc \uc2dc\ub3c4\ud574 \uc8fc\uc138\uc694.';
const CALLBACK_PROCESSING_TITLE = '\ub85c\uadf8\uc778 \ucc98\ub9ac \uc911\uc785\ub2c8\ub2e4';
const CALLBACK_ERROR_TITLE = '\ub85c\uadf8\uc778\uc744 \uc644\ub8cc\ud558\uc9c0 \ubabb\ud588\uc2b5\ub2c8\ub2e4';
const CALLBACK_PROCESSING_DESCRIPTION =
    '\uc778\uc99d \uc815\ubcf4\ub97c \ud655\uc778\ud558\uace0 Duduk \uacc4\uc815\uc5d0 \uc5f0\uacb0\ud558\uace0 \uc788\uc2b5\ub2c8\ub2e4.';
const BACK_TO_LOGIN_LABEL = '\ub85c\uadf8\uc778 \ud654\uba74\uc73c\ub85c \ub3cc\uc544\uac00\uae30';

function getErrorMessage(error, providerLabel) {
    if (error?.response?.data?.error) {
        return error.response.data.error;
    }

    if (error?.message) {
        return error.message;
    }

    return `${providerLabel} \ub85c\uadf8\uc778 \ucc98\ub9ac \uc911 \uc624\ub958\uac00 \ubc1c\uc0dd\ud588\uc2b5\ub2c8\ub2e4.`;
}

function verifyOAuthState(provider, returnedState) {
    const stateStorageKey = `oauth_state_${provider}`;
    const storedState = sessionStorage.getItem(stateStorageKey);
    sessionStorage.removeItem(stateStorageKey);
    return Boolean(returnedState && storedState && returnedState === storedState);
}

export default function SocialLoginCallbackPage({ provider }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { loginWithKakao, loginWithNaver } = useAuth();

    const providerConfig = getSocialCallbackProviderConfig(provider);
    const providerLabel = providerConfig?.label ?? provider;
    const providerError = searchParams.get('error');
    const providerErrorDescription = searchParams.get('error_description');

    const [status, setStatus] = useState('loading');
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        let isMounted = true;

        const loginHandlers = {
            kakao: loginWithKakao,
            naver: loginWithNaver,
        };

        const finishWithError = (message) => {
            if (!isMounted) {
                return;
            }

            setErrorMessage(message);
            setStatus('error');
        };

        const handleCallback = async () => {
            if (!providerConfig) {
                finishWithError(UNSUPPORTED_PROVIDER_MESSAGE);
                return;
            }

            const loginHandler = loginHandlers[provider];
            if (!loginHandler) {
                finishWithError(UNSUPPORTED_PROVIDER_MESSAGE);
                return;
            }

            if (providerError) {
                finishWithError(
                    providerErrorDescription
                        ? decodeURIComponent(providerErrorDescription)
                        : providerConfig.getCancelledMessage(),
                );
                return;
            }

            if (typeof window === 'undefined') {
                finishWithError(BROWSER_ENVIRONMENT_MESSAGE);
                return;
            }

            const payload = providerConfig.buildPayload({
                searchParams,
                origin: window.location.origin,
                provider,
            });

            if (!payload.code) {
                finishWithError(providerConfig.getMissingCodeMessage());
                return;
            }

            if (providerConfig.usesState && !verifyOAuthState(provider, payload.state)) {
                finishWithError(OAUTH_STATE_MISMATCH_MESSAGE);
                return;
            }

            try {
                await loginHandler(payload);

                if (isMounted) {
                    setStatus('success');
                }
            } catch (error) {
                finishWithError(getErrorMessage(error, providerLabel));
            }
        };

        handleCallback();

        return () => {
            isMounted = false;
        };
    }, [
        loginWithKakao,
        loginWithNaver,
        provider,
        providerConfig,
        providerError,
        providerErrorDescription,
        providerLabel,
        searchParams,
    ]);

    return (
        <div style={styles.container}>
            <div style={styles.card}>
                <p style={styles.badge}>{providerLabel} {'\ub85c\uadf8\uc778'}</p>
                <h1 style={styles.title}>
                    {status === 'error' ? CALLBACK_ERROR_TITLE : CALLBACK_PROCESSING_TITLE}
                </h1>
                <p style={styles.description}>
                    {status === 'error' ? errorMessage : CALLBACK_PROCESSING_DESCRIPTION}
                </p>

                {status !== 'error' && <div style={styles.loader} />}

                {status === 'error' && (
                    <button type="button" style={styles.button} onClick={() => router.push('/login')}>
                        {BACK_TO_LOGIN_LABEL}
                    </button>
                )}
            </div>
        </div>
    );
}

const styles = {
    container: {
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        background:
            'radial-gradient(circle at top, rgba(254, 229, 0, 0.18), transparent 35%), #F8FAFC',
    },
    card: {
        width: '100%',
        maxWidth: '420px',
        padding: '2rem',
        borderRadius: '24px',
        backgroundColor: '#FFFFFF',
        boxShadow: '0 24px 60px rgba(15, 23, 42, 0.12)',
        textAlign: 'center',
    },
    badge: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0.4rem 0.75rem',
        borderRadius: '999px',
        backgroundColor: '#FEF3C7',
        color: '#92400E',
        fontSize: '0.875rem',
        fontWeight: '700',
        marginBottom: '1rem',
    },
    title: {
        fontSize: '1.75rem',
        fontWeight: '800',
        color: '#0F172A',
        marginBottom: '0.75rem',
    },
    description: {
        color: '#475569',
        lineHeight: 1.7,
        marginBottom: '1.5rem',
        whiteSpace: 'pre-wrap',
    },
    loader: {
        width: '2.5rem',
        height: '2.5rem',
        margin: '0 auto',
        borderRadius: '999px',
        border: '4px solid rgba(15, 23, 42, 0.08)',
        borderTopColor: '#F59E0B',
        animation: 'spin 0.8s linear infinite',
    },
    button: {
        width: '100%',
        minHeight: '3rem',
        border: 'none',
        borderRadius: '14px',
        backgroundColor: '#111827',
        color: '#FFFFFF',
        fontWeight: '700',
        cursor: 'pointer',
    },
};

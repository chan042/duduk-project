"use client";

import { startSocialLogin } from '@/lib/auth/socialLoginStart';

const SOCIAL_BUTTON_MAX_WIDTH = 360;
const KAKAO_LABEL = '\uce74\uce74\uc624\ub85c \uacc4\uc18d\ud558\uae30';
const KAKAO_LOGIN_ALT = '\uce74\uce74\uc624 \ub85c\uadf8\uc778';
const KAKAO_MISSING_CONFIG = '\uce74\uce74\uc624 OAuth \uc124\uc815\uc774 \ud544\uc694\ud569\ub2c8\ub2e4.';
const KAKAO_MISSING_CONFIG_HELP =
    'NEXT_PUBLIC_KAKAO_REST_API_KEY\ub97c \ud504\ub860\ud2b8 \ud658\uacbd\ubcc0\uc218\uc5d0 \ucd94\uac00\ud574\uc8fc\uc138\uc694.';
const BUTTON_HEIGHT = 40;

function KakaoSymbol() {
    return (
        <svg
            width="18"
            height="18"
            viewBox="0 0 18 18"
            aria-hidden="true"
            focusable="false"
            style={styles.icon}
        >
            <path
                d="M9 2C5.13 2 2 4.6 2 7.8C2 9.84 3.35 11.63 5.38 12.61L4.46 15.72C4.41 15.9 4.59 16.04 4.75 15.97L8.25 14.28C8.5 14.31 8.75 14.32 9 14.32C12.87 14.32 16 11.72 16 8.52C16 5.32 12.87 2 9 2Z"
                fill="#191919"
            />
        </svg>
    );
}

export default function KakaoLoginButton() {
    const restApiKey = process.env.NEXT_PUBLIC_KAKAO_REST_API_KEY;

    if (!restApiKey || restApiKey.includes('your-kakao-rest')) {
        return (
            <div style={styles.errorContainer}>
                <p style={styles.errorText}>{KAKAO_MISSING_CONFIG}</p>
                <p style={styles.errorSubtext}>{KAKAO_MISSING_CONFIG_HELP}</p>
            </div>
        );
    }

    const handleLogin = () => {
        startSocialLogin('kakao', {
            clientId: restApiKey,
        });
    };

    return (
        <div style={styles.buttonWrapper}>
            <button
                type="button"
                onClick={handleLogin}
                style={styles.button}
                aria-label={KAKAO_LOGIN_ALT}
            >
                <KakaoSymbol />
                <span style={styles.label}>{KAKAO_LABEL}</span>
            </button>
        </div>
    );
}

const styles = {
    buttonWrapper: {
        width: '100%',
        maxWidth: `${SOCIAL_BUTTON_MAX_WIDTH}px`,
        margin: '0 auto',
        minHeight: `${BUTTON_HEIGHT}px`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    button: {
        width: '100%',
        minHeight: `${BUTTON_HEIGHT}px`,
        padding: '0 1rem',
        border: 'none',
        borderRadius: '999px',
        backgroundColor: '#FEE500',
        color: 'rgba(0, 0, 0, 0.85)',
        fontSize: '14px',
        fontWeight: '500',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px',
        cursor: 'pointer',
        boxShadow: '0 1px 2px rgba(60, 64, 67, 0.16)',
    },
    icon: {
        width: '18px',
        height: '18px',
        display: 'block',
        flexShrink: 0,
    },
    label: {
        lineHeight: 1,
        letterSpacing: '-0.01em',
        whiteSpace: 'nowrap',
        color: 'rgba(0, 0, 0, 0.85)',
    },
    errorContainer: {
        padding: '1.5rem',
        backgroundColor: '#FFF7D6',
        borderRadius: 'var(--radius-md)',
        border: '1px solid #F7D54A',
        textAlign: 'center',
    },
    errorText: {
        color: '#7A5D00',
        fontWeight: '700',
        marginBottom: '0.5rem',
    },
    errorSubtext: {
        color: '#8A6F14',
        fontSize: '0.875rem',
        lineHeight: '1.5',
    },
};

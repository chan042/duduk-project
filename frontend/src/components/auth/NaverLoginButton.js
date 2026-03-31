"use client";

import { startSocialLogin } from '@/lib/auth/socialLoginStart';

const SOCIAL_BUTTON_MAX_WIDTH = 360;
const NAVER_LABEL = '\ub124\uc774\ubc84\ub85c \uacc4\uc18d\ud558\uae30';
const NAVER_LOGIN_ALT = '\ub124\uc774\ubc84 \ub85c\uadf8\uc778';
const NAVER_MISSING_CONFIG = '\ub124\uc774\ubc84 OAuth \uc124\uc815\uc774 \ud544\uc694\ud569\ub2c8\ub2e4.';
const NAVER_MISSING_CONFIG_HELP =
    'NEXT_PUBLIC_NAVER_CLIENT_ID\ub97c \ud504\ub860\ud2b8 \ud658\uacbd\ubcc0\uc218\uc5d0 \ucd94\uac00\ud574\uc8fc\uc138\uc694.';
const BUTTON_HEIGHT = 40;

function NaverSymbol() {
    return (
        <span style={styles.iconBadge} aria-hidden="true">
            N
        </span>
    );
}

export default function NaverLoginButton() {
    const clientId = process.env.NEXT_PUBLIC_NAVER_CLIENT_ID;

    if (!clientId || clientId.includes('your-naver-client-id')) {
        return (
            <div style={styles.errorContainer}>
                <p style={styles.errorText}>{NAVER_MISSING_CONFIG}</p>
                <p style={styles.errorSubtext}>{NAVER_MISSING_CONFIG_HELP}</p>
            </div>
        );
    }

    const handleLogin = () => {
        startSocialLogin('naver', {
            clientId,
        });
    };

    return (
        <div style={styles.buttonWrapper}>
            <button
                type="button"
                onClick={handleLogin}
                style={styles.button}
                aria-label={NAVER_LOGIN_ALT}
            >
                <NaverSymbol />
                <span style={styles.label}>{NAVER_LABEL}</span>
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
        backgroundColor: '#03C75A',
        color: '#FFFFFF',
        fontSize: '14px',
        fontWeight: '700',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px',
        cursor: 'pointer',
        boxShadow: '0 1px 2px rgba(60, 64, 67, 0.16)',
    },
    iconBadge: {
        width: '18px',
        height: '18px',
        borderRadius: '4px',
        backgroundColor: '#FFFFFF',
        color: '#03C75A',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '12px',
        fontWeight: '800',
        lineHeight: 1,
        flexShrink: 0,
    },
    label: {
        lineHeight: 1,
        letterSpacing: '-0.01em',
        whiteSpace: 'nowrap',
        color: '#FFFFFF',
    },
    errorContainer: {
        padding: '1.5rem',
        backgroundColor: '#ECFDF3',
        borderRadius: 'var(--radius-md)',
        border: '1px solid #86EFAC',
        textAlign: 'center',
    },
    errorText: {
        color: '#166534',
        fontWeight: '700',
        marginBottom: '0.5rem',
    },
    errorSubtext: {
        color: '#15803D',
        fontSize: '0.875rem',
        lineHeight: '1.5',
    },
};

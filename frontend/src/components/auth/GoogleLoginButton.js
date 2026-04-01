"use client";

import { useEffect, useRef, useState } from 'react';
import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google';
import { useAuth } from '@/contexts/AuthContext';

const SOCIAL_BUTTON_MAX_WIDTH = 360;

function GoogleLoginButtonContent() {
    const { loginWithGoogle, startNativeGoogleLogin, isNativeApp } = useAuth();
    const wrapperRef = useRef(null);
    const [buttonWidth, setButtonWidth] = useState(SOCIAL_BUTTON_MAX_WIDTH);

    useEffect(() => {
        if (isNativeApp) {
            return undefined;
        }

        const updateButtonWidth = () => {
            if (!wrapperRef.current) {
                return;
            }

            const nextWidth = Math.min(
                Math.max(Math.floor(wrapperRef.current.clientWidth), 280),
                SOCIAL_BUTTON_MAX_WIDTH,
            );
            setButtonWidth(nextWidth);
        };

        updateButtonWidth();

        if (typeof ResizeObserver === 'undefined' || !wrapperRef.current) {
            return undefined;
        }

        const observer = new ResizeObserver(updateButtonWidth);
        observer.observe(wrapperRef.current);

        return () => observer.disconnect();
    }, [isNativeApp]);

    if (isNativeApp) {
        return (
            <div style={styles.buttonWrapper}>
                <button
                    type="button"
                    style={styles.nativeButton}
                    onClick={async () => {
                        try {
                            await startNativeGoogleLogin();
                        } catch (error) {
                            console.error('네이티브 Google 로그인 시작 실패:', error);
                            alert('Google 로그인에 실패했습니다. 다시 시도해주세요.');
                        }
                    }}
                >
                    Google로 계속하기
                </button>
            </div>
        );
    }

    return (
        <div ref={wrapperRef} style={styles.buttonWrapper}>
            <GoogleLogin
                theme="outline"
                size="large"
                text="continue_with"
                shape="pill"
                width={String(buttonWidth)}
                onSuccess={async (credentialResponse) => {
                    try {
                        if (!credentialResponse.credential) {
                            throw new Error('Google credential이 없습니다.');
                        }

                        await loginWithGoogle({
                            credential: credentialResponse.credential,
                            client_id: credentialResponse.clientId,
                        });
                    } catch (error) {
                        console.error('Google 로그인 처리 중 오류:', error);
                        alert('Google 로그인에 실패했습니다. 다시 시도해주세요.');
                    }
                }}
                onError={() => {
                    console.error('Google 로그인 실패');
                    alert('Google 로그인에 실패했습니다. 다시 시도해주세요.');
                }}
            />
        </div>
    );
}

export default function GoogleLoginButton() {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

    if (!clientId || clientId.includes('your-google-client-id')) {
        return (
            <div style={styles.errorContainer}>
                <p style={styles.errorText}>
                    Google OAuth 설정이 필요합니다.
                </p>
                <p style={styles.errorSubtext}>
                    .env 파일에 NEXT_PUBLIC_GOOGLE_CLIENT_ID를 설정해주세요.
                </p>
            </div>
        );
    }

    return (
        <GoogleOAuthProvider clientId={clientId}>
            <GoogleLoginButtonContent />
        </GoogleOAuthProvider>
    );
}

const styles = {
    buttonWrapper: {
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        maxWidth: `${SOCIAL_BUTTON_MAX_WIDTH}px`,
        margin: '0 auto',
        minHeight: '44px',
    },
    nativeButton: {
        width: '100%',
        maxWidth: '360px',
        height: '44px',
        borderRadius: '999px',
        border: '1px solid #D1D5DB',
        backgroundColor: '#FFFFFF',
        color: '#111827',
        fontSize: '0.95rem',
        fontWeight: '600',
        cursor: 'pointer',
    },
    errorContainer: {
        padding: '1.5rem',
        backgroundColor: '#FEF2F2',
        borderRadius: 'var(--radius-md)',
        border: '1px solid #FCA5A5',
        textAlign: 'center',
    },
    errorText: {
        color: '#DC2626',
        fontWeight: '600',
        marginBottom: '0.5rem',
    },
    errorSubtext: {
        color: '#991B1B',
        fontSize: '0.875rem',
    },
};

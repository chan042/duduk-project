"use client";

import { useMemo, useState } from 'react';
import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google';
import { loginWithGoogle } from '@/lib/api/auth';

function getAppCallbackURL() {
    if (typeof window === 'undefined') {
        return 'duduk://auth/google';
    }

    const searchParams = new URLSearchParams(window.location.search);
    return searchParams.get('app_callback') || 'duduk://auth/google';
}

function MobileGoogleAuthContent() {
    const [statusText, setStatusText] = useState('Google 로그인을 진행해주세요.');
    const callbackURL = useMemo(() => getAppCallbackURL(), []);

    const handleSuccess = async (credentialResponse) => {
        try {
            if (!credentialResponse.credential) {
                throw new Error('Google credential이 없습니다.');
            }

            setStatusText('로그인 정보를 확인하는 중입니다...');

            const data = await loginWithGoogle({
                credential: credentialResponse.credential,
                client_id: credentialResponse.clientId,
            });

            const nextURL = new URL(callbackURL);
            nextURL.searchParams.set('access', data.access);
            nextURL.searchParams.set('refresh', data.refresh);

            setStatusText('앱으로 돌아가는 중입니다...');
            window.location.replace(nextURL.toString());
        } catch (error) {
            console.error('모바일 Google 로그인 브리지 실패:', error);
            setStatusText('로그인 처리 중 오류가 발생했습니다. 다시 시도해주세요.');
        }
    };

    return (
        <main style={styles.container}>
            <div style={styles.card}>
                <h1 style={styles.title}>Duduk 앱 로그인</h1>
                <p style={styles.description}>
                    이 화면에서 Google 로그인을 완료하면 Duduk 앱으로 다시 돌아갑니다.
                </p>
                <div style={styles.buttonWrapper}>
                    <GoogleLogin
                        theme="outline"
                        size="large"
                        text="continue_with"
                        shape="pill"
                        width="320"
                        onSuccess={handleSuccess}
                        onError={() => {
                            console.error('모바일 Google 로그인 브리지 실패');
                            setStatusText('Google 로그인에 실패했습니다. 다시 시도해주세요.');
                        }}
                    />
                </div>
                <p style={styles.status}>{statusText}</p>
            </div>
        </main>
    );
}

export default function MobileGoogleAuthPage() {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

    if (!clientId || clientId.includes('your-google-client-id')) {
        return (
            <main style={styles.container}>
                <div style={styles.card}>
                    <h1 style={styles.title}>Google OAuth 설정 오류</h1>
                    <p style={styles.status}>NEXT_PUBLIC_GOOGLE_CLIENT_ID를 확인해주세요.</p>
                </div>
            </main>
        );
    }

    return (
        <GoogleOAuthProvider clientId={clientId}>
            <MobileGoogleAuthContent />
        </GoogleOAuthProvider>
    );
}

const styles = {
    container: {
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(180deg, #F8FAFC 0%, #EEF2FF 100%)',
        padding: '2rem',
        fontFamily: 'var(--font-pretendard)',
    },
    card: {
        width: '100%',
        maxWidth: '420px',
        backgroundColor: '#FFFFFF',
        borderRadius: '24px',
        padding: '2rem',
        boxShadow: '0 20px 40px rgba(15, 23, 42, 0.10)',
        textAlign: 'center',
    },
    title: {
        fontSize: '1.75rem',
        fontWeight: '800',
        color: '#0F172A',
        marginBottom: '0.75rem',
    },
    description: {
        color: '#475569',
        fontSize: '0.95rem',
        lineHeight: 1.6,
        marginBottom: '1.5rem',
    },
    buttonWrapper: {
        display: 'flex',
        justifyContent: 'center',
        marginBottom: '1rem',
    },
    status: {
        color: '#64748B',
        fontSize: '0.9rem',
        lineHeight: 1.5,
    },
};

"use client";

/**
 * [파일 역할]
 * - Google OAuth 로그인 버튼 컴포넌트를 제공합니다.
 * - Google ID 토큰을 백엔드로 전송하여 JWT 토큰을 받습니다.
 */
import { useState } from 'react';
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google';
import { useAuth } from '@/contexts/AuthContext';
import Image from 'next/image';

function GoogleLoginButtonContent() {
    const { loginWithGoogle } = useAuth();
    const [isHovered, setIsHovered] = useState(false);
    const [isActive, setIsActive] = useState(false);

    const login = useGoogleLogin({
        onSuccess: async (tokenResponse) => {
            try {
                await loginWithGoogle(tokenResponse.access_token);
            } catch (error) {
                console.error('Google 로그인 처리 중 오류:', error);
            }
        },
        onError: () => {
            console.error('Google 로그인 실패');
            alert('Google 로그인에 실패했습니다. 다시 시도해주세요.');
        },
    });

    return (
        <button
            onClick={() => login()}
            style={{ ...styles.button, ...(isHovered ? styles.buttonHover : {}), ...(isActive ? styles.buttonActive : {}) }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onMouseDown={() => setIsActive(true)}
            onMouseUp={() => setIsActive(false)}
        >
            <div style={styles.iconWrapper}>
                <svg width="20" height="20" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                    <path fill="none" d="M0 0h48v48H0z" />
                </svg>
            </div>
            <span style={styles.buttonText}>Google로 시작하기</span>
        </button>
    );
}

export default function GoogleLoginButton() {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

    if (!clientId || clientId.includes('your-google-client-id')) {
        return (
            <div style={styles.errorContainer}>
                <p style={styles.errorText}>
                    ⚠️ Google OAuth 설정이 필요합니다.
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
    button: {
        width: '100%',
        height: '54px', // Slightly taller for better touch target
        backgroundColor: '#FFFFFF',
        border: '1px solid #E2E8F0',
        borderRadius: '16px', // More rounded corners
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        position: 'relative',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.02)',
    },
    buttonHover: {
        backgroundColor: '#F8FAFC',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
        transform: 'translateY(-1px)',
    },
    buttonActive: {
        transform: 'scale(0.98) translateY(0)',
        backgroundColor: '#F1F5F9',
    },
    iconWrapper: {
        position: 'absolute',
        left: '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonText: {
        fontSize: '16px',
        fontWeight: '600', // Slightly bolder
        color: '#1E293B',
        letterSpacing: '-0.01em',
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

"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import GoogleLoginButton from '@/components/auth/GoogleLoginButton';
import KakaoLoginButton from '@/components/auth/KakaoLoginButton';
import NaverLoginButton from '@/components/auth/NaverLoginButton';

export default function LoginPage() {
    const [text, setText] = useState('');
    const fullText = 'Duduk 시작하기';

    useEffect(() => {
        let index = 0;
        const intervalId = setInterval(() => {
            if (index < fullText.length) {
                setText(fullText.slice(0, index + 1));
                index += 1;
                return;
            }

            clearInterval(intervalId);
        }, 150);

        return () => clearInterval(intervalId);
    }, []);

    const renderText = () => {
        const brand = 'Duduk';
        if (text.length <= brand.length) {
            return <span style={styles.titleMint}>{text}</span>;
        }

        return (
            <>
                <span style={styles.titleMint}>{brand}</span>
                <span style={{ whiteSpace: 'pre' }}>{text.slice(brand.length)}</span>
            </>
        );
    };

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <h1 style={styles.titleWrapper}>
                    <span style={styles.title}>
                        {renderText()}
                        <span style={styles.cursor} />
                    </span>
                </h1>
            </div>

            <div style={styles.bottomSection}>
                <div style={styles.buttonContainer}>
                    <KakaoLoginButton />
                    <NaverLoginButton />
                    <GoogleLoginButton />
                </div>

                <div style={styles.footer}>
                    <p style={styles.notice}>
                        로그인하면 Duduk의{' '}
                        <Link href="/terms" style={styles.link}>이용약관</Link>
                        {' '}및{' '}
                        <Link href="/privacy" style={styles.link}>개인정보처리방침</Link>
                        {' '}동의 후 로그인할 수 있습니다.
                    </p>
                </div>
            </div>
        </div>
    );
}

const styles = {
    container: {
        minHeight: '100dvh',
        backgroundColor: '#FFFFFF',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: 'var(--safe-area-top) 2rem 0',
        width: '100%',
        maxWidth: '430px',
        margin: '0 auto',
        paddingTop: 'max(1rem, env(safe-area-inset-top))',
        paddingRight: 'clamp(1rem, 5vw, 2rem)',
        paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
        paddingLeft: 'clamp(1rem, 5vw, 2rem)',
        fontFamily: 'var(--font-pretendard)',
    },
    header: {
        width: '100%',
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 'clamp(3rem, 14vh, 7rem)',
        paddingBottom: 'clamp(2rem, 8vh, 4rem)',
    },
    titleWrapper: {
        display: 'inline-block',
        minHeight: '3rem',
    },
    title: {
        fontSize: 'clamp(2rem, 9vw, 2.5rem)',
        fontWeight: '800',
        color: '#1E293B',
        lineHeight: '1.2',
        textAlign: 'center',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    titleMint: {
        color: '#14B8A6',
    },
    cursor: {
        display: 'inline-block',
        width: '4px',
        height: 'clamp(1.95rem, 8vw, 2.4rem)',
        backgroundColor: '#14B8A6',
        animation: 'blink-caret .75s step-end infinite',
        marginLeft: '4px',
    },
    bottomSection: {
        width: '100%',
        maxWidth: '360px',
        marginTop: 'auto',
    },
    buttonContainer: {
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.875rem',
        marginBottom: '1.25rem',
    },
    footer: {
        width: '100%',
    },
    notice: {
        fontSize: '0.8125rem',
        color: '#94A3B8',
        textAlign: 'center',
        lineHeight: '1.6',
        letterSpacing: '-0.02em',
        wordBreak: 'keep-all',
    },
    link: {
        color: '#64748B',
        textDecoration: 'underline',
        fontWeight: '500',
    },
};

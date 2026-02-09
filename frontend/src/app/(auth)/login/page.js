"use client";

import { useState, useEffect } from 'react';
import GoogleLoginButton from '@/components/auth/GoogleLoginButton';

export default function LoginPage() {
    const [text, setText] = useState('');
    const fullText = 'Duduk 시작하기';

    useEffect(() => {
        let index = 0;
        const intervalId = setInterval(() => {
            if (index < fullText.length) {
                setText(fullText.slice(0, index + 1));
                index++;
            } else {
                clearInterval(intervalId);
            }
        }, 150); // 150ms per character

        return () => clearInterval(intervalId);
    }, []);

    // Split text to style "Duduk" differently
    const renderText = () => {
        const dudukPart = 'Duduk';
        if (text.length <= dudukPart.length) {
            return <span style={styles.titleMint}>{text}</span>;
        }
        return (
            <>
                <span style={styles.titleMint}>{dudukPart}</span>
                {text.slice(dudukPart.length)}
            </>
        );
    };

    return (
        <div style={styles.container}>
            {/* 상단 타이틀 */}
            <div style={styles.header}>
                <h1 style={styles.titleWrapper}>
                    <span style={styles.title}>
                        {renderText()}
                        <span style={styles.cursor} />
                    </span>
                </h1>
            </div>

            {/* Google 로그인 버튼 및 안내 문구 */}
            <div style={{ ...styles.bottomSection, ...styles.fadeInUp }} className="animate-fade-in-up delay-200">
                <div style={styles.buttonContainer}>
                    <GoogleLoginButton />
                </div>

                {/* 안내 문구 */}
                <div style={styles.footer}>
                    <p style={styles.notice}>
                        로그인하면 Duduk의 <a href="/terms" style={styles.link}>이용약관</a> 및 <a href="/privacy" style={styles.link}>개인정보처리방침</a>에<br />
                        동의하게 됩니다.
                    </p>
                </div>
            </div>
        </div>
    );
}

const styles = {
    container: {
        minHeight: '100vh',
        backgroundColor: '#FFFFFF',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '0 2rem',
        width: '100%',
        fontFamily: 'var(--font-pretendard)',
    },
    header: {
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: '15vh',
    },
    titleWrapper: {
        display: 'inline-block',
        minHeight: '3rem', // Prevent layout shift
    },
    title: {
        fontSize: '2.5rem',
        fontWeight: '800',
        color: '#1E293B',
        lineHeight: '1.2',
        textAlign: 'center',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    titleMint: {
        color: '#14b8a6',
    },
    cursor: {
        display: 'inline-block',
        width: '4px',
        height: '2.4rem',
        backgroundColor: '#14b8a6',
        animation: 'blink-caret .75s step-end infinite',
        marginLeft: '4px',
    },
    bottomSection: {
        width: '100%',
        maxWidth: '400px',
        marginTop: 'auto',
        paddingBottom: '3rem',
    },
    fadeInUp: {
    },
    buttonContainer: {
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        marginBottom: '1.5rem',
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
    },
    link: {
        color: '#64748B',
        textDecoration: 'underline',
        fontWeight: '500',
    },
};

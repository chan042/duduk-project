"use client";

import Link from 'next/link';

export default function LegalDocumentPage({ title, description, sections }) {
    return (
        <div style={styles.page}>
            <div style={styles.card}>
                <div style={styles.header}>
                    <Link href="/login" style={styles.backLink}>로그인으로 돌아가기</Link>
                    <h1 style={styles.title}>{title}</h1>
                    <p style={styles.description}>{description}</p>
                </div>

                <div style={styles.notice}>
                    현재 문서는 개발용 초안입니다. 실제 서비스 운영 전 최종 정책 문구로 교체해야 합니다.
                </div>

                <div style={styles.sectionList}>
                    {sections.map((section) => (
                        <section key={section.heading} style={styles.section}>
                            <h2 style={styles.sectionTitle}>{section.heading}</h2>
                            {section.body.map((paragraph) => (
                                <p key={paragraph} style={styles.sectionBody}>{paragraph}</p>
                            ))}
                        </section>
                    ))}
                </div>
            </div>
        </div>
    );
}

const styles = {
    page: {
        minHeight: '100dvh',
        background: 'linear-gradient(180deg, #F8FAFC 0%, #FFFFFF 100%)',
        paddingTop: 'max(1rem, env(safe-area-inset-top))',
        paddingRight: 'clamp(1rem, 4vw, 1.5rem)',
        paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))',
        paddingLeft: 'clamp(1rem, 4vw, 1.5rem)',
    },
    card: {
        width: '100%',
        maxWidth: '430px',
        margin: '0 auto',
        backgroundColor: '#FFFFFF',
        borderRadius: '24px',
        border: '1px solid #E2E8F0',
        boxShadow: '0 20px 45px rgba(15, 23, 42, 0.08)',
        padding: 'clamp(1.25rem, 4vw, 1.75rem)',
    },
    header: {
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        marginBottom: '1.25rem',
    },
    backLink: {
        color: '#0F766E',
        fontSize: '0.9rem',
        fontWeight: '600',
        textDecoration: 'underline',
        width: 'fit-content',
    },
    title: {
        fontSize: 'clamp(1.5rem, 6vw, 1.9rem)',
        fontWeight: '800',
        color: '#0F172A',
        lineHeight: 1.25,
    },
    description: {
        color: '#475569',
        lineHeight: 1.7,
        fontSize: '0.95rem',
        wordBreak: 'keep-all',
    },
    notice: {
        backgroundColor: '#ECFDF5',
        border: '1px solid #A7F3D0',
        color: '#065F46',
        borderRadius: '16px',
        padding: '0.9rem 1rem',
        fontSize: '0.875rem',
        lineHeight: 1.6,
        marginBottom: '1.25rem',
        wordBreak: 'keep-all',
    },
    sectionList: {
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
    },
    section: {
        padding: '1rem',
        borderRadius: '18px',
        backgroundColor: '#F8FAFC',
        border: '1px solid #E2E8F0',
    },
    sectionTitle: {
        fontSize: '1rem',
        fontWeight: '700',
        color: '#0F172A',
        marginBottom: '0.5rem',
    },
    sectionBody: {
        color: '#475569',
        fontSize: '0.92rem',
        lineHeight: 1.7,
        wordBreak: 'keep-all',
    },
};

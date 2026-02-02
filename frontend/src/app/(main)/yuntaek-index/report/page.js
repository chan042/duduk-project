"use client";

import { ChevronLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function YuntaekReportPage() {
    const router = useRouter();

    return (
        <div className="report-page-container">
            {/* Header */}
            <header style={styles.header}>
                <button
                    onClick={() => router.back()}
                    style={styles.backButton}
                >
                    <ChevronLeft size={24} />
                </button>
                <h1 style={styles.headerTitle}>AI 분석 리포트</h1>
                <div style={{ width: '24px' }} /> {/* Spacer for centering */}
            </header>

            {/* Content scroller */}
            <div style={styles.content}>

                <section className="fade-in" style={{ ...styles.section, animationDelay: '0.1s' }}>
                    <h2 style={styles.sectionTitle}>전체적인 소비 패턴</h2>
                    <p style={styles.text}>
                        <strong style={styles.highlight}>훌륭합니다!</strong> 지난달보다 소비가 15% 줄었어요.
                        특히 식비와 카페 지출이 크게 감소했습니다.
                        하지만 주말 쇼핑 지출은 소폭 상승했네요.
                        전반적으로 예산을 잘 지키고 계십니다.
                    </p>
                </section>

                <section className="fade-in" style={{ ...styles.section, animationDelay: '0.3s' }}>
                    <h2 style={styles.sectionTitle}>포트폴리오 분석</h2>
                    <p style={styles.text}>
                        현재 포트폴리오가 매우 안정적이에요.
                        안전 자산 비중이 60%로 적절하며,
                        성장주 비중을 조금만 늘리면 수익률을 더 기대해볼 수 있어요.
                        특히 기술주 섹터의 비중 조절을 추천합니다.
                    </p>
                </section>

                <section className="fade-in" style={{ ...styles.section, animationDelay: '0.5s' }}>
                    <h2 style={styles.sectionTitle}>개선 제안</h2>
                    <ul style={styles.list}>
                        <li style={styles.listItem}>구독 서비스 중 사용하지 않는 항목 정리하기</li>
                        <li style={styles.listItem}>주말 외식 비용 예산 설정하기</li>
                        <li style={styles.listItem}>비상금 통장 금리 비교해보기</li>
                    </ul>
                </section>

            </div>

            <style jsx global>{`
                .report-page-container {
                    min-height: 100vh;
                    background: #fff;
                    display: flex;
                    flex-direction: column;
                    padding-bottom: 2rem;
                }

                .fade-in {
                    animation: fadeIn 0.8s ease-out forwards;
                    opacity: 0;
                    transform: translateY(20px);
                }

                @keyframes fadeIn {
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
            `}</style>
        </div>
    );
}

const styles = {
    header: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '1rem',
        paddingTop: '3.5rem', // Safe area
        zIndex: 10,
        position: 'relative',
    },
    backButton: {
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '0.5rem',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: '1.2rem',
        fontWeight: '600',
        color: '#1e293b',
    },
    content: {
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '2rem',
        paddingBottom: '6rem',
        zIndex: 10,
        position: 'relative',
    },
    section: {
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
    },
    sectionTitle: {
        fontSize: '1.25rem',
        fontWeight: '700',
        color: '#334155',
        marginBottom: '0.5rem',
    },
    text: {
        fontSize: '1rem',
        lineHeight: '1.7',
        color: '#475569',
        wordBreak: 'keep-all',
    },
    highlight: {
        color: '#2563eb', // Blue-600
        fontWeight: '700',
    },
    list: {
        paddingLeft: '1.2rem',
        margin: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
    },
    listItem: {
        fontSize: '1rem',
        lineHeight: '1.6',
        color: '#475569',
    },
};

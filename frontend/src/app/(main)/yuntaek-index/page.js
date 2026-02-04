"use client";

import { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Smile, Award, CheckCircle2, TrendingUp, Shield, Zap, ChevronDown, ChevronUp } from 'lucide-react';

export default function YuntaekIndexPage() {
    const router = useRouter();
    const score = 98;
    const [displayedScore, setDisplayedScore] = useState(0);
    const [isDetailExpanded, setIsDetailExpanded] = useState(false);
    const [showProgress, setShowProgress] = useState(false);

    // Animate progress bars when expanded
    useEffect(() => {
        if (isDetailExpanded) {
            setShowProgress(false);
            const timer = setTimeout(() => setShowProgress(true), 100);
            return () => clearTimeout(timer);
        } else {
            setShowProgress(false);
        }
    }, [isDetailExpanded]);

    // Count up animation
    useEffect(() => {
        let startTimestamp = null;
        const duration = 2000; // 2 seconds

        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);

            // Ease out quart
            const easeProgress = 1 - Math.pow(1 - progress, 4);

            setDisplayedScore(Math.floor(easeProgress * score));

            if (progress < 1) {
                window.requestAnimationFrame(step);
            }
        };

        window.requestAnimationFrame(step);
    }, [score]);
    // Calculate status based on score
    const status = useMemo(() => {
        if (score >= 90) return { label: '상위 1%', color: '#3b82f6' }; // Blue
        if (score >= 80) return { label: '상위 10%', color: '#14b8a6' }; // Teal
        return { label: '노력 필요', color: '#f59e0b' }; // Amber
    }, [score]);

    const details = [
        { label: '예산 달성률', score: 30, max: 35 },
        { label: '대체 행동 실현', score: 18, max: 20 },
        { label: '성장 점수', score: 8, max: 10 },
        { label: '건강 점수', score: 14, max: 15 },
        { label: '꾸준함', score: 6, max: 7 },
        { label: '누수지출 개선', score: 9, max: 10 },
        { label: '챌린지 참여', score: 3, max: 3 },
    ];

    return (
        <div className="yuntaek-page-container">
            {/* Inject Animation Styles */}
            <style jsx global>{`
                @keyframes aurora {
                    0% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                    100% { background-position: 0% 50%; }
                }
                .yuntaek-page-container {
                    min-height: 100vh;
                    background: var(--background-light);
                    padding: 2rem 1.5rem 6rem 1.5rem;
                    display: flex;
                    flex-direction: column;
                    gap: 2.5rem;
                    color: var(--text-main);
                }
                .glass-card {
                    background: rgba(255, 255, 255, 0.7);
                    backdrop-filter: blur(20px);
                    -webkit-backdrop-filter: blur(20px);
                    border: 1px solid rgba(255, 255, 255, 0.8);
                    box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.05);
                }
                .fade-in {
                    animation: fadeIn 0.8s ease-out forwards;
                    opacity: 0;
                    transform: translateY(10px);
                }
                @keyframes fadeIn {
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                .rainbow-border {
                    position: relative;
                    border-radius: 24px;
                    z-index: 1;
                }
                .rainbow-border::after {
                    content: "";
                    position: absolute;
                    inset: 0;
                    border-radius: 24px;
                    background: #ffffff;
                    z-index: -1;
                }
                .rainbow-border::before {
                    content: "";
                    position: absolute;
                    inset: -4px;
                    border-radius: 30px;
                    background: linear-gradient(45deg, #ff0000, #ff7300, #fffb00, #48ff00, #00ffd5, #002bff, #7a00ff, #ff00c8, #ff0000);
                    background-size: 400%;
                    z-index: -2;
                    filter: blur(8px);
                    opacity: 0.7;
                    animation: aurora 10s linear infinite;
                }
                @keyframes pulse {
                    0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(147, 197, 253, 0.4); }
                    70% { transform: scale(1.02); box-shadow: 0 0 0 10px rgba(147, 197, 253, 0); }
                    100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(147, 197, 253, 0); }
                }
                @keyframes bounce {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(5px); }
                }
            `}</style>

            {/* Score Section (Hero) */}
            <section className="fade-in" style={{ ...styles.scoreSection, animationDelay: '0.1s' }}>
                <div style={styles.scoreContainer}>
                    <span style={styles.scoreValue}>{displayedScore}</span>
                    <span style={styles.scoreLabel}>내 윤택점수</span>
                </div>
            </section>

            {/* Detail Section (Clean List) - Moved Up & Collapsible */}
            {/* Detail Section (Clean List) - Collapsible with Center Text */}
            <section
                className="glass-card fade-in"
                style={{
                    ...styles.detailSection,
                    animationDelay: '0.3s',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: isDetailExpanded ? 'flex-start' : 'center',
                    alignItems: isDetailExpanded ? 'stretch' : 'center',
                    minHeight: 'auto',
                    padding: isDetailExpanded ? '1.5rem' : '1rem',
                    transition: 'all 0.3s ease',
                    animation: !isDetailExpanded ? 'pulse 2s infinite' : 'none',
                    animationDelay: '0.3s' // Maintain delay for fade-in
                }}
                onClick={() => setIsDetailExpanded(!isDetailExpanded)}
            >
                {!isDetailExpanded ? (
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.2rem',
                        width: '100%',
                    }}>
                        <span style={{
                            color: '#1a1a1a',
                            fontSize: '1.1rem',
                            fontWeight: '800',
                            letterSpacing: '-0.5px'
                        }}>
                            눌러서 세부 지표 확인하기
                        </span>
                        <ChevronDown
                            size={24}
                            color="#3b82f6"
                            style={{
                                animation: 'bounce 1.5s infinite',
                                marginTop: '0px'
                            }}
                        />
                    </div>
                ) : (
                    <div style={{ ...styles.detailList, marginTop: 0 }}>
                        <h2 style={{ ...styles.sectionTitle, marginBottom: '1.5rem' }}>세부 지표</h2>
                        {details.map((item, index) => (
                            <div key={index} style={styles.detailItem}>
                                <div style={styles.detailTextRow}>
                                    <span style={styles.detailLabel}>{item.label}</span>
                                    <span style={styles.detailScoreText}>
                                        <strong style={{ color: 'var(--text-main)' }}>{item.score}</strong>
                                        <span style={{ color: 'var(--text-guide)' }}>/{item.max}</span>
                                    </span>
                                </div>
                                <div style={styles.progressBarBg}>
                                    <div
                                        style={{
                                            ...styles.progressBarFill,
                                            width: showProgress ? `${(item.score / item.max) * 100}%` : '0%',
                                            backgroundColor: '#14b8a5',
                                            transitionDelay: `${index * 0.1}s`
                                        }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* Analysis Report (Glassmorphism + Rainbow) */}
            <section className="rainbow-border fade-in" style={{ ...styles.reportSection, animationDelay: '0.5s' }}>
                <div style={styles.reportHeader}>
                    <h2 style={styles.sectionTitle}>AI 분석 리포트</h2>
                </div>
                <div style={styles.reportContent}>
                    <p style={styles.reportText}>
                        <span style={styles.highlight}>훌륭합니다!</span> 지난달보다 소비가 15% 줄었어요. 특히 식비 절약이 돋보입니다.
                    </p>
                    <p style={styles.reportText}>
                        현재 포트폴리오가 매우 안정적이에요. 기술주 비중을 조금만 조절하면 더 완벽할 것 같아요.
                    </p>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                    <button
                        onClick={() => router.push('/yuntaek-index/report')}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-sub)',
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                        }}>
                        더보기 <span style={{ fontSize: '1rem' }}>›</span>
                    </button>
                </div>
            </section>
        </div>
    );
}

const styles = {
    scoreSection: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: '3rem',
        marginBottom: '1rem',
        textAlign: 'center',
    },
    statusCapsule: {
        backgroundColor: 'rgba(0,0,0,0.05)',
        padding: '6px 16px',
        borderRadius: '20px',
        fontSize: '0.875rem',
        fontWeight: '600',
        color: 'var(--text-sub)',
        marginBottom: '1.5rem',
        backdropFilter: 'blur(10px)',
    },
    scoreContainer: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        marginBottom: '1rem',
        position: 'relative',
    },
    scoreValue: {
        fontSize: '7.5rem',
        fontWeight: '200',
        lineHeight: '0.9',
        background: 'linear-gradient(135deg, var(--primary-dark), var(--primary-light))',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        letterSpacing: '-4px',
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        filter: 'drop-shadow(0 10px 20px rgba(20, 184, 166, 0.2))',
    },
    scoreLabel: {
        fontSize: '1rem',
        fontWeight: '500',
        color: 'var(--text-sub)',
        marginTop: '0.5rem',
    },
    scoreDescription: {
        fontSize: '1rem',
        color: 'var(--text-sub)',
        maxWidth: '240px',
        lineHeight: '1.5',
    },
    reportSection: {
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
    },
    sectionTitle: {
        fontSize: '1.1rem',
        fontWeight: '700',
        color: 'var(--text-main)',
        marginBottom: '0.5rem',
    },
    reportContent: {
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
    },
    reportText: {
        fontSize: '0.95rem',
        lineHeight: '1.6',
        color: '#334155',
    },
    highlight: {
        fontWeight: '700',
        color: 'var(--primary-dark)',
    },
    feedbackContainer: {
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '0.5rem',
        marginTop: '0.5rem',
    },
    feedbackButton: {
        width: '32px',
        height: '32px',
        borderRadius: '50%',
        border: 'none',
        backgroundColor: 'rgba(0,0,0,0.03)',
        color: 'var(--text-sub)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'background 0.2s',
    },
    detailSection: {
        padding: '1.5rem',
        borderRadius: '24px',
        cursor: 'pointer', // Suggest interactivity
    },
    detailHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    detailList: {
        marginTop: '1.5rem', // Add margin only when list is visible
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
    },
    detailItem: {
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
    },
    detailTextRow: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
    },
    detailLabel: {
        fontSize: '0.95rem',
        fontWeight: '600',
        color: '#1e293b',
    },
    detailScoreText: {
        fontSize: '1rem',
    },
    progressBarBg: {
        width: '100%',
        height: '8px',
        backgroundColor: '#f1f5f9',
        borderRadius: '4px',
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        borderRadius: '4px',
        transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)',
    },
};

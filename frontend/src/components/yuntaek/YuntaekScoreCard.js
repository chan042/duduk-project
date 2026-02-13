"use client";

import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';
import ScoreDetail from './ScoreDetail';

export default function YuntaekScoreCard({ score, year, month, isNewUser, details }) {
    const [displayedScore, setDisplayedScore] = useState(0);
    const [isDetailExpanded, setIsDetailExpanded] = useState(false);
    const [showProgress, setShowProgress] = useState(false);

    // Count up animation
    useEffect(() => {
        if (isNewUser || !score) return;

        let startTimestamp = null;
        const duration = 2000; // 2 seconds

        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            const easeProgress = 1 - Math.pow(1 - progress, 4);
            setDisplayedScore(Math.floor(easeProgress * score));

            if (progress < 1) {
                window.requestAnimationFrame(step);
            }
        };

        window.requestAnimationFrame(step);
    }, [score, isNewUser]);

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

    return (
        <section
            className="glass-card"
            style={{
                ...styles.scoreSection,
                padding: '2rem 1.5rem 1.5rem 1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: isDetailExpanded ? '1.5rem' : '0.5rem',
                transition: 'all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1)',
                alignItems: 'stretch',
                marginBottom: '1rem',
                borderRadius: '24px'
            }}
        >
            {/* Score Header */}
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: isDetailExpanded ? '0.5rem' : '0',
                padding: '0 0.5rem',
                width: '100%'
            }}>
                {year && month && (
                    <span style={{
                        fontSize: '0.85rem',
                        fontWeight: '600',
                        color: 'var(--text-sub)',
                        marginBottom: '0.25rem',
                        opacity: 0.8
                    }}>
                        {year}년 {month}월
                    </span>
                )}
            </div>

            {/* Score Display Area */}
            <div style={{
                display: 'flex',
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                width: '100%',
                marginTop: '1rem'
            }}>
                <span style={{
                    fontSize: '1.1rem',
                    fontWeight: '700',
                    color: 'var(--text-main)',
                    letterSpacing: '-0.5px'
                }}>
                    나의 윤택 지수
                </span>

                {isNewUser ? (
                    <div style={{
                        width: '100px',
                        height: '100px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        animation: 'bounce 2s infinite'
                    }}>
                        <HelpCircle
                            size={80}
                            color="#94a3b8"
                            strokeWidth={1.5}
                            style={{
                                filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.1))'
                            }}
                        />
                    </div>
                ) : (
                    <span style={styles.scoreValue}>
                        {displayedScore}
                        <span style={{
                            fontSize: '2rem',
                            marginLeft: '4px',
                            fontWeight: '400',
                            color: '#94a3b8',
                            WebkitTextFillColor: '#94a3b8'
                        }}>점</span>
                    </span>
                )}
            </div>

            {isNewUser ? (
                <div style={{
                    backgroundColor: '#f8fafc',
                    borderRadius: '16px',
                    padding: '1.25rem',
                    textAlign: 'center',
                    marginTop: '2rem',
                    width: '100%',
                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)'
                }}>
                    <p style={{
                        color: '#64748b',
                        fontSize: '0.9rem',
                        lineHeight: '1.5',
                        margin: 0,
                        wordBreak: 'keep-all'
                    }}>
                        한 달간의 기록이 모이면<br />윤택지수가 공개됩니다.
                    </p>
                </div>
            ) : (
                <>
                    <ScoreDetail
                        details={details}
                        isExpanded={isDetailExpanded}
                        showProgress={showProgress}
                    />

                    {/* Expand Toggle */}
                    <div
                        onClick={() => setIsDetailExpanded(!isDetailExpanded)}
                        style={{
                            display: 'flex',
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            padding: '0.8rem 1.5rem',
                            marginTop: '2rem',
                            cursor: 'pointer',
                            background: isDetailExpanded ? 'none' : 'rgba(255,255,255,0.6)',
                            borderRadius: '50px',
                            boxShadow: isDetailExpanded ? 'none' : '0 4px 15px rgba(0,0,0,0.05)',
                            border: isDetailExpanded ? 'none' : '1px solid rgba(255,255,255,0.8)',
                            animation: isDetailExpanded ? 'none' : 'pulse 2s infinite',
                            width: 'fit-content',
                            alignSelf: 'center',
                            transition: 'all 0.3s ease'
                        }}
                    >
                        <span style={{
                            color: isDetailExpanded ? 'var(--text-sub)' : '#1a1a1a',
                            fontSize: '0.95rem',
                            fontWeight: isDetailExpanded ? '600' : '700',
                        }}>
                            {isDetailExpanded ? '접기' : '세부 지표 확인하기'}
                        </span>
                        {isDetailExpanded ? (
                            <ChevronUp size={20} color="var(--text-sub)" />
                        ) : (
                            <ChevronDown
                                size={20}
                                color="#3b82f6"
                                style={{ animation: 'bounce 1.5s infinite' }}
                            />
                        )}
                    </div>
                </>
            )}
        </section>
    );
}

const styles = {
    scoreSection: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: '2.5rem',
        marginBottom: '0.5rem',
        textAlign: 'center',
    },
    scoreValue: {
        fontSize: '6.5rem',
        fontWeight: '800',
        lineHeight: '0.9',
        background: 'linear-gradient(135deg, #10b981, #3b82f6)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        letterSpacing: '-3px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        filter: 'drop-shadow(0 4px 10px rgba(16, 185, 129, 0.2))',
    },
};

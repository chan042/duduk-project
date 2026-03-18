"use client";

import { useRouter } from 'next/navigation';
import { ChevronLeft, User } from 'lucide-react';

export default function BattleResultPage() {
    const router = useRouter();

    // 결과 페이지 디스플레이용 하드코딩 데이터
    const resultData = {
        winner: '김윤택',
        loser: '이배틀',
        myTotalScore: 95,  // 최종 총점
        scores: [
            { category: '예산 달성률', maxScore: 35, me: 30, opponent: 25 },
            { category: '대안 행동 실현도', maxScore: 20, me: 18, opponent: 17 },
            { category: '건강 점수', maxScore: 15, me: 10, opponent: 14 }, // 진 항목
            { category: '성장 소비', maxScore: 10, me: 9, opponent: 8 },
            { category: '누수 지출', maxScore: 10, me: 10, opponent: 6 },
            { category: '소비 일관성', maxScore: 7, me: 7, opponent: 6 },
            { category: '챌린지 성공', maxScore: 3, me: 1, opponent: 2 }, // 진 항목
        ]
    };

    // 총점 계산
    const myTotal = resultData.scores.reduce((sum, item) => sum + item.me, 0);
    const opTotal = resultData.scores.reduce((sum, item) => sum + item.opponent, 0);

    return (
        <div style={styles.container}>
            <div style={styles.content}>
                
                {/* 상단 프로필 결과 영역 */}
                <div style={styles.topSection}>
                    <div style={styles.resultArena}>
                        {/* 승자 프로필 */}
                        <div style={styles.profileColWinner}>
                            <div style={styles.profileAvatarWinner}>
                                <User size={40} color="#ffffff" />
                            </div>
                            <span style={styles.profileNameWinner}>{resultData.winner}</span>
                        </div>
                        
                        <div style={styles.vsBadge}>VS</div>

                        {/* 패자 프로필 */}
                        <div style={styles.profileColLoser}>
                            <div style={styles.profileAvatarLoser}>
                                <User size={28} color="#94a3b8" />
                            </div>
                            <span style={styles.profileNameLoser}>{resultData.loser}</span>
                        </div>
                    </div>

                    <h1 style={styles.winnerText}>
                        {resultData.winner}님 <span style={styles.highlightText}>Win!</span>
                    </h1>
                    <p style={styles.subText}>압도적인 관리 능력으로 승리를 거머쥐셨습니다!</p>
                </div>

                {/* 배틀 요약 카드 */}
                <div style={styles.summaryCard}>
                    <div style={styles.summaryHeader}>
                        <h2 style={styles.summaryTitle}>점수 결과</h2>
                        <div style={styles.legendWrapper}>
                            <span style={styles.legendItem}><span style={styles.legendColorMe} />나</span>
                            <span style={styles.legendItem}><span style={styles.legendColorOpponent} />상대</span>
                        </div>
                    </div>

                    <div style={styles.scoreList}>
                        {resultData.scores.map((score, index) => {
                            const isWin = score.me >= score.opponent;
                            const myPercent = Math.round((score.me / score.maxScore) * 100);
                            const opPercent = Math.round((score.opponent / score.maxScore) * 100);
                            return (
                                <div key={index} style={styles.scoreRow}>
                                    <span style={styles.categoryName}>{score.category}</span>
                                    <div style={styles.barArea}>
                                        {/* 상대방 바 */}
                                        <div style={styles.barWrapper}>
                                            <div style={{
                                                ...styles.bar, 
                                                width: `${opPercent}%`, 
                                                background: '#cbd5e1',
                                            }} />
                                        </div>
                                        {/* 내 바 */}
                                        <div style={styles.barWrapper}>
                                            <div style={{
                                                ...styles.bar, 
                                                width: `${myPercent}%`, 
                                                background: 'var(--primary)',
                                            }} />
                                        </div>
                                    </div>
                                    <div style={styles.scoreNumbers}>
                                        <span style={styles.scoreNumberMe}>{score.me}</span>
                                        <span style={styles.scoreDivider}>/</span>
                                        <span style={styles.scoreNumberOpponent}>{score.opponent}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div style={styles.totalRow}>
                        <span style={styles.totalLabel}>총점</span>
                        <div style={styles.totalNumbers}>
                            <span style={styles.totalScoreMe}>{myTotal}</span>
                            <span style={styles.scoreDivider}>/</span>
                            <span style={styles.totalScoreOpponent}>{opTotal}</span>
                        </div>
                    </div>
                </div>

                {/* 하단 버튼 */}
                <div style={styles.bottomArea}>
                    <div className="rainbow-border">
                        <button 
                            style={styles.primaryButton}
                            onClick={() => router.push('/yuntaek-index')}
                        >
                            내 윤택지수 리포트 보러가기
                        </button>
                    </div>
                    {/* 하단바 여백 대비 */}
                    <div style={{height: '60px'}} />
                </div>
            </div>
        </div>
    );
}

const styles = {
    container: {
        background: '#f8fafc',
        height: '100vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
    },
    header: {
        position: 'sticky',
        top: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        padding: '1rem',
        background: '#f8fafc',
        flexShrink: 0,
    },
    backButton: {
        background: 'none',
        border: 'none',
        padding: '8px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerSpacer: {
        flex: 1,
    },
    content: {
        flex: 1,
        overflowY: 'auto',
        padding: '1.5rem',
        paddingTop: '0',
    },
    topSection: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        marginBottom: '2.5rem',
        animation: 'fadeInUp 0.6s ease-out forwards',
    },
    resultArena: {
        display: 'flex',
        alignItems: 'center', // 중앙 (VS 위치) 수직 밸런스 정렬
        justifyContent: 'center',
        gap: '1.5rem',
        marginBottom: '1.5rem',
        width: '100%',
    },
    vsBadge: {
        color: 'var(--text-guide)',
        fontSize: '0.9rem',
        fontWeight: '800',
        letterSpacing: '1px',
        paddingBottom: '24px', // 프로필 텍스트 높이만큼 올려서 아이콘끼리의 중앙에 맞추기 위함
    },
    profileColWinner: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        zIndex: 2,
    },
    profileAvatarWinner: {
        width: '80px',
        height: '80px',
        borderRadius: '50%',
        background: 'var(--primary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '0.5rem',
        boxShadow: '0 0 20px rgba(20, 184, 166, 0.4), 0 0 0 4px rgba(20, 184, 166, 0.2)',
        border: '2px solid white',
        animation: 'pulse 2s infinite',
    },
    profileNameWinner: {
        fontSize: '1rem',
        fontWeight: '700',
        color: 'var(--primary)',
        marginTop: '0.25rem',
    },
    profileColLoser: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        opacity: 0.7,
        filter: 'grayscale(0.5)',
    },
    profileAvatarLoser: {
        width: '56px',
        height: '56px',
        borderRadius: '20px',
        background: '#e2e8f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '0.5rem',
        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)',
    },
    profileNameLoser: {
        fontSize: '0.85rem',
        fontWeight: '500',
        color: 'var(--text-sub)',
        marginTop: '0.25rem',
    },
    winnerText: {
        fontSize: '1.5rem',
        fontWeight: '700',
        color: 'var(--text-main)',
        lineHeight: 1.4,
        margin: 0,
        marginBottom: '0.5rem',
    },
    highlightText: {
        color: 'var(--primary)',
        fontSize: '1.8rem',
        fontWeight: '800',
    },
    subText: {
        fontSize: '0.95rem',
        color: 'var(--text-sub)',
        margin: 0,
    },
    summaryCard: {
        background: 'white',
        borderRadius: 'var(--radius-lg)',
        padding: '1.5rem',
        boxShadow: 'var(--shadow-md)',
        marginBottom: '2rem',
    },
    summaryHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1.5rem',
    },
    summaryTitle: {
        fontSize: '1.1rem',
        fontWeight: '700',
        color: 'var(--text-main)',
        margin: 0,
    },
    legendWrapper: {
        display: 'flex',
        gap: '1rem',
    },
    legendItem: {
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        fontSize: '0.8rem',
        color: 'var(--text-sub)',
    },
    legendColorMe: {
        width: '12px',
        height: '12px',
        borderRadius: '3px',
        background: 'var(--primary)',
    },
    legendColorOpponent: {
        width: '12px',
        height: '12px',
        borderRadius: '3px',
        background: '#cbd5e1',
    },
    scoreList: {
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
    },
    scoreRow: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    categoryName: {
        width: '30%',
        fontSize: '0.85rem',
        fontWeight: '600',
        color: 'var(--text-sub)',
    },
    barArea: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        padding: '0 1rem',
    },
    barWrapper: {
        height: '6px',
        background: '#f1f5f9',
        borderRadius: '4px',
        overflow: 'hidden',
    },
    bar: {
        height: '100%',
        borderRadius: '4px',
        transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)',
    },
    scoreNumbers: {
        width: '20%',
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'baseline',
        gap: '4px',
        fontSize: '0.9rem',
    },
    scoreNumberMe: {
        color: 'var(--primary)',
    },
    scoreNumberOpponent: {
        color: 'var(--text-guide)',
    },
    scoreDivider: {
        color: 'var(--text-guide)',
        fontSize: '0.75rem',
        opacity: 0.5,
    },
    totalRow: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: '1.5rem',
        paddingTop: '1rem',
        borderTop: '1px dashed #e2e8f0',
    },
    totalLabel: {
        fontSize: '1.1rem',
        fontWeight: '700',
        color: 'var(--text-main)',
    },
    totalNumbers: {
        display: 'flex',
        alignItems: 'baseline',
        gap: '8px',
    },
    totalScoreMe: {
        fontSize: '1.5rem',
        fontWeight: '800',
        color: 'var(--primary)',
    },
    totalScoreOpponent: {
        fontSize: '1.1rem',
        fontWeight: '600',
        color: 'var(--text-guide)',
    },
    bottomArea: {
        marginTop: '2rem',
    },
    primaryButton: {
        width: '100%',
        background: 'white',
        color: 'var(--primary)',
        border: '1px solid var(--primary-light)',
        borderRadius: 'var(--radius-lg)',
        padding: '1.1rem',
        fontSize: '1rem',
        fontWeight: '700',
        cursor: 'pointer',
        boxShadow: 'var(--shadow-sm)',
        transition: 'all 0.2s ease',
        position: 'relative',
        zIndex: 2,
    }
};

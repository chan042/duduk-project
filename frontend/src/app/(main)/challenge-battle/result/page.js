"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { User, X } from 'lucide-react';

export default function BattleResult2Page() {
    const router = useRouter();
    const [isScoreModalOpen, setIsScoreModalOpen] = useState(false);

    // 결과 페이지 디스플레이용 하드코딩 데이터
    // 선택된 항목: 예시로 '건강 점수' 항목으로 대결했을 때
    const resultData = {
        winner: '김윤택',
        loser: '이배틀',
        selectedCategory: '건강 점수',    // 선택한 대결 항목
        maxScore: 15,                     // 해당 항목의 최대 배점
        myBaseScore: 12,                  // 내 항목 점수
        opBaseScore: 10,                  // 상대 항목 점수
        missions: [
            { title: '매일 5,000보 걷기', winner: '김윤택' },
            { title: '경제 기사 1개 읽기', winner: '이배틀' },
            { title: '명상 10분 하기', winner: '김윤택' },
        ]
    };

    const myMissionBonus = resultData.missions.filter(m => m.winner === resultData.winner).length * 3;
    const opMissionBonus = resultData.missions.filter(m => m.winner === resultData.loser).length * 3;
    const myTotal = resultData.myBaseScore + myMissionBonus;
    const opTotal = resultData.opBaseScore + opMissionBonus;
    const myBasePercent = Math.round((resultData.myBaseScore / resultData.maxScore) * 100);
    const opBasePercent = Math.round((resultData.opBaseScore / resultData.maxScore) * 100);

    // 전체 윤택지수 항목 점수 (팝업 표시용)
    const allScores = [
        { category: '예산 달성률', maxScore: 35, me: 30, opponent: 25 },
        { category: '대안 행동 실현도', maxScore: 20, me: 18, opponent: 17 },
        { category: '건강 점수', maxScore: 15, me: resultData.myBaseScore, opponent: resultData.opBaseScore },
        { category: '성장 소비', maxScore: 10, me: 9, opponent: 8 },
        { category: '누수 지출', maxScore: 10, me: 10, opponent: 6 },
        { category: '소비 일관성', maxScore: 7, me: 7, opponent: 6 },
        { category: '챌린지 성공', maxScore: 3, me: 1, opponent: 2 },
    ];

    const allScoresMyTotal = allScores.reduce((sum, score) => sum + score.me, 0);
    const allScoresOpponentTotal = allScores.reduce((sum, score) => sum + score.opponent, 0);

    useEffect(() => {
        if (!isScoreModalOpen) {
            document.body.style.overflow = '';
            return;
        }

        document.body.style.overflow = 'hidden';

        return () => {
            document.body.style.overflow = '';
        };
    }, [isScoreModalOpen]);

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

                {/* 점수 결과 카드 */}
                <div style={styles.summaryCard}>
                    <div style={styles.summaryHeader}>
                        <h2 style={styles.summaryTitle}>{resultData.selectedCategory}</h2>
                        <div style={styles.legendWrapper}>
                            <span style={styles.legendItem}><span style={styles.legendColorMe} />나</span>
                            <span style={styles.legendItem}><span style={styles.legendColorOpponent} />상대</span>
                        </div>
                    </div>

                    {/* 선택 항목 점수 바 */}
                    <div style={styles.scoreRow}>
                        <div style={styles.barArea}>
                            <div style={styles.barWrapper}>
                                <div style={{ ...styles.bar, width: `${opBasePercent}%`, background: '#cbd5e1' }} />
                            </div>
                            <div style={styles.barWrapper}>
                                <div style={{ ...styles.bar, width: `${myBasePercent}%`, background: 'var(--primary)' }} />
                            </div>
                        </div>
                        <div style={styles.scoreNumbers}>
                            <span style={styles.scoreNumberMe}>{resultData.myBaseScore}</span>
                            <span style={styles.scoreDivider}>/</span>
                            <span style={styles.scoreNumberOpponent}>{resultData.opBaseScore}</span>
                        </div>
                    </div>

                    {/* 미션 결과 세션 */}
                    <h3 style={styles.sectionSubTitle}>미션 결과</h3>
                    <div style={styles.missionList}>
                        {resultData.missions.map((mission, idx) => {
                            const isMyWin = mission.winner === resultData.winner;
                            return (
                                <div key={idx} style={styles.missionRow}>
                                    <span style={styles.missionTitle}>{mission.title}</span>
                                    <div style={styles.missionRight}>
                                        <span style={{
                                            ...styles.missionWinnerName,
                                            color: isMyWin ? 'var(--primary)' : '#d97706',
                                        }}>
                                            {mission.winner}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* 총점 */}
                    <div style={styles.totalRow}>
                        <span style={styles.totalLabel}>총점</span>
                        <div style={styles.totalNumbers}>
                            <span style={styles.totalScoreMe}>{myTotal}</span>
                            <span style={styles.scoreDivider}>/</span>
                            <span style={styles.totalScoreOpponent}>{opTotal}</span>
                        </div>
                    </div>
                </div>

                <button
                    type="button"
                    style={styles.compareButton}
                    onClick={() => setIsScoreModalOpen(true)}
                >
                    <span style={styles.compareButtonText}>다른 점수도 비교해볼까요? </span>
                    <span style={styles.compareButtonHighlight}>Click!</span>
                </button>

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
                    <div style={{ height: '60px' }} />
                </div>
            </div>

            {isScoreModalOpen && (
                <div style={styles.modalOverlay}>
                    <div style={styles.modalPanel}>
                        <button
                            type="button"
                            aria-label="점수 결과 닫기"
                            style={styles.modalCloseButton}
                            onClick={() => setIsScoreModalOpen(false)}
                        >
                            <X size={20} color="var(--text-main)" />
                        </button>

                        <div style={styles.modalCardContent}>
                            <div style={styles.summaryHeader}>
                                <h2 style={styles.summaryTitle}>점수 결과</h2>
                                <div style={styles.legendWrapper}>
                                    <span style={styles.legendItem}><span style={styles.legendColorMe} />나</span>
                                    <span style={styles.legendItem}><span style={styles.legendColorOpponent} />상대</span>
                                </div>
                            </div>
                            <div style={styles.scoreList}>
                                {allScores.map((score, index) => {
                                    const myPct = Math.round((score.me / score.maxScore) * 100);
                                    const opPct = Math.round((score.opponent / score.maxScore) * 100);
                                    return (
                                        <div key={index} style={styles.scoreRowFull}>
                                            <span style={styles.categoryName}>{score.category}</span>
                                            <div style={styles.barAreaFull}>
                                                <div style={styles.barWrapperSmall}>
                                                    <div style={{ ...styles.bar, width: `${opPct}%`, background: '#cbd5e1' }} />
                                                </div>
                                                <div style={styles.barWrapperSmall}>
                                                    <div style={{ ...styles.bar, width: `${myPct}%`, background: 'var(--primary)' }} />
                                                </div>
                                            </div>
                                            <div style={styles.scoreNumbersSmall}>
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
                                    <span style={styles.totalScoreMe}>{allScoresMyTotal}</span>
                                    <span style={styles.scoreDivider}>/</span>
                                    <span style={styles.totalScoreOpponent}>{allScoresOpponentTotal}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
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
        position: 'relative',
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
        alignItems: 'center',
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
        paddingBottom: '24px',
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
    compareButton: {
        width: '100%',
        background: 'none',
        border: 'none',
        padding: 0,
        marginTop: '-0.5rem',
        marginBottom: '2rem',
        textAlign: 'center',
        cursor: 'pointer',
    },
    compareButtonText: {
        fontSize: '0.95rem',
        color: 'var(--text-sub)',
    },
    compareButtonHighlight: {
        fontSize: '0.95rem',
        color: 'var(--primary)',
        fontWeight: '800',
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
    sectionSubTitle: {
        fontSize: '1.1rem',
        fontWeight: '700',
        color: 'var(--text-main)',
        margin: '0 0 0.75rem 0',
    },
    scoreList: {
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
    },
    scoreRowFull: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    barAreaFull: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        padding: '0 1rem',
    },
    barWrapperSmall: {
        height: '6px',
        background: '#f1f5f9',
        borderRadius: '4px',
        overflow: 'hidden',
    },
    scoreNumbersSmall: {
        width: '20%',
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'baseline',
        gap: '4px',
        fontSize: '0.9rem',
    },
    scoreRow: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '1.5rem',
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
        fontWeight: '700',
    },
    scoreNumberOpponent: {
        color: 'var(--text-guide)',
        fontWeight: '700',
    },
    scoreDivider: {
        color: 'var(--text-guide)',
        fontSize: '0.75rem',
        opacity: 0.5,
    },
    missionList: {
        display: 'flex',
        flexDirection: 'column',
        gap: '0.6rem',
        marginBottom: '1.5rem',
    },
    missionCard: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'white',
        border: '1px solid #e2e8f0',
        borderRadius: '10px',
        padding: '0.9rem 1rem',
    },
    missionRow: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'white',
        border: '1px solid #e2e8f0',
        borderRadius: '10px',
        padding: '0.9rem 1rem',
    },
    missionRight: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        flexShrink: 0,
    },
    missionTitle: {
        flex: 1,
        fontSize: '0.9rem',
        fontWeight: '600',
        color: 'var(--text-main)',
    },
    missionBonusBadge: {
        fontSize: '0.85rem',
        fontWeight: '800',
        padding: '3px 10px',
        borderRadius: '20px',
        flexShrink: 0,
    },
    missionWinnerName: {
        fontSize: '0.8rem',
        fontWeight: '600',
        width: '60px',
        textAlign: 'right',
        flexShrink: 0,
    },
    totalRow: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: '0.5rem',
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
    modalOverlay: {
        position: 'fixed',
        inset: 0,
        width: '100%',
        maxWidth: '430px',
        margin: '0 auto',
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        background: 'rgba(15, 23, 42, 0.45)',
        zIndex: 1000,
    },
    modalPanel: {
        width: '100%',
        maxWidth: '420px',
        maxHeight: '80vh',
        overflowY: 'auto',
        background: 'white',
        borderRadius: '24px',
        boxShadow: '0 24px 60px rgba(15, 23, 42, 0.18)',
        position: 'relative',
        padding: '3.25rem 1.5rem 1.5rem',
        animation: 'fadeInUp 0.25s ease-out forwards',
    },
    modalCloseButton: {
        position: 'absolute',
        top: '1rem',
        right: '1rem',
        width: '32px',
        height: '32px',
        borderRadius: '50%',
        border: '1px solid #e2e8f0',
        background: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
    },
    modalCardContent: {
        display: 'flex',
        flexDirection: 'column',
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

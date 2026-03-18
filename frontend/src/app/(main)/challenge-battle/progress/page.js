"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, User } from 'lucide-react';
import MissionDetailModal from '@/components/challenge-battle/MissionDetailModal';

export default function BattleProgressPage() {
    const router = useRouter();
    const [selectedMission, setSelectedMission] = useState(null);

    // 하드코딩된 대결 진행 중 상태 데이터
    const battleData = {
        dDay: 7,
        me: {
            name: '김윤택',
            score: 1,
            isWinning: true
        },
        opponent: {
            name: '이배틀',
            score: 0,
            isWinning: false
        },
        missions: [
            {
                id: 1,
                title: '매일 5,000보 걷기',
                description: '건강을 위해 매일 5,000보를 걷고 스마트워치나 앱 기록을 캡처해 인증하세요.',
                status: '진행중'
            },
            {
                id: 2,
                title: '경제 기사 1개 읽기',
                description: '오늘의 주요 경제 뉴스를 읽고 한 줄 요약을 남겨주세요.',
                status: '진행중'
            },
            {
                id: 3,
                title: '물 2L 마시기',
                description: '하루 동안 물 2리터를 마시고 인증샷을 올려주세요.',
                status: '완료됨',
                winner: '김윤택'
            }
        ]
    };

    const hasFinishedMissions = battleData.missions.some(m => m.status === '완료됨');

    return (
        <div style={styles.container}>
            <div style={styles.content}>
                
                {/* 상단 D-Day */}
                <div style={styles.topSection}>
                    <p style={styles.dDaySubtitle}>대결 종료까지</p>
                    <h1 style={styles.dDayTitle}>D-{battleData.dDay}</h1>
                </div>

                {/* 중앙 프로필 경쟁 영역 */}
                <div style={styles.battleArena}>
                    {/* 내 프로필 */}
                    <div style={styles.profileCol}>
                        <div style={styles.profileAvatar}>
                            <User size={32} color="var(--primary)" />
                        </div>
                        <span style={styles.profileName}>{battleData.me.name} (나)</span>
                    </div>
                    
                    {/* VS */}
                    <div style={styles.vsBadge}>VS</div>

                    {/* 상대 프로필 */}
                    <div style={styles.profileCol}>
                        <div style={styles.profileAvatar}>
                            <User size={32} color="var(--primary)" />
                        </div>
                        <span style={styles.profileName}>{battleData.opponent.name}</span>
                    </div>
                </div>

                <div style={styles.battleStatus}>
                    <p style={styles.statusText}>
                        <span style={styles.highlightText}>
                            {battleData.me.score} : {battleData.opponent.score}
                        </span> 으로 
                        {' '}{battleData.me.isWinning ? battleData.me.name : battleData.opponent.name}님이 승리 중!
                    </p>
                    {!hasFinishedMissions && (
                         <p style={styles.encourageText}>
                            {battleData.opponent.name}님보다 먼저 미션에 성공해봐요!
                        </p>
                    )}
                </div>

                {/* 미션 목록 */}
                <div style={styles.missionSection}>
                    
                    {/* 진행 중인 미션 */}
                    <div style={styles.missionGroup}>
                        <h3 style={styles.groupTitle}>진행 중인 미션</h3>
                        <div style={styles.missionList}>
                            {battleData.missions.filter(m => m.status === '진행중').map(mission => (
                                <div key={mission.id} style={styles.missionCard} onClick={() => setSelectedMission(mission)}>
                                    <div style={styles.missionCardContent}>
                                        <div style={styles.missionHeader}>
                                             <span style={styles.badgeOngoing}>ONGOING</span>
                                        </div>
                                        <h4 style={styles.missionCardTitle}>{mission.title}</h4>
                                    </div>
                                    <ChevronRight size={20} color="var(--text-guide)" />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 완료된 미션 */}
                    <div style={styles.missionGroup}>
                        <h3 style={styles.groupTitle}>완료된 미션</h3>
                        <div style={styles.missionList}>
                            {battleData.missions.filter(m => m.status === '완료됨').map(mission => (
                                <div key={mission.id} style={{...styles.missionCard, opacity: 0.7}} onClick={() => setSelectedMission(mission)}>
                                    <div style={styles.missionCardContent}>
                                        <div style={styles.missionHeader}>
                                             <span style={styles.badgeFinished}>FINISHED</span>
                                        </div>
                                        <h4 style={styles.missionCardTitle}>{mission.title}</h4>
                                    </div>
                                    <div style={styles.missionRightArea}>
                                        <span style={styles.winnerSummary}>{mission.winner} 성공</span>
                                        <ChevronRight size={20} color="var(--text-guide)" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>
            </div>

            {/* 미션 상세 모달 */}
            <MissionDetailModal 
                isOpen={!!selectedMission} 
                onClose={() => setSelectedMission(null)}
                mission={selectedMission || {}}
            />
            {/* 임시로 결과 페이지 넘어가기 버튼 (테스트용) */}
            <div style={styles.testNavArea}>
                 <button onClick={() => router.push('/challenge-battle/result')} style={styles.testNavBtn}>테스트: 결과보기</button>
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
        paddingTop: '0.5rem',
        paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))', 
    },
    topSection: {
        textAlign: 'center',
        marginBottom: '2rem',
    },
    dDaySubtitle: {
        fontSize: '1rem',
        fontWeight: '600',
        color: 'var(--text-sub)',
        margin: 0,
        marginBottom: '0.25rem',
    },
    dDayTitle: {
        fontSize: '3rem',
        fontWeight: '800',
        color: 'var(--primary)',
        margin: 0,
        lineHeight: 1,
    },
    battleArena: {
        background: 'white',
        borderRadius: 'var(--radius-lg)',
        padding: '2.5rem 1rem 1.5rem 1rem',
        boxShadow: 'var(--shadow-md)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-around',
        marginBottom: '1rem',
        position: 'relative',
    },
    vsBadge: {
        position: 'absolute',
        top: '1rem',
        left: '50%',
        transform: 'translateX(-50%)',
        background: '#f1f5f9',
        color: 'var(--text-sub)',
        padding: '4px 12px',
        borderRadius: '20px',
        fontSize: '0.9rem',
        fontWeight: '800',
        letterSpacing: '1px',
    },
    profileCol: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
    },
    profileAvatar: {
        width: '72px',
        height: '72px',
        borderRadius: '24px',
        background: 'var(--primary-light)',
        opacity: 0.8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '0.5rem',
    },
    profileName: {
        fontSize: '0.9rem',
        fontWeight: '600',
        color: 'var(--text-main)',
        marginBottom: '0.25rem',
    },
    battleStatus: {
        textAlign: 'center',
        marginBottom: '2rem',
    },
    statusText: {
        fontSize: '1.05rem',
        color: 'var(--text-main)',
        fontWeight: '500',
        margin: 0,
    },
    highlightText: {
        fontWeight: '800',
        color: 'var(--primary)',
        fontSize: '1.15rem',
    },
    encourageText: {
        fontSize: '0.95rem',
        color: 'var(--text-guide)',
        marginTop: '0.5rem',
        fontWeight: '600',
    },
    missionSection: {
        display: 'flex',
        flexDirection: 'column',
        gap: '2rem',
    },
    missionGroup: {
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
    },
    groupTitle: {
        fontSize: '1.2rem',
        fontWeight: '700',
        color: 'var(--text-main)',
        margin: 0,
    },
    missionList: {
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
    },
    missionCard: {
        background: 'white',
        borderRadius: 'var(--radius-md)',
        padding: '1.25rem',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        cursor: 'pointer',
        border: '1px solid transparent',
        transition: 'all 0.2s',
        ':hover': {
             borderColor: 'var(--primary-light)',
        }
    },
    missionCardContent: {
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
    },
    missionRightArea: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
    },
    missionHeader: {
        display: 'flex',
        alignItems: 'center',
    },
    badgeOngoing: {
        fontSize: '0.75rem',
        fontWeight: '800',
        letterSpacing: '0.5px',
        color: '#3b82f6',
        background: '#eff6ff',
        padding: '4px 8px',
        borderRadius: '6px',
    },
    badgeFinished: {
        fontSize: '0.75rem',
        fontWeight: '800',
        letterSpacing: '0.5px',
        color: 'var(--text-sub)',
        background: '#f1f5f9',
        padding: '4px 8px',
        borderRadius: '6px',
    },
    missionCardTitle: {
        fontSize: '1.1rem',
        fontWeight: '600',
        color: 'var(--text-main)',
        margin: 0,
    },
    winnerSummary: {
        fontSize: '0.85rem',
        color: 'var(--primary)',
        fontWeight: '600',
        margin: 0,
        marginTop: '0.25rem',
    },
    testNavArea: {
         padding: '1rem',
         display: 'flex',
         justifyContent: 'center',
    },
    testNavBtn: {
          background: '#e2e8f0',
          border: 'none',
          padding: '8px 16px',
          borderRadius: '20px',
          fontSize: '0.9rem',
          cursor: 'pointer',
          fontWeight: '600',
          color: 'var(--text-main)',
    }
};

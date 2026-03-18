"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useYuntaekScore, useYuntaekReport, getTargetYearMonth, clearYuntaekCache } from '@/hooks/useYuntaekData';
import { regenerateYuntaekData } from '@/lib/api/yuntaek';
import YuntaekScoreCard from '@/components/yuntaek/YuntaekScoreCard';
import ReportSummary from '@/components/yuntaek/ReportSummary';
import LoadingOverlay from '@/components/common/LoadingOverlay';
import { Swords } from 'lucide-react';


export default function YuntaekIndexPage() {
    const router = useRouter();
    const [isRegenerating, setIsRegenerating] = useState(false);
    const [regenError, setRegenError] = useState('');
    const { score, details, scoreData, isNewUser: scoreNewUser, loading: scoreLoading, error: scoreError, fromCache: scoreFromCache } = useYuntaekScore();
    const { reportSummary, isNewUser: reportNewUser, loading: reportLoading, error: reportError, fromCache: reportFromCache } = useYuntaekReport();

    // 캐시에서 데이터를 가져온 경우 로딩 표시 안 함
    const loading = (scoreLoading || reportLoading) && !(scoreFromCache || reportFromCache);
    const isNewUser = scoreNewUser || reportNewUser;
    const fatalError = scoreError && !scoreData && !isNewUser;
    const summaryText = reportSummary || (reportError ? '리포트를 아직 불러오지 못했습니다. 잠시 후 다시 시도해주세요.' : '');
    const showDevRegenerate = process.env.NODE_ENV !== 'production';
    const targetYearMonth = (scoreData?.year && scoreData?.month)
        ? { year: scoreData.year, month: scoreData.month }
        : getTargetYearMonth();

    async function handleRegenerate() {
        setRegenError('');
        setIsRegenerating(true);

        try {
            await regenerateYuntaekData(targetYearMonth.year, targetYearMonth.month);
            clearYuntaekCache(targetYearMonth.year, targetYearMonth.month);
            window.location.reload();
        } catch (err) {
            console.error('윤택지수/리포트 재생성 오류:', err);
            setRegenError(err.response?.data?.error || err.message || '재생성에 실패했습니다.');
            setIsRegenerating(false);
        }
    }

    const devActions = showDevRegenerate && (
        <div style={styles.devPanel}>
            <div>
                <p style={styles.devTitle}>개발용 재생성</p>
                <p style={styles.devDescription}>
                    {targetYearMonth.year}년 {targetYearMonth.month}월 윤택지수와 AI 분석 리포트를 즉시 다시 생성합니다.
                </p>
            </div>
            <button
                onClick={handleRegenerate}
                disabled={isRegenerating}
                style={{
                    ...styles.devButton,
                    opacity: isRegenerating ? 0.7 : 1,
                    cursor: isRegenerating ? 'wait' : 'pointer',
                }}
            >
                {isRegenerating ? '재생성 중...' : '윤택지수 재생성'}
            </button>
        </div>
    );

    if (fatalError) {
        return (
            <div className="yuntaek-page-container">
                {isRegenerating && <LoadingOverlay message="윤택지수와 리포트를 재생성하는 중입니다..." />}
                {devActions}
                {regenError && <p style={styles.devError}>{regenError}</p>}
                <p style={{ color: '#ef4444', textAlign: 'center', marginTop: '2rem' }}>{scoreError}</p>
            </div>
        );
    }

    return (
        <div className="yuntaek-page-container">
            {loading && <LoadingOverlay message="AI가 소비 내역을 분석하고 있습니다..." />}
            {isRegenerating && <LoadingOverlay message="윤택지수와 리포트를 재생성하는 중입니다..." />}
            {devActions}
            {regenError && <p style={styles.devError}>{regenError}</p>}

            <YuntaekScoreCard
                score={score}
                year={scoreData?.year}
                month={scoreData?.month}
                isNewUser={isNewUser}
                details={details}
            />

            <ReportSummary
                summary={summaryText}
                year={scoreData?.year}
                month={scoreData?.month}
                isNewUser={isNewUser}
                canViewMore={!reportError && Boolean(reportSummary)}
                onViewMore={() => router.push('/yuntaek-index/report')}
            />

            {/* 윤택지수 대결하기 플로팅 버튼 */}
            <button
                className="floating-battle-btn"
                onClick={() => router.push('/challenge-battle/search')}
                style={styles.floatingBattleButton}
            >
                <Swords size={20} />
                <span>윤택지수 대결하기</span>
            </button>
        </div>
    );
}

const styles = {
    devPanel: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        padding: '1rem 1.25rem',
        marginBottom: '1rem',
        borderRadius: '18px',
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.06), rgba(16, 185, 129, 0.08))',
        border: '1px dashed rgba(15, 23, 42, 0.14)',
    },
    devTitle: {
        margin: 0,
        fontSize: '0.95rem',
        fontWeight: '700',
        color: '#0f172a',
    },
    devDescription: {
        margin: '0.2rem 0 0',
        fontSize: '0.85rem',
        color: '#475569',
        lineHeight: 1.5,
    },
    devButton: {
        border: 'none',
        borderRadius: '999px',
        padding: '0.8rem 1rem',
        background: '#0f172a',
        color: '#fff',
        fontSize: '0.85rem',
        fontWeight: '700',
        whiteSpace: 'nowrap',
    },
    devError: {
        color: '#dc2626',
        fontSize: '0.9rem',
        margin: '0 0 1rem',
        textAlign: 'center',
    },
    floatingBattleButton: {
        position: 'fixed',
        bottom: 'calc(84px + env(safe-area-inset-bottom, 0px) + 8px)',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        padding: '12px 24px',
        borderRadius: '9999px',
        background: 'rgba(255, 255, 255, 0.3)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        border: '1px solid rgba(255, 255, 255, 0.25)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.4)',
        color: 'var(--primary)',
        fontSize: '0.9rem',
        fontWeight: '600',
        cursor: 'pointer',
        zIndex: 100,
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
    }
};

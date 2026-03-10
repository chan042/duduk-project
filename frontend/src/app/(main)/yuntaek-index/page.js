"use client";

import { useRouter } from 'next/navigation';
import { useYuntaekScore, useYuntaekReport } from '@/hooks/useYuntaekData';
import YuntaekScoreCard from '@/components/yuntaek/YuntaekScoreCard';
import ReportSummary from '@/components/yuntaek/ReportSummary';
import LoadingOverlay from '@/components/common/LoadingOverlay';


export default function YuntaekIndexPage() {
    const router = useRouter();
    const { score, details, scoreData, isNewUser: scoreNewUser, loading: scoreLoading, error: scoreError, fromCache: scoreFromCache } = useYuntaekScore();
    const { reportSummary, isNewUser: reportNewUser, loading: reportLoading, error: reportError, fromCache: reportFromCache } = useYuntaekReport();

    // 캐시에서 데이터를 가져온 경우 로딩 표시 안 함
    const loading = (scoreLoading || reportLoading) && !(scoreFromCache || reportFromCache);
    const isNewUser = scoreNewUser || reportNewUser;
    const fatalError = scoreError && !scoreData && !isNewUser;
    const summaryText = reportSummary || (reportError ? '리포트를 아직 불러오지 못했습니다. 잠시 후 다시 시도해주세요.' : '');

    if (fatalError) {
        return <p style={{ color: '#ef4444', textAlign: 'center', marginTop: '2rem' }}>{scoreError}</p>;
    }

    return (
        <div className="yuntaek-page-container">
            {loading && <LoadingOverlay message="AI가 소비 내역을 분석하고 있습니다..." />}

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
        </div>
    );
}

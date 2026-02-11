"use client";

import { useRouter } from 'next/navigation';
import { useYuntaekReport } from '@/hooks/useYuntaekData';
import ReportHeader from '@/components/yuntaek/ReportHeader';
import JsonReportRenderer from '@/components/yuntaek/JsonReportRenderer';
import LoadingOverlay from '@/components/common/LoadingOverlay';

export default function YuntaekReportPage() {
    const router = useRouter();
    const { reportData, loading, error, fromCache } = useYuntaekReport();

    // 캐시에서 데이터를 가져온 경우 로딩 표시 안 함
    const showLoading = loading && !fromCache;

    function downloadReport() {
        if (!reportData?.report || typeof reportData.report !== 'object') return;

        const jsonStr = JSON.stringify(reportData.report, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `윤택지수_리포트_${reportData.year}년_${reportData.month}월.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    if (error) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
                <p style={{ color: '#ef4444' }}>{error}</p>
            </div>
        );
    }

    return (
        <div className="report-page-container">
            {showLoading && <LoadingOverlay message="리포트를 불러오는 중입니다..." />}

            <ReportHeader
                onBack={() => router.back()}
                onDownload={downloadReport}
            />

            <div style={styles.content}>
                <div className="fade-in" style={{ animationDelay: '0.1s' }}>
                    <JsonReportRenderer content={reportData?.report} />
                </div>
            </div>
        </div>
    );
}

const styles = {
    content: {
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        paddingBottom: '6rem',
        zIndex: 10,
        position: 'relative',
    },
};

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
        if (!reportData) return;
        window.print();
    }

    if (error && !reportData) {
        return <p style={{ color: '#F04452', textAlign: 'center', marginTop: '2rem' }}>{error}</p>;
    }

    return (
        <div className="report-page-container" style={{ background: '#F2F4F6', minHeight: '100vh' }}>
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
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        paddingBottom: '100px',
        zIndex: 10,
        position: 'relative',
    },
};

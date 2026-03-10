"use client";

import NewUserGuide from './NewUserGuide';

export default function ReportSummary({ summary, year, month, isNewUser, canViewMore = false, onViewMore }) {
    return (
        <section className="rainbow-border fade-in" style={{ ...styles.reportSection, animationDelay: '0.5s' }}>
            <div style={styles.reportHeader}>
                <h2 style={styles.sectionTitle}>
                    {year && month ? `${year}년 ${month}월 ` : ''}AI 분석 리포트
                </h2>
            </div>

            <div style={styles.reportContent}>
                {isNewUser ? (
                    <NewUserGuide />
                ) : (
                    <p style={styles.reportText}>
                        {summary || '리포트를 불러오는 중...'}
                    </p>
                )}
            </div>

            {/* 신규 사용자가 아닌 경우에만 더보기 버튼 표시 */}
            {!isNewUser && canViewMore && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                    <button
                        onClick={onViewMore}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-sub)',
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                        }}
                    >
                        더보기 <span style={{ fontSize: '1rem' }}>›</span>
                    </button>
                </div>
            )}
        </section>
    );
}

const styles = {
    reportSection: {
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
    },
    reportHeader: {
        marginBottom: '1rem',
        borderBottom: '1px solid rgba(0,0,0,0.06)',
        paddingBottom: '0.5rem',
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
};

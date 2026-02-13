"use client";

import { memo } from 'react';

export default memo(function NewUserGuide() {
    // 다음 달 계산
    const now = new Date();
    const nextMonth = now.getMonth() === 11 ? 1 : now.getMonth() + 2;

    // 하드코딩된 가이드 데이터
    const guide = {
        title: "🎯 시작 가이드",
        steps: [
            "이번 달 소비를 꾸준히 기록해보세요.",
            `다음 달(${nextMonth}월 1일)부터 윤택지수와 AI 분석 리포트를 확인할 수 있어요`
        ],
        tips: [
            "작은 지출이라도 빠짐없이 기록하세요.",
            "AI 코칭 카드를 챌린지로 만들어 도전해보세요.",
            "매월 1일, 윤택지수와 AI 분석 리포트가 제공됩니다."
        ]
    };

    return (
        <div style={styles.container}>
            {/* 시작 가이드 */}
            <div style={styles.section}>
                <h3 style={styles.sectionTitle}>{guide.title}</h3>
                <ol style={styles.orderedList}>
                    {guide.steps.map((step, index) => {
                        // "지출 기록하기:", "AI 분석 확인:" 등 콜론(:) 앞부분을 볼드처리
                        const parts = step.split(':');
                        return (
                            <li key={index} style={styles.listItem}>
                                {parts.length > 1 ? (
                                    <>
                                        <strong>{parts[0]}</strong>:{parts.slice(1).join(':')}
                                    </>
                                ) : (
                                    step
                                )}
                            </li>
                        );
                    })}
                </ol>
            </div>

            {/* 팁 */}
            <div style={styles.section}>
                <h3 style={styles.sectionTitle}>💡 팁</h3>
                <ul style={styles.unorderedList}>
                    {guide.tips.map((tip, index) => (
                        <li key={index} style={styles.listItem}>
                            {tip}
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
});

const styles = {
    container: {
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
    },
    section: {
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
    },
    sectionTitle: {
        fontSize: '1.1rem',
        fontWeight: '700',
        color: 'var(--text-main)',
        margin: 0,
    },
    orderedList: {
        margin: 0,
        paddingLeft: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
    },
    unorderedList: {
        margin: 0,
        paddingLeft: '1.5rem',
        listStyleType: 'disc',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
    },
    listItem: {
        fontSize: '0.95rem',
        lineHeight: '1.6',
        color: '#334155',
    },
};

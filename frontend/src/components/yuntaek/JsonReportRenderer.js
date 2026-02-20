"use client";

export default function JsonReportRenderer({ content }) {
    if (!content || typeof content !== 'object') {
        return (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                <p>리포트 데이터를 불러올 수 없습니다.</p>
            </div>
        );
    }

    const { summary, weakness_analysis, yuntaek_analysis, next_month_strategy, expert_summary } = content;

    return (
        <div style={styles.container}>
            {/* 요약 섹션 */}
            {summary && (
                <section style={styles.section}>
                    <h2 style={styles.sectionTitle}>📊 {summary.period} 소비 요약</h2>
                    <p style={styles.overview}>{summary.overview}</p>

                    {summary.budget_status && (
                        <div style={styles.card}>
                            <h3 style={styles.cardTitle}>예산 현황</h3>
                            <div style={styles.budgetGrid}>
                                <div style={styles.budgetItem}>
                                    <span style={styles.budgetLabel}>예산</span>
                                    <span style={styles.budgetValue}>{summary.budget_status.budget?.toLocaleString()}원</span>
                                </div>
                                <div style={styles.budgetItem}>
                                    <span style={styles.budgetLabel}>지출</span>
                                    <span style={{ ...styles.budgetValue, color: '#F04452' }}>{summary.budget_status.spent?.toLocaleString()}원</span>
                                </div>
                                <div style={styles.budgetItem}>
                                    <span style={styles.budgetLabel}>남은 예산</span>
                                    <span style={{ ...styles.budgetValue, color: 'var(--primary, #14b8a6)' }}>{summary.budget_status.remaining?.toLocaleString()}원</span>
                                </div>
                            </div>
                            <p style={styles.budgetMessage}>{summary.budget_status.message}</p>
                        </div>
                    )}

                    {summary.top_categories && summary.top_categories.length > 0 && (
                        <div style={styles.card}>
                            <h3 style={styles.cardTitle}>주요 지출 카테고리</h3>
                            {summary.top_categories.map((cat, idx) => (
                                <div key={idx} style={styles.categoryItem}>
                                    <div style={styles.categoryHeader}>
                                        <span style={styles.categoryName}>{cat.category}</span>
                                        <span style={{ ...styles.categoryAmount, color: '#191F28' }}>{cat.amount?.toLocaleString()}원</span>
                                    </div>
                                    {cat.percentage && (
                                        <div style={styles.progressBar}>
                                            <div style={{ ...styles.progressFill, width: `${cat.percentage}%` }} />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            )}

            {/* 윤택지수 분석 섹션 */}
            {yuntaek_analysis && (
                <section style={styles.section}>
                    <h2 style={styles.sectionTitle}>🎯 윤택지수 분석</h2>
                    <div style={styles.card}>
                        <div style={styles.scoreHeader}>
                            <div>
                                <span style={styles.scoreLabel}>현재 점수</span>
                                <span style={styles.scoreValue}>{yuntaek_analysis.current_score}점</span>
                            </div>
                            {yuntaek_analysis.previous_score && (
                                <div style={{ textAlign: 'right' }}>
                                    <span style={styles.scoreLabel}>전월 점수</span>
                                    <span style={styles.prevScoreValue}>{yuntaek_analysis.previous_score}점</span>
                                </div>
                            )}
                        </div>
                        <p style={styles.scoreMessage}>{yuntaek_analysis.score_message}</p>

                        {yuntaek_analysis.factors && yuntaek_analysis.factors.length > 0 && (
                            <div style={{ marginTop: '24px' }}>
                                <h4 style={styles.subTitle}>세부 요소</h4>
                                {yuntaek_analysis.factors.map((factor, idx) => (
                                    <div key={idx} style={styles.factorItem}>
                                        <div style={styles.factorHeader}>
                                            <span style={styles.factorName}>{factor.name}</span>
                                            <span style={styles.factorScore}>{factor.current_score}/{factor.max_score}</span>
                                        </div>
                                        {factor.improvement_tip && (
                                            <p style={styles.tip}>💡 {factor.improvement_tip}</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </section>
            )}

            {/* 취약점 분석 */}
            {weakness_analysis && (
                <section style={styles.section}>
                    <h2 style={styles.sectionTitle}>⚠️ 개선 포인트</h2>

                    {weakness_analysis.impulse_spending && weakness_analysis.impulse_spending.items && (
                        <div style={styles.card}>
                            <h3 style={styles.cardTitle}>충동 소비</h3>
                            <p style={styles.weaknessTotal}>
                                총 {weakness_analysis.impulse_spending.total_amount?.toLocaleString()}원
                                ({weakness_analysis.impulse_spending.percentage_of_total}%)
                            </p>
                            {weakness_analysis.impulse_spending.items.map((item, idx) => (
                                <div key={idx} style={styles.weaknessItem}>
                                    <p style={styles.weaknessDesc}>{item.description}</p>
                                    <p style={styles.weaknessReason}>{item.reason}</p>
                                    <span style={styles.weaknessAmount}>{item.amount?.toLocaleString()}원</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {weakness_analysis.leakage_areas && weakness_analysis.leakage_areas.length > 0 && (
                        <div style={styles.card}>
                            <h3 style={styles.cardTitle}>누수 지출 패턴</h3>
                            {weakness_analysis.leakage_areas.map((area, idx) => (
                                <div key={idx} style={styles.leakageItem}>
                                    <h4 style={styles.leakagePattern}>{area.pattern}</h4>
                                    <p style={styles.leakageFreq}>빈도: {area.frequency}</p>
                                    <p style={styles.leakageAmount}>
                                        월 {area.monthly_total?.toLocaleString()}원
                                        (절약 가능: {area.potential_savings?.toLocaleString()}원)
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            )}

            {/* 다음 달 전략 */}
            {next_month_strategy && (
                <section style={styles.section}>
                    <h2 style={styles.sectionTitle}>📈 다음 달 전략</h2>

                    {next_month_strategy.priority_tasks && next_month_strategy.priority_tasks.length > 0 && (
                        <div style={styles.card}>
                            <h3 style={styles.cardTitle}>우선순위 과제</h3>
                            {next_month_strategy.priority_tasks.map((task, idx) => (
                                <div key={idx} style={styles.taskItem}>
                                    <h4 style={styles.taskTitle}>#{task.rank} {task.title}</h4>
                                    <p style={styles.taskState}>현재: {task.current_state}</p>
                                    <p style={styles.taskTarget}>목표: {task.target_state}</p>
                                    {task.action_steps && task.action_steps.length > 0 && (
                                        <ul style={styles.actionList}>
                                            {task.action_steps.map((step, i) => (
                                                <li key={i} style={styles.actionItem}>
                                                    <span style={styles.actionBullet}>•</span>
                                                    {step}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                    {task.expected_savings && (
                                        <p style={styles.savings}>예상 절약: {task.expected_savings?.toLocaleString()}원</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            )}

            {/* 전문가 요약 */}
            {expert_summary && (
                <section style={styles.section}>
                    <h2 style={styles.sectionTitle}>👨‍💼 전문가 의견</h2>
                    <div style={styles.expertCard}>
                        <p style={styles.expertText}>{expert_summary.overall_assessment}</p>
                        {expert_summary.key_achievement && (
                            <div style={styles.expertHighlight}>
                                <strong>주요 성과:</strong> {expert_summary.key_achievement}
                            </div>
                        )}
                        {expert_summary.key_improvement_area && (
                            <div style={styles.expertHighlight}>
                                <strong>개선 영역:</strong> {expert_summary.key_improvement_area}
                            </div>
                        )}
                        {expert_summary.professional_advice && (
                            <p style={styles.expertAdvice}>{expert_summary.professional_advice}</p>
                        )}
                    </div>
                </section>
            )}
        </div>
    );
}

const styles = {
    container: {
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
    },
    section: {
        marginBottom: '0px',
    },
    sectionTitle: {
        fontSize: '20px',
        fontWeight: '700',
        color: '#191F28',
        marginBottom: '16px',
        paddingLeft: '4px',
    },
    overview: {
        fontSize: '15px',
        lineHeight: '1.6',
        color: '#4E5968',
        marginBottom: '20px',
        paddingLeft: '4px',
    },
    card: {
        background: '#FFFFFF',
        borderRadius: '24px',
        padding: '24px',
        marginBottom: '16px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
    },
    cardTitle: {
        fontSize: '18px',
        fontWeight: '700',
        color: '#333D4B',
        marginBottom: '20px',
    },
    budgetGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '8px',
        marginBottom: '16px',
    },
    budgetItem: {
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        background: '#F9FAFB',
        padding: '12px 8px',
        borderRadius: '16px',
        alignItems: 'center',
        justifyContent: 'center',
    },
    budgetLabel: {
        fontSize: '12px',
        fontWeight: '600',
        color: '#8B95A1',
        whiteSpace: 'nowrap',
    },
    budgetValue: {
        fontSize: '15px',
        fontWeight: '700',
        color: '#191F28',
        whiteSpace: 'nowrap',
        letterSpacing: '-0.3px',
    },
    budgetMessage: {
        fontSize: '14px',
        color: '#4E5968',
        marginTop: '8px',
        padding: '12px',
        background: '#F2F4F6',
        borderRadius: '12px',
        textAlign: 'center',
    },
    categoryItem: {
        marginBottom: '16px',
    },
    categoryHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: '8px',
    },
    categoryName: {
        fontSize: '16px',
        fontWeight: '600',
        color: '#333D4B',
    },
    categoryAmount: {
        fontSize: '16px',
        fontWeight: '700',
        color: 'var(--primary, #14b8a6)',
    },
    progressBar: {
        width: '100%',
        height: '10px',
        background: '#F2F4F6',
        borderRadius: '5px',
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        background: 'var(--primary, #14b8a6)',
        borderRadius: '5px',
    },
    scoreHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px',
    },
    scoreLabel: {
        display: 'block',
        fontSize: '14px',
        fontWeight: '500',
        color: '#8B95A1',
        marginBottom: '4px',
    },
    scoreValue: {
        display: 'block',
        fontSize: '36px',
        fontWeight: '800',
        color: 'var(--primary, #14b8a6)',
    },
    prevScoreValue: {
        display: 'block',
        fontSize: '24px',
        fontWeight: '700',
        color: '#B0B8C1',
    },
    scoreMessage: {
        fontSize: '15px',
        color: '#4E5968',
        marginBottom: '20px',
        lineHeight: '1.5',
    },
    subTitle: {
        fontSize: '16px',
        fontWeight: '700',
        color: '#333D4B',
        marginBottom: '12px',
    },
    factorItem: {
        padding: '16px',
        background: '#F9FAFB',
        borderRadius: '16px',
        marginBottom: '12px',
    },
    factorHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '8px',
    },
    factorName: {
        fontSize: '15px',
        fontWeight: '600',
        color: '#333D4B',
    },
    factorScore: {
        fontSize: '15px',
        fontWeight: '700',
        color: 'var(--primary, #14b8a6)',
    },
    tip: {
        fontSize: '14px',
        color: '#4E5968',
        margin: 0,
        lineHeight: '1.5',
    },
    weaknessTotal: {
        fontSize: '18px',
        fontWeight: '700',
        color: '#F04452',
        marginBottom: '20px',
    },
    weaknessItem: {
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        padding: '16px',
        background: '#FFF4F4',
        borderRadius: '16px',
        marginBottom: '12px',
    },
    weaknessDesc: {
        fontSize: '16px',
        fontWeight: '600',
        color: '#191F28',
        margin: 0,
    },
    weaknessReason: {
        fontSize: '14px',
        color: '#8B95A1',
        margin: 0,
    },
    weaknessAmount: {
        fontSize: '16px',
        fontWeight: '700',
        color: '#F04452',
        marginTop: '4px',
    },
    leakageItem: {
        padding: '16px',
        background: '#F9FAFB',
        borderRadius: '16px',
        marginBottom: '12px',
        display: 'flex',
        flexDirection: 'column',
    },
    leakagePattern: {
        fontSize: '16px',
        fontWeight: '600',
        color: '#333D4B',
        margin: '0 0 8px 0',
    },
    leakageFreq: {
        fontSize: '14px',
        color: '#8B95A1',
        margin: '0 0 4px 0',
    },
    leakageAmount: {
        fontSize: '15px',
        fontWeight: '600',
        color: '#F04452',
        margin: 0,
    },
    taskItem: {
        padding: '20px',
        background: '#F9FAFB',
        borderRadius: '16px',
        marginBottom: '16px',
    },
    taskTitle: {
        fontSize: '16px',
        fontWeight: '700',
        color: '#191F28',
        margin: '0 0 12px 0',
    },
    taskState: {
        fontSize: '14px',
        color: '#8B95A1',
        margin: '0 0 4px 0',
    },
    taskTarget: {
        fontSize: '14px',
        color: 'var(--primary, #14b8a6)',
        fontWeight: '600',
        margin: '0 0 12px 0',
    },
    actionList: {
        listStyle: 'none',
        padding: 0,
        margin: '12px 0',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
    },
    actionItem: {
        fontSize: '14px',
        color: '#4E5968',
        display: 'flex',
        alignItems: 'flex-start',
        lineHeight: '1.5',
    },
    actionBullet: {
        color: 'var(--primary, #14b8a6)',
        fontWeight: 'bold',
        marginRight: '8px',
    },
    savings: {
        fontSize: '15px',
        fontWeight: '700',
        color: 'var(--primary, #14b8a6)',
        margin: '12px 0 0 0',
        padding: '12px 16px',
        background: '#f0fdfa', // tailwind teal-50
        borderRadius: '12px',
        display: 'inline-block',
    },
    expertCard: {
        background: '#F9FAFB',
        color: '#191F28',
        borderRadius: '24px',
        padding: '24px',
        border: '1px solid #E5E8EB',
    },
    expertText: {
        fontSize: '16px',
        lineHeight: '1.6',
        marginBottom: '20px',
        fontWeight: '500',
    },
    expertHighlight: {
        background: '#FFFFFF',
        padding: '16px',
        borderRadius: '16px',
        marginBottom: '12px',
        fontSize: '15px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
    },
    expertAdvice: {
        fontSize: '15px',
        color: 'var(--primary, #14b8a6)',
        fontWeight: '600',
        paddingTop: '16px',
        marginTop: '16px',
        borderTop: '1px solid #E5E8EB',
        lineHeight: '1.5',
    },
};

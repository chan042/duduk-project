import React from 'react';
import { CheckCircle, XCircle } from 'lucide-react';
import TransactionItem from './TransactionItem';
import styles from './expense.module.css';

export default function CalendarView({
    transactions = [],
    dailyStatus = {},
    selectedDate,
    onDateClick,
    onTransactionClick,
    currentYear,
    currentMonth,
    successDays = 0,
    failDays = 0,
    dailyBudget = 0
}) {
    // 해당 월의 일수 계산
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    // 해당 월 1일의 요일 (0: 일요일)
    const firstDayOfMonth = new Date(currentYear, currentMonth - 1, 1).getDay();

    // ISO 형식 날짜에서 일(day) 추출
    const parseDateToDay = (dateStr) => {
        const date = new Date(dateStr);
        return date.getDate();
    };

    // 특정 일의 거래 내역 조회
    const getTransactionsForDay = (day) => {
        return transactions.filter(t => parseDateToDay(t.date) === day);
    };

    // 특정 일의 지출 합계
    const getDayTotal = (day) => {
        const dayTrans = getTransactionsForDay(day);
        return dayTrans.reduce((sum, t) => sum + t.amount, 0);
    };

    // dailyStatus에서 해당 날짜의 상태 조회
    const getDayStatus = (day) => {
        const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return dailyStatus[dateStr] || null;
    };

    const getDayContent = (day) => {
        const status = getDayStatus(day);
        if (!status) return null;

        const total = status.total_spent || 0;
        if (total === 0) return null;

        let emoji = '😊';
        let level = 'green';

        // 백엔드에서 받은 status 값으로 판단
        switch (status.status) {
            case 'money':
                emoji = '💰';
                level = 'green';
                break;
            case 'happy':
                emoji = '😊';
                level = 'green';
                break;
            case 'sad':
                emoji = '😥';
                level = 'yellow';
                break;
            case 'angry':
                emoji = '😡';
                level = 'red';
                break;
            default:
                emoji = '😊';
                level = 'green';
        }

        return { emoji, amount: total.toLocaleString(), level };
    };

    const getSpendingClass = (level) => {
        if (level === 'green') return styles.spendingLevelGreen;
        if (level === 'red') return styles.spendingLevelRed;
        if (level === 'yellow') return styles.spendingLevelYellow;
        return '';
    };

    // 선택된 날짜의 거래 내역
    const selectedDayTransactions = selectedDate ? getTransactionsForDay(selectedDate) : [];
    const selectedDayTotal = selectedDate ? getDayTotal(selectedDate) : 0;
    const selectedDateStr = selectedDate ? `${currentMonth}월 ${selectedDate}일` : '';

    return (
        <div className={styles.calendarWrapper}>
            <div className={styles.calendarGrid}>
                {['일', '월', '화', '수', '목', '금', '토'].map(d => (
                    <div key={d} className={styles.weekDay}>{d}</div>
                ))}

                {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                    <div key={`empty-${i}`} className={styles.calendarDay} />
                ))}

                {days.map(day => {
                    const content = getDayContent(day);
                    const isSelected = day === selectedDate;

                    return (
                        <div
                            key={day}
                            className={`${styles.calendarDay} ${content ? getSpendingClass(content.level) : ''} ${isSelected ? styles.selectedDay : ''}`}
                            onClick={() => onDateClick(day)}
                            style={{ cursor: 'pointer' }}
                        >
                            <span className={styles.dayNumber}>{day}</span>
                            {content && (
                                <>
                                    <span className={styles.dayEmoji}>{content.emoji}</span>
                                    <span className={styles.dayAmount}>{content.amount}</span>
                                </>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* 선택된 날짜의 거래 내역 표시 */}
            {selectedDate && selectedDayTransactions.length > 0 && (
                <div className={styles.dateGroup}>
                    <div className={styles.dateHeaderRow}>
                        <span className={styles.dateText}>{selectedDateStr}</span>
                        <div className={styles.dateMeta}>
                            <span className={styles.dateBudgetInfo}>일일 권장 예산 {dailyBudget.toLocaleString()}원</span>
                            <span className={styles.dateTotalAmount}>-{selectedDayTotal.toLocaleString()}원</span>
                        </div>
                    </div>
                    <div className={styles.dayCard}>
                        {selectedDayTransactions.map((transaction, index) => (
                            <TransactionItem
                                key={transaction.id}
                                transaction={transaction}
                                onClick={onTransactionClick}
                                isLast={index === selectedDayTransactions.length - 1}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Insight 카드: 성공/실패 일수만 표시 */}
            <div className={styles.insightRow}>
                <div className={styles.insightCard}>
                    <div className={styles.insightIcon} style={{ backgroundColor: '#e6fffa', color: '#2f855a' }}>
                        <CheckCircle size={16} />
                    </div>
                    <div className={styles.insightContent}>
                        <h4>목표 달성</h4>
                        <p><span className={styles.insightHighlight}>{successDays}일</span></p>
                    </div>
                </div>
                <div className={styles.insightCard}>
                    <div className={styles.insightIcon} style={{ backgroundColor: '#fff5f5', color: '#c53030' }}>
                        <XCircle size={16} />
                    </div>
                    <div className={styles.insightContent}>
                        <h4>지출 초과</h4>
                        <p><span className={styles.insightWarning}>{failDays}일</span></p>
                    </div>
                </div>
            </div>
        </div>
    );
}

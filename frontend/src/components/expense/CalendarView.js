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

    // 오늘 날짜 계산
    const today = new Date();
    const isCurrentMonth = today.getFullYear() === currentYear && (today.getMonth() + 1) === currentMonth;
    const todayDate = today.getDate();

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

        let total = 0;
        let emoji = '😊';
        let level = 'green';

        if (status) {
            total = status.total_spent || 0;
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
                    // status가 있지만 구체적인 상태가 없는 경우
                    if (total === 0) {
                        emoji = '�';
                        level = 'green';
                    } else {
                        emoji = '�😊';
                        level = 'green';
                    }
            }
        } else {
            // status 정보가 없는 경우 (지출이 아예 없는 날 등)
            // 과거 날짜이면서 지출이 없으면 money(초록) 처리
            // 미래 날짜는 표시 안 함
            if (isCurrentMonth && day < todayDate) {
                emoji = '💰';
                level = 'green';
                return { emoji, amount: '0', level }; // 지출 0원 표시
            } else if (!isCurrentMonth && new Date(currentYear, currentMonth - 1, day) < today) {
                // 지난 달인 경우 모든 날짜에 대해 체크
                emoji = '💰';
                level = 'green';
                return { emoji, amount: '0', level };
            }

            return null; // 미래 날짜거나 오늘인데 지출 없으면 빈칸
        }

        if (total === 0 && emoji !== '💰') return null; // 지출 0원인데 money 상태 아니면 표시 X

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

    // 선택된 날짜의 일일 권장 예산 (dailyStatus에서 해당 날짜의 값 사용)
    const getSelectedDayBudget = () => {
        if (!selectedDate) return dailyBudget;
        const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(selectedDate).padStart(2, '0')}`;
        const status = dailyStatus[dateStr];
        // 해당 날짜의 스냅샷 값이 있으면 사용, 없으면 dailyBudget 사용
        return status?.daily_budget ?? dailyBudget;
    };
    const selectedDayBudget = getSelectedDayBudget();

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

            {/* 지출 내역 BottomSheet로 표시 */}
            <BottomSheet
                isOpen={!!selectedDate}
                onClose={() => onDateClick(null)}
            >
                <div className={styles.dateGroup} style={{ marginBottom: 0 }}>
                    <div className={styles.dateHeaderRow}>
                        <span className={styles.dateText}>{selectedDateStr}</span>
                        <div className={styles.dateMeta}>
                            <span className={styles.dateBudgetInfo}>일일 권장 예산 {selectedDayBudget.toLocaleString()}원</span>
                            <span className={styles.dateTotalAmount}>-{selectedDayTotal.toLocaleString()}원</span>
                        </div>
                    </div>
                    <div className={styles.dayCard} style={{ boxShadow: 'none', padding: 0 }}>
                        {selectedDayTransactions.length > 0 ? (
                            selectedDayTransactions.map((transaction, index) => (
                                <TransactionItem
                                    key={transaction.id}
                                    transaction={transaction}
                                    onClick={onTransactionClick}
                                    isLast={index === selectedDayTransactions.length - 1}
                                />
                            ))
                        ) : (
                            <div className={styles.emptyState} style={{ padding: '2rem 0' }}>
                                지출 내역이 없습니다.
                            </div>
                        )}
                    </div>
                </div>
            </BottomSheet>
        </div>
    );
}

import BottomSheet from './BottomSheet';

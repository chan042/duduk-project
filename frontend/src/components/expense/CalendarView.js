import React from 'react';
import { CheckCircle, XCircle } from 'lucide-react';
import Image from 'next/image';
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
    dailyBudget = 0,
    characterType = 'char_cat',
    dateJoined = null,
    onConfirmNoSpending = null // 무지출 확인 콜백 함수
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

    // 가입일 파싱
    const joinedDate = dateJoined ? new Date(dateJoined) : null;

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

    // 해당 날짜가 과거인지 확인
    const isPastDate = (day) => {
        const checkDate = new Date(currentYear, currentMonth - 1, day);
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        return checkDate < todayStart;
    };

    // status에 따라 face 이미지 경로 반환
    const getFaceImage = (status) => {
        const basePath = `/images/characters/${characterType}`;
        switch (status) {
            case 'money':
                return `${basePath}/face_money.png`;
            case 'happy':
                return `${basePath}/face_happy.png`;
            case 'sad':
                return `${basePath}/face_sad.png`;
            case 'angry':
                return `${basePath}/face_angry.png`;
            default:
                return `${basePath}/face_money.png`;
        }
    };

    const getDayContent = (day) => {
        const status = getDayStatus(day);

        // status가 없으면 상태 표시 안 함
        if (!status) {
            return null;
        }

        const total = status.total_spent || 0;
        let faceStatus = status.status || 'money';
        let level = 'green';

        switch (faceStatus) {
            case 'money':
            case 'happy':
                level = 'green';
                break;
            case 'sad':
                level = 'yellow';
                break;
            case 'angry':
                level = 'red';
                break;
            default:
                level = 'green';
        }

        return { faceStatus, amount: total.toLocaleString(), level };
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

    // 선택된 날짜가 무지출 확인이 필요한지 체크
    const needsNoSpendingConfirm = () => {
        if (!selectedDate) return false;
        const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(selectedDate).padStart(2, '0')}`;
        const hasTransactions = selectedDayTransactions.length > 0;
        const hasStatus = !!dailyStatus[dateStr];
        const isPast = isPastDate(selectedDate);

        // 과거 날짜이면서 지출 내역이 없고 상태도 없는 경우 무지출 확인 필요
        return isPast && !hasTransactions && !hasStatus;
    };

    // 무지출 확인 핸들러
    const handleConfirmNoSpending = () => {
        if (onConfirmNoSpending && selectedDate) {
            const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(selectedDate).padStart(2, '0')}`;
            onConfirmNoSpending(dateStr);
        }
    };

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
                                    <div className={styles.dayFaceImage}>
                                        <Image
                                            src={getFaceImage(content.faceStatus)}
                                            alt={content.faceStatus}
                                            width={24}
                                            height={24}
                                            style={{ objectFit: 'contain' }}
                                        />
                                    </div>
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
                        ) : needsNoSpendingConfirm() ? (
                            <div className={styles.noSpendingConfirm}>
                                <p>이 날은 무지출인가요?</p>
                                <button
                                    className={styles.noSpendingButton}
                                    onClick={handleConfirmNoSpending}
                                >
                                    무지출 확인
                                </button>
                            </div>
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

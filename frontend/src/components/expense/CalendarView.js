"use client";

import React, { useEffect, useRef } from 'react';
import { CheckCircle, XCircle } from 'lucide-react';
import Image from 'next/image';
import BottomSheet from './BottomSheet';
import TransactionItem from './TransactionItem';
import styles from './expense.module.css';

const SWIPE_LOCK_THRESHOLD = 10;
const SWIPE_CHANGE_THRESHOLD = 50;

export default function CalendarView({
    transactions = [],
    dailyStatus = {},
    selectedDate,
    onDateClick,
    onPrevMonth = null,
    onNextMonth = null,
    onTransactionClick,
    currentYear,
    currentMonth,
    successDays = 0,
    failDays = 0,
    dailyBudget = 0,
    characterType = 'char_cat',
    onConfirmNoSpending = null,
    onQuickAddClick = null
}) {
    const touchStartRef = useRef(null);
    const touchDeltaRef = useRef({ x: 0, y: 0 });
    const isHorizontalGestureRef = useRef(false);
    const suppressClickRef = useRef(false);
    const suppressClickTimeoutRef = useRef(null);

    useEffect(() => {
        return () => {
            if (suppressClickTimeoutRef.current) {
                window.clearTimeout(suppressClickTimeoutRef.current);
            }
        };
    }, []);

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
        return transactions.filter((transaction) => parseDateToDay(transaction.date) === day);
    };

    // 특정 일의 지출 합계
    const getDayTotal = (day) => {
        const dayTransactions = getTransactionsForDay(day);
        return dayTransactions.reduce((sum, transaction) => sum + transaction.amount, 0);
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
                faceStatus = 'money';
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

    const selectedDayTransactions = selectedDate ? getTransactionsForDay(selectedDate) : [];
    const selectedDayTotal = selectedDate ? getDayTotal(selectedDate) : 0;
    const selectedDateStr = selectedDate ? `${currentMonth}월 ${selectedDate}일` : '';

    // 선택된 날짜의 일일 권장 예산 (dailyStatus에서 해당 날짜의 값 사용)
    const getSelectedDayBudget = () => {
        if (!selectedDate) return dailyBudget;
        const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(selectedDate).padStart(2, '0')}`;
        const status = dailyStatus[dateStr];
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

        return isPast && !hasTransactions && !hasStatus;
    };

    const handleConfirmNoSpending = () => {
        if (onConfirmNoSpending && selectedDate) {
            const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(selectedDate).padStart(2, '0')}`;
            onConfirmNoSpending(dateStr);
        }
    };

    const resetTouchState = () => {
        touchStartRef.current = null;
        touchDeltaRef.current = { x: 0, y: 0 };
        isHorizontalGestureRef.current = false;
    };

    const scheduleClickReset = () => {
        if (suppressClickTimeoutRef.current) {
            window.clearTimeout(suppressClickTimeoutRef.current);
        }

        suppressClickTimeoutRef.current = window.setTimeout(() => {
            suppressClickRef.current = false;
            suppressClickTimeoutRef.current = null;
        }, 250);
    };

    const handleCalendarTouchStart = (event) => {
        const touch = event.touches[0];
        touchStartRef.current = {
            x: touch.clientX,
            y: touch.clientY
        };
        touchDeltaRef.current = { x: 0, y: 0 };
        isHorizontalGestureRef.current = false;
    };

    const handleCalendarTouchMove = (event) => {
        if (!touchStartRef.current) {
            return;
        }

        const touch = event.touches[0];
        const deltaX = touch.clientX - touchStartRef.current.x;
        const deltaY = touch.clientY - touchStartRef.current.y;

        touchDeltaRef.current = { x: deltaX, y: deltaY };

        if (Math.abs(deltaX) > SWIPE_LOCK_THRESHOLD && Math.abs(deltaX) > Math.abs(deltaY)) {
            isHorizontalGestureRef.current = true;
            event.preventDefault();
        }
    };

    const handleCalendarTouchEnd = () => {
        if (!touchStartRef.current) {
            return;
        }

        const { x: deltaX, y: deltaY } = touchDeltaRef.current;
        const wasHorizontalGesture = isHorizontalGestureRef.current;
        const shouldChangeMonth =
            wasHorizontalGesture &&
            Math.abs(deltaX) >= SWIPE_CHANGE_THRESHOLD &&
            Math.abs(deltaX) > Math.abs(deltaY);

        if (wasHorizontalGesture) {
            suppressClickRef.current = true;
            scheduleClickReset();
        }

        if (shouldChangeMonth) {
            if (deltaX < 0) {
                onNextMonth?.();
            } else {
                onPrevMonth?.();
            }
        }

        resetTouchState();
    };

    const handleDayClick = (day) => {
        if (suppressClickRef.current) {
            suppressClickRef.current = false;

            if (suppressClickTimeoutRef.current) {
                window.clearTimeout(suppressClickTimeoutRef.current);
                suppressClickTimeoutRef.current = null;
            }

            return;
        }

        onDateClick?.(day);
    };

    return (
        <div className={styles.calendarWrapper}>
            <div className={styles.calendarGrid}>
                <div className={styles.calendarWeekdays}>
                    {['일', '월', '화', '수', '목', '금', '토'].map((dayLabel) => (
                        <div key={dayLabel} className={styles.weekDay}>{dayLabel}</div>
                    ))}
                </div>

                <div
                    className={styles.calendarSwipeArea}
                    onTouchStart={handleCalendarTouchStart}
                    onTouchMove={handleCalendarTouchMove}
                    onTouchEnd={handleCalendarTouchEnd}
                    onTouchCancel={resetTouchState}
                >
                    <div className={styles.calendarDaysGrid}>
                        {Array.from({ length: firstDayOfMonth }).map((_, index) => (
                            <div key={`empty-${index}`} className={styles.calendarDay} />
                        ))}

                        {days.map((day) => {
                            const content = getDayContent(day);
                            const isSelected = day === selectedDate;
                            const isToday = isCurrentMonth && day === todayDate;

                            return (
                                <div
                                    key={day}
                                    className={`${styles.calendarDay} ${content ? getSpendingClass(content.level) : ''} ${isSelected ? styles.selectedDay : ''}`}
                                    onClick={() => handleDayClick(day)}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <span className={`${styles.dayNumber} ${isToday ? styles.todayNumber : ''}`}>{day}</span>
                                    <div className={styles.dayFaceImage}>
                                        {content ? (
                                            <Image
                                                src={getFaceImage(content.faceStatus)}
                                                alt={content.faceStatus}
                                                width={32}
                                                height={32}
                                                style={{ objectFit: 'contain' }}
                                            />
                                        ) : (
                                            <div style={{ width: 32, height: 32 }} />
                                        )}
                                    </div>
                                    <span
                                        className={styles.dayAmount}
                                        style={{ visibility: content ? 'visible' : 'hidden' }}
                                    >
                                        {content ? content.amount : '0'}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className={styles.insightRow}>
                {/* 일일 권장 예산 카드 (좌측 절반) */}
                <div className={styles.insightCard} style={{ justifyContent: 'center' }}>
                    <h4 className={styles.insightTitle}>일일 권장 예산</h4>
                    {Number(dailyBudget) < 0 ? (
                        <span className={styles.insightWarningLarge}>
                            예산 초과<br />
                            {Math.abs(Number(dailyBudget)).toLocaleString()}원
                        </span>
                    ) : (
                        <span className={styles.insightHighlightLarge}>{Number(dailyBudget).toLocaleString()}원</span>
                    )}
                </div>

                {/* 성공 여부 카드 (우측 절반) */}
                <div className={styles.insightCard}>
                    <div className={styles.insightItem}>
                        <h4 className={styles.insightTitle}>목표 달성</h4>
                        <span className={styles.insightHighlight}>{successDays}일</span>
                    </div>

                    <div className={styles.insightHorizontalSeparator}></div>

                    <div className={styles.insightItem}>
                        <h4 className={styles.insightTitle}>권장 예산 초과</h4>
                        <span className={styles.insightWarning}>{failDays}일</span>
                    </div>
                </div>
            </div>

            <BottomSheet
                isOpen={!!selectedDate}
                onClose={() => onDateClick(null)}
            >
                <div className={styles.dateGroup} style={{ marginBottom: 0 }}>
                    <div className={styles.dateHeaderRow}>
                        <span className={styles.dateText}>{selectedDateStr}</span>
                        <div className={styles.dateMeta}>
                            {Number(selectedDayBudget) < 0 ? (
                                <span className={styles.dateBudgetWarning}>예산 초과 ({Math.abs(Number(selectedDayBudget)).toLocaleString()}원)</span>
                            ) : (
                                <span className={styles.dateBudgetInfo}>일일 권장 예산 {Number(selectedDayBudget).toLocaleString()}원</span>
                            )}
                            <span className={styles.dateTotalAmount}>-{selectedDayTotal.toLocaleString()}원</span>
                        </div>
                    </div>
                    <div className={styles.bottomSheetCard}>
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
                            <div className={styles.noSpendingConfirm} style={{ marginTop: 0, backgroundColor: 'transparent' }}>
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

                    {onQuickAddClick && (
                        <button
                            className={styles.quickAddButton}
                            onClick={onQuickAddClick}
                        >
                            <span className={styles.quickAddIcon}>+</span>
                            <span>지출 추가하기</span>
                        </button>
                    )}
                </div>
            </BottomSheet>
        </div>
    );
}

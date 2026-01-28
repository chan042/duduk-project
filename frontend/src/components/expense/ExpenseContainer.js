"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import ViewToggle from './ViewToggle';
import ListView from './ListView';
import CalendarView from './CalendarView';
import ExpenseModal from './ExpenseModal';
import QuickAddPopup from '@/components/home/QuickAddPopup';
import styles from './expense.module.css';
import { getTransactionsByMonth, getMonthlyAnalysis, updateTransaction, deleteTransaction, confirmNoSpending } from '@/lib/api/transaction';
import { getProfile } from '@/lib/api/auth';

export default function ExpenseContainer() {
    const searchParams = useSearchParams();
    const initialView = searchParams.get('view') === 'list' ? 'list' : 'calendar';
    const [viewMode, setViewMode] = useState(initialView);

    // URL 파라미터가 변경되면 뷰 모드 업데이트
    useEffect(() => {
        const viewOverride = searchParams.get('view');
        if (viewOverride === 'list') {
            setViewMode('list');
        } else if (viewOverride === 'calendar') {
            setViewMode('calendar');
        }
    }, [searchParams]);

    const [selectedTransaction, setSelectedTransaction] = useState(null);
    const [selectedDate, setSelectedDate] = useState(null);
    const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
    const [selectedDateForQuickAdd, setSelectedDateForQuickAdd] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [dailyStatus, setDailyStatus] = useState({});
    const [loading, setLoading] = useState(true);

    // 현재 날짜 기준으로 년/월 설정
    const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
    const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);

    const [monthlyStats, setMonthlyStats] = useState({
        totalSpent: 0,
        successDays: 0,
        failDays: 0
    });
    const [dailyBudget, setDailyBudget] = useState(0);
    const [characterType, setCharacterType] = useState('char_cat');
    const [dateJoined, setDateJoined] = useState(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            // 지출 내역 조회
            const transactionData = await getTransactionsByMonth(currentYear, currentMonth);

            // 백엔드 필드를 프론트엔드 형식으로 변환
            const formatted = transactionData.transactions.map(t => ({
                id: t.id,
                date: t.date,
                merchant: t.store || t.item,
                category: t.category,
                amount: t.amount,
                memo: t.memo,
                is_fixed: t.is_fixed,
                address: t.address || ''
            }));

            setTransactions(formatted);
            setDailyStatus(transactionData.daily_status || {});
            setDailyBudget(transactionData.daily_budget || 0);

            // 월간 분석 조회
            const analysisData = await getMonthlyAnalysis(currentYear, currentMonth);
            setMonthlyStats({
                totalSpent: analysisData.total_spent || 0,
                successDays: analysisData.success_days || 0,
                failDays: analysisData.fail_days || 0
            });

            // 사용자 프로필에서 캐릭터 타입 및 가입일 조회
            try {
                const profile = await getProfile();
                if (profile.character_type) {
                    setCharacterType(profile.character_type);
                }
                if (profile.date_joined) {
                    setDateJoined(profile.date_joined);
                }
            } catch (err) {
                console.log('Profile fetch failed, using default character');
            }

        } catch (error) {
            console.error('Failed to fetch data:', error);
        } finally {
            setLoading(false);
        }
    }, [currentYear, currentMonth]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // 이전 월로 이동
    const goToPrevMonth = () => {
        if (currentMonth === 1) {
            setCurrentYear(currentYear - 1);
            setCurrentMonth(12);
        } else {
            setCurrentMonth(currentMonth - 1);
        }
        setSelectedDate(null);
    };

    const handleDateClick = (day) => {
        if (selectedDate === day) {
            setSelectedDate(null);
        } else {
            setSelectedDate(day);
        }
    };

    // 다음 월로 이동
    const goToNextMonth = () => {
        if (currentMonth === 12) {
            setCurrentYear(currentYear + 1);
            setCurrentMonth(1);
        } else {
            setCurrentMonth(currentMonth + 1);
        }
        setSelectedDate(null);
    };

    // 메모 업데이트 핸들러
    const handleUpdateTransaction = async (transactionId, updateData) => {
        try {
            await updateTransaction(transactionId, updateData);
            // 업데이트 후 데이터 새로고침
            fetchData();
        } catch (error) {
            console.error('Failed to update transaction:', error);
            alert('수정에 실패했습니다.');
        }
    };

    // 삭제 핸들러
    const handleDeleteTransaction = async (transactionId) => {
        try {
            await deleteTransaction(transactionId);
            // 삭제 후 데이터 새로고침
            fetchData();
        } catch (error) {
            console.error('Failed to delete transaction:', error);
            alert('삭제에 실패했습니다.');
        }
    };

    // 무지출 확인 핸들러
    const handleConfirmNoSpending = async (dateStr) => {
        try {
            await confirmNoSpending(dateStr);
            // 확인 후 데이터 새로고침
            fetchData();
        } catch (error) {
            console.error('Failed to confirm no spending:', error);
            alert('무지출 확인에 실패했습니다.');
        }
    };

    // QuickAdd 팝업 열기 핸들러
    const handleQuickAddClick = () => {
        // 선택된 날짜를 별도 상태로 저장
        if (selectedDate) {
            const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(selectedDate).padStart(2, '0')}`;
            setSelectedDateForQuickAdd(dateStr);
        }
        setSelectedDate(null); // BottomSheet 닫기
        setIsQuickAddOpen(true);
    };

    // QuickAdd 팝업 닫기 핸들러
    const handleQuickAddClose = () => {
        setIsQuickAddOpen(false);
        setSelectedDateForQuickAdd(null);
    };

    // QuickAdd에서 거래 추가 후 핸들러
    const handleTransactionAdded = () => {
        fetchData(); // 데이터 새로고침
        setSelectedDate(null); // 선택된 날짜 초기화
        setSelectedDateForQuickAdd(null); // QuickAdd용 날짜도 초기화
    };

    return (
        <div className={styles.container}>
            <div className={styles.headerCard}>
                <div className={styles.monthSelector}>
                    <button onClick={goToPrevMonth} className={styles.monthNavButton}>
                        <ChevronLeft size={24} />
                    </button>
                    <span className={styles.monthTitle}>{currentYear}년 {currentMonth}월</span>
                    <button onClick={goToNextMonth} className={styles.monthNavButton}>
                        <ChevronRight size={24} />
                    </button>
                </div>

                <div className={styles.dashboardSummary}>
                    <span className={styles.totalLabel}>이번 달 총 지출</span>
                    <span className={styles.totalAmountLarge}>{monthlyStats.totalSpent.toLocaleString()}원</span>
                </div>

                <div className={styles.budgetStatusRow}>
                    {Number(dailyBudget) < 0 ? (
                        <div className={styles.budgetPillWarning}>
                            예산 초과 {Math.abs(Number(dailyBudget)).toLocaleString()}원
                        </div>
                    ) : (
                        <div className={styles.budgetPillNormal}>
                            일일 예산 {Number(dailyBudget).toLocaleString()}원
                        </div>
                    )}
                    <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
                </div>
            </div>

            {loading ? (
                <div className={styles.loadingContainer}>로딩 중...</div>
            ) : viewMode === 'list' ? (
                <div className={styles.listViewWrapper}>
                    <ListView
                        transactions={transactions}
                        onTransactionClick={setSelectedTransaction}
                        currentYear={currentYear}
                        currentMonth={currentMonth}
                    />
                </div>
            ) : (
                <CalendarView
                    transactions={transactions}
                    dailyStatus={dailyStatus}
                    selectedDate={selectedDate}
                    onDateClick={handleDateClick}
                    onTransactionClick={setSelectedTransaction}
                    currentYear={currentYear}
                    currentMonth={currentMonth}
                    successDays={monthlyStats.successDays}
                    failDays={monthlyStats.failDays}
                    dailyBudget={dailyBudget}
                    characterType={characterType}
                    dateJoined={dateJoined}
                    onConfirmNoSpending={handleConfirmNoSpending}
                    onQuickAddClick={handleQuickAddClick}
                />
            )}

            <ExpenseModal
                isOpen={!!selectedTransaction}
                onClose={() => setSelectedTransaction(null)}
                transaction={selectedTransaction}
                onUpdate={handleUpdateTransaction}
                onDelete={handleDeleteTransaction}
            />

            {isQuickAddOpen && (
                <QuickAddPopup
                    onClose={handleQuickAddClose}
                    onTransactionAdded={handleTransactionAdded}
                    selectedDate={selectedDateForQuickAdd}
                />
            )}
        </div>
    );
}

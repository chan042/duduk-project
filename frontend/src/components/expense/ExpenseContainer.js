"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import ViewToggle from './ViewToggle';
import ListView from './ListView';
import CalendarView from './CalendarView';
import ExpenseModal from './ExpenseModal';
import styles from './expense.module.css';
import { getTransactionsByMonth, getMonthlyAnalysis, updateTransaction, deleteTransaction } from '@/lib/api/transaction';

export default function ExpenseContainer() {
    const [viewMode, setViewMode] = useState('list');
    const [selectedTransaction, setSelectedTransaction] = useState(null);
    const [selectedDate, setSelectedDate] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [dailyStatus, setDailyStatus] = useState({});
    const [loading, setLoading] = useState(true);

    // 현재 날짜 기준으로 년/월 설정
    const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
    const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);

    // 월간 통계
    const [monthlyStats, setMonthlyStats] = useState({
        totalSpent: 0,
        successDays: 0,
        failDays: 0
    });
    const [dailyBudget, setDailyBudget] = useState(0);

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
                is_fixed: t.is_fixed
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

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.monthSelector}>
                    <button onClick={goToPrevMonth} className={styles.monthNavButton}>
                        <ChevronLeft size={20} />
                    </button>
                    <span>{currentYear}년 {currentMonth}월</span>
                    <button onClick={goToNextMonth} className={styles.monthNavButton}>
                        <ChevronRight size={20} />
                    </button>
                </div>
                <div className={styles.headerSummary}>
                    <div><span className={styles.totalLabel}>지출</span> <span className={styles.totalAmount}>{monthlyStats.totalSpent.toLocaleString()}원</span></div>
                </div>
            </header>

            <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />

            {loading ? (
                <div className={styles.loadingContainer}>로딩 중...</div>
            ) : viewMode === 'list' ? (
                <ListView
                    transactions={transactions}
                    onTransactionClick={setSelectedTransaction}
                    currentYear={currentYear}
                    currentMonth={currentMonth}
                />
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
                />
            )}

            <ExpenseModal
                isOpen={!!selectedTransaction}
                onClose={() => setSelectedTransaction(null)}
                transaction={selectedTransaction}
                onUpdate={handleUpdateTransaction}
                onDelete={handleDeleteTransaction}
            />
        </div>
    );
}

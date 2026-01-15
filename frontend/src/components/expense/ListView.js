import React from 'react';
import TransactionItem from './TransactionItem';
import styles from './expense.module.css';

export default function ListView({ transactions, onTransactionClick, currentYear, currentMonth }) {
    // 날짜를 한국어 형식으로 변환
    const formatDateKorean = (dateStr) => {
        const date = new Date(dateStr);
        return `${date.getMonth() + 1}월 ${date.getDate()}일`;
    };

    // 날짜별로 거래 그룹화
    const groupedTransactions = transactions.reduce((acc, transaction) => {
        // ISO 형식 날짜에서 날짜 부분만 추출 (YYYY-MM-DD)
        const dateKey = transaction.date.split('T')[0];
        if (!acc[dateKey]) {
            acc[dateKey] = [];
        }
        acc[dateKey].push(transaction);
        return acc;
    }, {});

    // 날짜 정렬 (최신순)
    const sortedDates = Object.keys(groupedTransactions).sort((a, b) =>
        new Date(b).getTime() - new Date(a).getTime()
    );

    if (transactions.length === 0) {
        return (
            <div className={styles.emptyState}>
                <p>이번 달 지출 내역이 없습니다.</p>
            </div>
        );
    }

    return (
        <div>
            {sortedDates.map(date => {
                const dayTransactions = groupedTransactions[date];
                const dayTotal = dayTransactions.reduce((sum, t) => sum + t.amount, 0);

                return (
                    <div key={date} className={styles.dateGroup}>
                        <div className={styles.dateHeaderRow}>
                            <span className={styles.dateText}>{formatDateKorean(date)}</span>
                            <span className={styles.dateTotalAmount}>-{dayTotal.toLocaleString()}원</span>
                        </div>
                        <div className={styles.dayCard}>
                            {dayTransactions.map((transaction, index) => (
                                <TransactionItem
                                    key={transaction.id}
                                    transaction={transaction}
                                    onClick={onTransactionClick}
                                    isLast={index === dayTransactions.length - 1}
                                />
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

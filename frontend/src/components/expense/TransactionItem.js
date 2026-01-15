import React from 'react';
import { Utensils, Coffee, ShoppingBag, Bus, AlertCircle } from 'lucide-react';
import styles from './expense.module.css';

const getIcon = (category) => {
    switch (category) {
        case '식비': return <Utensils size={20} />;
        case '카페': return <Coffee size={20} />;
        case '쇼핑': return <ShoppingBag size={20} />;
        case '교통': return <Bus size={20} />;
        default: return <AlertCircle size={20} />;
    }
};

const truncateMemo = (memo, maxLength = 8) => {
    if (!memo) return '';
    if (memo.length <= maxLength) return memo;
    return memo.substring(0, maxLength) + '...';
};

export default function TransactionItem({ transaction, onClick, isLast }) {
    const displayMemo = transaction.memo || '';

    return (
        <div
            className={`${styles.transactionRow} ${isLast ? '' : styles.transactionRowBorder}`}
            onClick={() => onClick(transaction)}
        >
            <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                <div className={styles.transactionIcon}>
                    {getIcon(transaction.category)}
                </div>
                <div className={styles.transactionInfo}>
                    <span className={styles.merchantName}>{transaction.merchant}</span>
                    <span className={styles.categoryName}>
                        {transaction.category}
                        {displayMemo && (
                            <> | {truncateMemo(displayMemo)}</>
                        )}
                    </span>
                </div>
            </div>
            <div className={styles.transactionAmount}>
                -{transaction.amount.toLocaleString()}원
            </div>
        </div>
    );
}

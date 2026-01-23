import React from 'react';
import { getCategoryIconComponent, normalizeCategory, CATEGORY_COLORS } from '@/components/common/CategoryIcons';
import styles from './expense.module.css';

const truncateMemo = (memo, maxLength = 8) => {
    if (!memo) return '';
    if (memo.length <= maxLength) return memo;
    return memo.substring(0, maxLength) + '...';
};

export default function TransactionItem({ transaction, onClick, isLast }) {
    const displayMemo = transaction.memo || '';

    const normalizedCategory = normalizeCategory(transaction.category);
    const IconComponent = getCategoryIconComponent(normalizedCategory);
    const iconColor = CATEGORY_COLORS[normalizedCategory] || '#94a3b8';

    return (
        <div
            className={`${styles.transactionRow} ${isLast ? '' : styles.transactionRowBorder}`}
            onClick={() => onClick(transaction)}
        >
            <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                <div className={styles.transactionIcon}>
                    <IconComponent size={20} color={iconColor} />
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

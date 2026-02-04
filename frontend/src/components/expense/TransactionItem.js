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
            className={`${styles.transactionItem} ${isLast ? '' : styles.transactionItemBorder}`}
            onClick={() => onClick(transaction)}
        >
            <div className={styles.transactionLeftWrapper}>
                <div className={styles.transactionIconCircle}>
                    <IconComponent size={22} color={iconColor} />
                </div>
                <div className={styles.transactionLeft}>
                    <div className={styles.transactionCategory}>
                        {transaction.category}
                    </div>
                    <div className={styles.transactionMerchant}>
                        {transaction.merchant}
                        {displayMemo && <span className={styles.transactionMemo}> | {truncateMemo(displayMemo)}</span>}
                    </div>
                </div>
            </div>
            <div className={styles.transactionRight}>
                <span className={styles.transactionAmount}>
                    -{transaction.amount.toLocaleString()}원
                </span>
            </div>
        </div>
    );
}

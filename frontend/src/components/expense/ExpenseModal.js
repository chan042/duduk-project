"use client";

import React, { useState, useEffect } from 'react';
import { X, Utensils, Coffee, ShoppingBag, Bus } from 'lucide-react';
import styles from './expense.module.css';

const getCategoryIcon = (category) => {
    switch (category) {
        case '식비': return <Utensils size={16} />;
        case '카페': case '카페/간식': return <Coffee size={16} />;
        case '쇼핑': return <ShoppingBag size={16} />;
        case '교통': return <Bus size={16} />;
        default: return <Utensils size={16} />;
    }
};

const CATEGORIES = [
    '식비',
    '생활',
    '카페/간식',
    '온라인 쇼핑',
    '패션/쇼핑',
    '뷰티/미용',
    '교통',
    '자동차',
    '주거/통신',
    '의료/건강',
    '문화/여가',
    '여행/숙박',
    '교육/학습',
    '자녀/육아',
    '반려동물',
    '경조/선물',
    '술/유흥',
    '기타'
];

export default function ExpenseModal({ isOpen, onClose, transaction, onUpdate, onDelete }) {
    const [memo, setMemo] = useState('');
    const [category, setCategory] = useState('');
    const [merchant, setMerchant] = useState('');
    const [date, setDate] = useState('');
    const [amount, setAmount] = useState('');
    const [isFixedExpense, setIsFixedExpense] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (transaction) {
            setMemo(transaction.memo || '');
            setCategory(transaction.category || '기타');
            setMerchant(transaction.merchant || '');
            setAmount(transaction.amount || 0);
            setIsFixedExpense(transaction.is_fixed || false);

            // Date handling: extract YYYY-MM-DD
            if (transaction.date) {
                const d = new Date(transaction.date);
                const isoDate = d.toISOString().split('T')[0];
                setDate(isoDate);
            } else {
                setDate('');
            }
        }
    }, [transaction]);

    const handleUpdate = async () => {
        if (!transaction || isLoading) return;

        setIsLoading(true);
        try {
            await onUpdate(transaction.id, {
                memo: memo,
                category: category,
                amount: parseInt(amount, 10),
                store: merchant, // Backend uses 'store' field for merchant name
                date: date,
                is_fixed: isFixedExpense
            });
            onClose();
        } catch (error) {
            console.error('Update failed:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!transaction || isLoading) return;

        if (!confirm('정말 삭제하시겠습니까?')) return;

        setIsLoading(true);
        try {
            await onDelete(transaction.id);
            onClose();
        } catch (error) {
            console.error('Delete failed:', error);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen || !transaction) return null;

    return (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                    <button className={styles.closeButton} onClick={onClose}>
                        <X size={24} />
                    </button>
                </div>

                <div className={styles.modalBody}>
                    <div className={styles.modalAmountHeader}>결제 금액</div>
                    <input
                        type="number"
                        className={styles.modalAmount}
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none' }}
                    />

                    <div className={styles.modalRow}>
                        <span className={styles.modalLabel}>카테고리</span>
                        <div className={styles.modalValue}>
                            {getCategoryIcon(category)}
                            <select
                                className={styles.memoInput}
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                style={{ width: 'auto' }}
                            >
                                {CATEGORIES.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className={styles.modalRow}>
                        <span className={styles.modalLabel}>거래처</span>
                        <input
                            type="text"
                            className={styles.memoInput}
                            value={merchant}
                            onChange={(e) => setMerchant(e.target.value)}
                            placeholder="거래처 입력"
                        />
                    </div>

                    <div className={styles.modalRow}>
                        <span className={styles.modalLabel}>날짜</span>
                        <input
                            type="date"
                            className={styles.memoInput}
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                        />
                    </div>

                    <div className={styles.modalRow}>
                        <span className={styles.modalLabel}>메모</span>
                        <input
                            type="text"
                            className={styles.memoInput}
                            value={memo}
                            onChange={(e) => setMemo(e.target.value)}
                            placeholder="메모 입력"
                        />
                    </div>

                    <div className={styles.modalRow}>
                        <span className={styles.modalLabel}>고정 지출에 추가</span>
                        <div
                            className={`${styles.toggleSwitch} ${isFixedExpense ? styles.active : ''}`}
                            onClick={() => setIsFixedExpense(!isFixedExpense)}
                        />
                    </div>

                    <div className={styles.modalActions}>
                        <button
                            className={`${styles.btn} ${styles.btnSecondary}`}
                            onClick={handleUpdate}
                            disabled={isLoading}
                        >
                            {isLoading ? '저장 중...' : '수정'}
                        </button>
                        <button
                            className={`${styles.btn} ${styles.btnPrimary}`}
                            onClick={handleDelete}
                            disabled={isLoading}
                        >
                            {isLoading ? '삭제 중...' : '삭제'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}


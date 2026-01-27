"use client";

import React, { useState, useEffect } from 'react';
import { X, Check, Trash2, Search, MapPin, ChevronRight } from 'lucide-react';
import styles from './expense.module.css';
import CalculatorInput from '../common/CalculatorInput';
import DateWheelPicker from '../common/DateWheelPicker';
import KakaoLocationPicker from '../common/KakaoLocationPicker';
import { getCategoryIcon, CATEGORIES } from '../common/CategoryIcons';

export default function ExpenseModal({ isOpen, onClose, transaction, onUpdate, onDelete }) {
    const [memo, setMemo] = useState('');
    const [category, setCategory] = useState('');
    const [merchant, setMerchant] = useState('');
    const [date, setDate] = useState('');
    const [dateObj, setDateObj] = useState(new Date());
    const [amount, setAmount] = useState(0);
    const [isFixedExpense, setIsFixedExpense] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [address, setAddress] = useState('');
    const [placeName, setPlaceName] = useState('');

    // Modal States
    const [showCalculator, setShowCalculator] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showCategoryPicker, setShowCategoryPicker] = useState(false);
    const [showLocationPicker, setShowLocationPicker] = useState(false);

    useEffect(() => {
        if (transaction) {
            setMemo(transaction.memo || '');
            setCategory(transaction.category || '기타');
            setMerchant(transaction.merchant || '');
            setAmount(transaction.amount || 0);
            setIsFixedExpense(transaction.is_fixed || false);
            // 저장된 address에서 placeName과 detailedAddress 파싱
            // 형식: "장소명 | 상세주소" 또는 "주소만"
            const savedAddress = transaction.address || '';
            if (savedAddress.includes(' | ')) {
                const [pName, dAddr] = savedAddress.split(' | ');
                setPlaceName(pName);
                setAddress(dAddr);
            } else {
                setPlaceName('');
                setAddress(savedAddress);
            }

            // Date handling: extract YYYY-MM-DD
            // 타임존 문제를 피하기 위해 YYYY-MM-DD 문자열을 직접 파싱
            if (transaction.date) {
                // transaction.date가 'YYYY-MM-DD' 또는 'YYYY-MM-DDTHH:mm:ss' 형식일 수 있음
                const dateStr = transaction.date.split('T')[0]; // YYYY-MM-DD 부분만 추출
                const [year, month, day] = dateStr.split('-').map(Number);
                // 로컬 타임존으로 Date 객체 생성 (월은 0부터 시작)
                const d = new Date(year, month - 1, day);
                setDateObj(d);
                setDate(dateStr);
            } else {
                setDateObj(new Date());
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
                is_fixed: isFixedExpense,
                address: placeName && address ? `${placeName} | ${address}` : (placeName || address)
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

    const handleDateConfirm = (newDate) => {
        setDateObj(newDate);
        // 로컬 타임존을 유지하면서 YYYY-MM-DD 형식으로 변환
        const year = newDate.getFullYear();
        const month = String(newDate.getMonth() + 1).padStart(2, '0');
        const day = String(newDate.getDate()).padStart(2, '0');
        const localDate = `${year}-${month}-${day}`;
        setDate(localDate);
    };

    const formatDateDisplay = () => {
        if (!date) return '날짜 선택';
        return dateObj.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
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
                    {/* Amount - 클릭 시 계산기 오픈 */}
                    <div className={styles.modalAmountHeader}>결제 금액</div>
                    <div
                        onClick={() => setShowCalculator(true)}
                        style={{
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            marginBottom: '1rem'
                        }}
                    >
                        <span className={styles.modalAmount} style={{ margin: 0 }}>
                            {parseInt(amount, 10).toLocaleString()}원
                        </span>
                        <span style={{ color: 'var(--text-sub)', fontSize: '0.875rem' }}>✎</span>
                    </div>

                    {/* Category - 클릭 시 카테고리 선택 오픈 */}
                    <div className={styles.modalRow}>
                        <span className={styles.modalLabel}>카테고리</span>
                        <div
                            className={styles.modalValue}
                            onClick={() => setShowCategoryPicker(true)}
                            style={{ cursor: 'pointer' }}
                        >
                            {getCategoryIcon(category, 16)}
                            <span>{category}</span>
                            <span style={{ marginLeft: '4px', color: 'var(--text-sub)' }}>▼</span>
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

                    {/* Date - 클릭 시 날짜 휠 피커 오픈 */}
                    <div className={styles.modalRow}>
                        <span className={styles.modalLabel}>날짜</span>
                        <div
                            onClick={() => setShowDatePicker(true)}
                            style={{
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                fontWeight: '500',
                                color: 'var(--text-main)'
                            }}
                        >
                            <span>{formatDateDisplay()}</span>
                            <span style={{ color: 'var(--text-sub)' }}>📅</span>
                        </div>
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

                    {/* Location */}
                    {/* Location */}
                    <div className={styles.modalRow} style={{ alignItems: 'flex-start' }}>
                        <span className={styles.modalLabel} style={{ marginTop: '6px' }}>장소</span>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                            {(placeName || address) ? (
                                <>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <MapPin size={16} color="var(--primary)" />
                                        <span style={{
                                            fontWeight: '600',
                                            fontSize: '1rem',
                                            color: 'var(--text-main)'
                                        }}>
                                            {placeName}
                                        </span>
                                    </div>
                                    {address && (
                                        <div style={{
                                            fontSize: '0.85rem',
                                            color: '#718096',
                                            textAlign: 'right'
                                        }}>
                                            {address}
                                        </div>
                                    )}
                                    <div
                                        onClick={() => setShowLocationPicker(true)}
                                        style={{
                                            fontSize: '0.85rem',
                                            color: 'var(--text-sub)',
                                            cursor: 'pointer',
                                            marginTop: '6px',
                                            textDecoration: 'underline',
                                            padding: '4px 0'
                                        }}
                                    >
                                        수정
                                    </div>
                                </>
                            ) : (
                                <div
                                    onClick={() => setShowLocationPicker(true)}
                                    style={{
                                        color: '#a0aec0',
                                        cursor: 'pointer',
                                        fontSize: '0.95rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        padding: '4px 0'
                                    }}
                                >
                                    장소를 선택하세요 <ChevronRight size={16} />
                                </div>
                            )}
                        </div>
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
                            className={styles.btnIcon}
                            onClick={handleDelete}
                            disabled={isLoading}
                            aria-label="삭제"
                        >
                            <Trash2 size={24} />
                        </button>
                        <button
                            className={`${styles.btn} ${styles.btnPrimary}`}
                            onClick={handleUpdate}
                            disabled={isLoading}
                        >
                            {isLoading ? '저장 중...' : '저장'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Calculator Modal */}
            <CalculatorInput
                isOpen={showCalculator}
                onClose={() => setShowCalculator(false)}
                initialValue={amount}
                onConfirm={(newAmount) => setAmount(newAmount)}
            />

            {/* Date Picker Modal */}
            <DateWheelPicker
                isOpen={showDatePicker}
                onClose={() => setShowDatePicker(false)}
                initialDate={dateObj}
                onConfirm={handleDateConfirm}
            />

            {/* Location Picker Modal */}
            <KakaoLocationPicker
                isOpen={showLocationPicker}
                onClose={() => setShowLocationPicker(false)}
                onConfirm={(location) => {
                    setPlaceName(location.placeName || '');
                    setAddress(location.address || '');
                }}
                initialAddress={address}
                initialPlaceName={placeName || merchant}
            />

            {/* Category Picker Modal */}
            {showCategoryPicker && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        display: 'flex',
                        alignItems: 'flex-end',
                        justifyContent: 'center',
                        zIndex: 2001,
                    }}
                    onClick={() => setShowCategoryPicker(false)}
                >
                    <div
                        style={{
                            backgroundColor: 'white',
                            borderTopLeftRadius: '24px',
                            borderTopRightRadius: '24px',
                            padding: '20px',
                            width: '100%',
                            maxWidth: '430px',
                            maxHeight: '60vh',
                            overflowY: 'auto',
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '16px'
                        }}>
                            <span style={{ fontSize: '1.125rem', fontWeight: '600' }}>카테고리 선택</span>
                            <button
                                onClick={() => setShowCategoryPicker(false)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {CATEGORIES.map((cat) => (
                                <div
                                    key={cat}
                                    onClick={() => {
                                        setCategory(cat);
                                        setShowCategoryPicker(false);
                                    }}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        padding: '12px 16px',
                                        borderRadius: '12px',
                                        backgroundColor: category === cat ? '#e6fffa' : '#f8f9fa',
                                        cursor: 'pointer',
                                        border: category === cat ? '2px solid var(--primary)' : '2px solid transparent',
                                    }}
                                >
                                    {getCategoryIcon(cat, 20)}
                                    <span style={{
                                        fontWeight: category === cat ? '600' : '400',
                                        color: 'var(--text-main)'
                                    }}>{cat}</span>
                                    {category === cat && (
                                        <Check size={18} color="var(--primary)" style={{ marginLeft: 'auto' }} />
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

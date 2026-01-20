"use client";

import { Wallet, Edit2, ChevronRight, Search, MapPin, Calendar, Check, ChevronDown } from 'lucide-react';
import { useState, useEffect } from 'react';
import CalculatorInput from '../common/CalculatorInput';
import DateWheelPicker from '../common/DateWheelPicker';
import { getCategoryIcon, CATEGORIES } from '../common/CategoryIcons';

export default function TransactionConfirm({ initialData, onSave }) {
    const [isRecurring, setIsRecurring] = useState(true);

    // Form State
    const [amount, setAmount] = useState(initialData?.amount || 0);
    const [category, setCategory] = useState(initialData?.category || '기타');
    const [item, setItem] = useState(initialData?.item || '');
    const [store, setStore] = useState(initialData?.store || '');
    const [rawDate, setRawDate] = useState(initialData?.date ? new Date(initialData.date) : new Date());

    // Modal States
    const [showCalculator, setShowCalculator] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showCategoryPicker, setShowCategoryPicker] = useState(false);

    // initialData가 변경되면(AI 분석 완료 시) Form 상태 업데이트
    useEffect(() => {
        if (initialData) {
            setAmount(initialData.amount || 0);
            setCategory(initialData.category || '기타');
            setItem(initialData.item || '');
            setStore(initialData.store || '');
            // 날짜 처리: 문자열이 오면 Date 객체로 변환
            setRawDate(initialData.date ? new Date(initialData.date) : new Date());
        }
    }, [initialData]);

    const dateDisplay = rawDate.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });

    return (
        <div style={{ paddingBottom: '1rem' }}>
            {/* Handle Bar */}
            <div style={{ width: '40px', height: '4px', backgroundColor: '#e2e8f0', borderRadius: '2px', margin: '0 auto 1.5rem auto' }}></div>

            {/* Amount & Category */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
                {/* Amount - 클릭 시 계산기 오픈 */}
                <div
                    onClick={() => setShowCalculator(true)}
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        backgroundColor: '#e6fffa',
                        padding: '1rem',
                        borderRadius: '16px',
                        cursor: 'pointer'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ backgroundColor: '#c6f6d5', padding: '0.5rem', borderRadius: '8px' }}>
                            <Wallet size={20} color="var(--primary)" />
                        </div>
                        <span style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-main)' }}>₩{amount.toLocaleString()}</span>
                    </div>
                    <Edit2 size={18} color="var(--text-sub)" />
                </div>

                {/* Category - 클릭 시 카테고리 선택 오픈 */}
                <div
                    onClick={() => setShowCategoryPicker(true)}
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        backgroundColor: '#e6fffa',
                        padding: '1rem',
                        borderRadius: '16px',
                        cursor: 'pointer'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ backgroundColor: '#c6f6d5', padding: '0.5rem', borderRadius: '8px' }}>
                            {getCategoryIcon(category, 20)}
                        </div>
                        <span style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--text-main)' }}>{category}</span>
                    </div>
                    <ChevronRight size={20} color="var(--text-sub)" />
                </div>
            </div>

            {/* Form Fields */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '1.5rem' }}>
                {/* Product Name */}
                <div>
                    <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-main)', marginBottom: '0.5rem' }}>상품명</label>
                    <div style={{
                        backgroundColor: 'white',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        padding: '0.85rem 1rem'
                    }}>
                        <input
                            type="text"
                            value={item}
                            onChange={(e) => setItem(e.target.value)}
                            style={{ width: '100%', border: 'none', outline: 'none', fontSize: '1rem', color: 'var(--text-main)' }}
                        />
                    </div>
                </div>

                {/* Merchant */}
                <div>
                    <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-main)', marginBottom: '0.5rem' }}>소비처</label>
                    <div style={{
                        backgroundColor: 'white',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        padding: '0.85rem 1rem'
                    }}>
                        <input
                            type="text"
                            value={store}
                            onChange={(e) => setStore(e.target.value)}
                            style={{ width: '100%', border: 'none', outline: 'none', fontSize: '1rem', color: 'var(--text-main)' }}
                        />
                    </div>
                </div>

                {/* Location Search */}
                <div>
                    <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-main)', marginBottom: '0.5rem' }}>장소 검색</label>
                    <div style={{
                        backgroundColor: '#f8f9fa',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        padding: '0.85rem 1rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        marginBottom: '0.75rem'
                    }}>
                        <Search size={18} color="var(--text-sub)" />
                        <input
                            type="text"
                            defaultValue={store ? `${store}` : ''}
                            style={{ width: '100%', border: 'none', outline: 'none', fontSize: '1rem', color: 'var(--text-main)', background: 'transparent' }}
                        />
                    </div>

                    {/* Map Placeholder */}
                    <div style={{
                        width: '100%',
                        height: '140px',
                        backgroundColor: '#e2e8f0',
                        borderRadius: '16px',
                        overflow: 'hidden',
                        position: 'relative',
                        backgroundImage: 'url(https://assets.codepen.io/3/internal/avatars/users/default.png?fit=crop&format=auto&height=512&version=1&width=512)', // Placeholder image or gradient
                        backgroundSize: 'cover'
                    }}>
                        {/* Simple Map Mockup Gradient */}
                        <div style={{ width: '100%', height: '100%', background: 'linear-gradient(120deg, #e0f2f1 0%, #b2dfdb 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{ position: 'relative' }}>
                                <MapPin size={32} color="var(--text-main)" fill="white" />
                                <div style={{
                                    position: 'absolute',
                                    bottom: '-4px',
                                    left: '50%',
                                    transform: 'translateX(-50%)',
                                    width: '12px',
                                    height: '4px',
                                    backgroundColor: 'rgba(0,0,0,0.2)',
                                    borderRadius: '50%'
                                }}></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Date - 클릭 시 날짜 휠 피커 오픈 */}
                <div
                    onClick={() => setShowDatePicker(true)}
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        backgroundColor: '#e6fffa',
                        padding: '1rem',
                        borderRadius: '16px',
                        cursor: 'pointer'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ backgroundColor: '#c6f6d5', padding: '0.5rem', borderRadius: '8px' }}>
                            <Calendar size={20} color="var(--primary)" />
                        </div>
                        <span style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--text-main)' }}>{dateDisplay}</span>
                    </div>
                    <ChevronRight size={20} color="var(--text-sub)" />
                </div>

                {/* Recurring Toggle */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 0.25rem' }}>
                    <span style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--text-main)' }}>고정 지출에 추가</span>
                    <div
                        onClick={() => setIsRecurring(!isRecurring)}
                        style={{
                            width: '50px',
                            height: '28px',
                            backgroundColor: isRecurring ? 'var(--primary)' : '#cbd5e0',
                            borderRadius: '14px',
                            position: 'relative',
                            cursor: 'pointer',
                            transition: 'background-color 0.2s ease'
                        }}
                    >
                        <div style={{
                            width: '24px',
                            height: '24px',
                            backgroundColor: 'white',
                            borderRadius: '50%',
                            position: 'absolute',
                            top: '2px',
                            left: isRecurring ? '24px' : '2px',
                            transition: 'left 0.2s ease',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                        }}></div>
                    </div>
                </div>
            </div>

            {/* Save Button */}
            <button
                onClick={() => onSave({ amount, category, item, store, date: rawDate.toISOString(), isRecurring })}
                style={{
                    width: '100%',
                    padding: '1rem',
                    backgroundColor: 'var(--primary)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '1.1rem',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    boxShadow: '0 4px 6px rgba(47, 133, 90, 0.2)'
                }}
            >
                저장
            </button>

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
                initialDate={rawDate}
                onConfirm={(newDate) => setRawDate(newDate)}
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
                        zIndex: 2000,
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
                                ✕
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

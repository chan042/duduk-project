"use client";

import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';

/**
 * 휠 스타일 날짜 선택 컴포넌트
 * @param {boolean} isOpen - 모달 열림 상태
 * @param {function} onClose - 닫기 핸들러
 * @param {Date} initialDate - 초기 날짜
 * @param {function} onConfirm - 확인 시 콜백 (Date 객체 전달)
 */
export default function DateWheelPicker({ isOpen, onClose, initialDate = new Date(), onConfirm }) {
    const currentYear = new Date().getFullYear();
    const [selectedYear, setSelectedYear] = useState(initialDate.getFullYear());
    const [selectedMonth, setSelectedMonth] = useState(initialDate.getMonth() + 1);
    const [selectedDay, setSelectedDay] = useState(initialDate.getDate());

    const yearRef = useRef(null);
    const monthRef = useRef(null);
    const dayRef = useRef(null);

    // 연도 범위: 현재년도 -5 ~ +5
    const years = Array.from({ length: 11 }, (_, i) => currentYear - 5 + i);
    const months = Array.from({ length: 12 }, (_, i) => i + 1);

    // 해당 월의 일수 계산
    const getDaysInMonth = (year, month) => {
        return new Date(year, month, 0).getDate();
    };

    const days = Array.from(
        { length: getDaysInMonth(selectedYear, selectedMonth) },
        (_, i) => i + 1
    );

    useEffect(() => {
        if (isOpen && initialDate) {
            setSelectedYear(initialDate.getFullYear());
            setSelectedMonth(initialDate.getMonth() + 1);
            setSelectedDay(initialDate.getDate());
        }
    }, [isOpen, initialDate]);

    // 월 변경 시 일수 조정
    useEffect(() => {
        const maxDays = getDaysInMonth(selectedYear, selectedMonth);
        if (selectedDay > maxDays) {
            setSelectedDay(maxDays);
        }
    }, [selectedYear, selectedMonth, selectedDay]);

    if (!isOpen) return null;

    const handleConfirm = () => {
        const newDate = new Date(selectedYear, selectedMonth - 1, selectedDay);
        onConfirm(newDate);
        onClose();
    };

    const handleWheel = (e, type) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 1 : -1;

        if (type === 'year') {
            const newIndex = years.indexOf(selectedYear) + delta;
            if (newIndex >= 0 && newIndex < years.length) {
                setSelectedYear(years[newIndex]);
            }
        } else if (type === 'month') {
            const newMonth = selectedMonth + delta;
            if (newMonth >= 1 && newMonth <= 12) {
                setSelectedMonth(newMonth);
            }
        } else if (type === 'day') {
            const maxDays = getDaysInMonth(selectedYear, selectedMonth);
            const newDay = selectedDay + delta;
            if (newDay >= 1 && newDay <= maxDays) {
                setSelectedDay(newDay);
            }
        }
    };

    const renderWheel = (items, selected, onSelect, type, suffix) => {
        const selectedIndex = items.indexOf(selected);
        // 표시할 아이템: 선택된 것 기준 앞뒤 2개씩
        const visibleItems = [];
        for (let i = -2; i <= 2; i++) {
            const idx = selectedIndex + i;
            if (idx >= 0 && idx < items.length) {
                visibleItems.push({ value: items[idx], offset: i });
            } else {
                visibleItems.push({ value: null, offset: i });
            }
        }

        return (
            <div
                style={styles.wheelColumn}
                onWheel={(e) => handleWheel(e, type)}
            >
                {visibleItems.map(({ value, offset }, i) => (
                    <div
                        key={i}
                        style={{
                            ...styles.wheelItem,
                            ...(offset === 0 ? styles.selectedItem : styles.unselectedItem),
                            opacity: value === null ? 0 : 1,
                        }}
                        onClick={() => value !== null && onSelect(value)}
                    >
                        {value !== null ? `${value}${suffix}` : ''}
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div style={styles.overlay} onClick={onClose}>
            <div style={styles.container} onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div style={styles.header}>
                    <span style={styles.title}>날짜를 선택해 주세요</span>
                    <button style={styles.closeBtn} onClick={onClose}>
                        <X size={24} color="#666" />
                    </button>
                </div>

                {/* Wheel picker */}
                <div style={styles.pickerContainer}>
                    {/* Selection highlight background */}
                    <div style={styles.selectionHighlight}></div>

                    <div style={styles.wheelsRow}>
                        {renderWheel(years, selectedYear, setSelectedYear, 'year', '년')}
                        {renderWheel(months, selectedMonth, setSelectedMonth, 'month', '월')}
                        {renderWheel(days, selectedDay, setSelectedDay, 'day', '일')}
                    </div>
                </div>

                {/* Confirm button */}
                <button style={styles.confirmBtn} onClick={handleConfirm}>
                    확인
                </button>
            </div>
        </div>
    );
}

const styles = {
    overlay: {
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
    },
    container: {
        backgroundColor: 'white',
        borderTopLeftRadius: '24px',
        borderTopRightRadius: '24px',
        padding: '20px',
        width: '100%',
        maxWidth: '430px',
        animation: 'slideUp 0.3s ease-out',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
    },
    title: {
        fontSize: '1.125rem',
        fontWeight: '600',
        color: '#1a1a1a',
    },
    closeBtn: {
        background: 'transparent',
        border: 'none',
        padding: '4px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    pickerContainer: {
        position: 'relative',
        height: '200px',
        marginBottom: '24px',
        overflow: 'hidden',
    },
    selectionHighlight: {
        position: 'absolute',
        top: '50%',
        left: '10%',
        right: '10%',
        height: '44px',
        transform: 'translateY(-50%)',
        backgroundColor: '#f0f0f0',
        borderRadius: '12px',
        zIndex: 0,
    },
    wheelsRow: {
        display: 'flex',
        justifyContent: 'center',
        gap: '8px',
        height: '100%',
        position: 'relative',
        zIndex: 1,
    },
    wheelColumn: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
        cursor: 'ns-resize',
        userSelect: 'none',
    },
    wheelItem: {
        padding: '8px 16px',
        textAlign: 'center',
        transition: 'all 0.2s ease',
    },
    selectedItem: {
        fontSize: '1.25rem',
        fontWeight: '700',
        color: '#1a1a1a',
    },
    unselectedItem: {
        fontSize: '1rem',
        fontWeight: '400',
        color: '#999',
    },
    confirmBtn: {
        width: '100%',
        backgroundColor: '#14b8a6',
        color: 'white',
        border: 'none',
        borderRadius: '12px',
        padding: '16px',
        fontSize: '1rem',
        fontWeight: '600',
        cursor: 'pointer',
    },
};

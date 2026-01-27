"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { X } from 'lucide-react';

const ITEM_HEIGHT = 40; // 아이템 높이

/**
 * 개별 휠 컬럼 컴포넌트
 */
const WheelColumn = ({ items, value, onChange, suffix }) => {
    const listRef = useRef(null);
    const isDragging = useRef(false);

    // 초기 스크롤 위치 설정 및 외부 값 변경 시 동기화
    useEffect(() => {
        if (listRef.current) {
            const selectedIndex = items.indexOf(value);
            if (selectedIndex !== -1) {
                // 부드러운 스크롤 없이 즉시 이동 (초기 로드 시 깜빡임 방지)
                listRef.current.scrollTo({
                    top: selectedIndex * ITEM_HEIGHT,
                    behavior: 'auto'
                });
            }
        }
    }, [items, value]);

    // 스크롤 핸들러 (디바운싱 적용 가능하지만, 실시간 반응성을 위해 직접 계산)
    const handleScroll = useCallback((e) => {
        if (!listRef.current) return;

        const scrollTop = listRef.current.scrollTop;
        const index = Math.round(scrollTop / ITEM_HEIGHT);

        // 범위 체크
        if (index >= 0 && index < items.length) {
            const newValue = items[index];
            if (newValue !== value) {
                // 스크롤 중에는 값만 업데이트하고 스크롤 위치는 강제하지 않음
                onChange(newValue);
            }
        }
    }, [items, value, onChange]);

    return (
        <div style={styles.wheelColumnWrapper}>
            <ul
                ref={listRef}
                style={styles.wheelList}
                className="hide-scrollbar"
                onScroll={handleScroll}
            >
                {/* 상단 여백 (중앙 정렬을 위해) */}
                <li style={{ height: ITEM_HEIGHT * 2, flexShrink: 0 }} />

                {items.map((item) => (
                    <li
                        key={item}
                        style={{
                            ...styles.wheelItem,
                            color: item === value ? '#1a1a1a' : '#c7c7c7',
                            fontWeight: item === value ? '600' : '400',
                            opacity: item === value ? 1 : 0.5,
                            transform: item === value ? 'scale(1.1)' : 'scale(1)',
                        }}
                    >
                        {item}{suffix}
                    </li>
                ))}

                {/* 하단 여백 */}
                <li style={{ height: ITEM_HEIGHT * 2, flexShrink: 0 }} />
            </ul>
        </div>
    );
};

export default function DateWheelPicker({ isOpen, onClose, initialDate = new Date(), onConfirm }) {
    const currentYear = new Date().getFullYear();
    const [selectedYear, setSelectedYear] = useState(initialDate.getFullYear());
    const [selectedMonth, setSelectedMonth] = useState(initialDate.getMonth() + 1);
    const [selectedDay, setSelectedDay] = useState(initialDate.getDate());

    // 연도 범위: 현재년도 -10 ~ +10
    const years = Array.from({ length: 21 }, (_, i) => currentYear - 10 + i);
    const months = Array.from({ length: 12 }, (_, i) => i + 1);

    // 해당 월의 일수 계산
    const getDaysInMonth = (year, month) => {
        return new Date(year, month, 0).getDate();
    };

    const days = Array.from(
        { length: getDaysInMonth(selectedYear, selectedMonth) },
        (_, i) => i + 1
    );

    // 모달 열릴 때 초기값 세팅
    useEffect(() => {
        if (isOpen && initialDate) {
            setSelectedYear(initialDate.getFullYear());
            setSelectedMonth(initialDate.getMonth() + 1);
            setSelectedDay(initialDate.getDate());
        }
    }, [isOpen, initialDate]);

    // 월/년 변경 시 일이 범위를 벗어나면 조정
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
                        <WheelColumn
                            items={years}
                            value={selectedYear}
                            onChange={setSelectedYear}
                            suffix="년"
                        />
                        <WheelColumn
                            items={months}
                            value={selectedMonth}
                            onChange={setSelectedMonth}
                            suffix="월"
                        />
                        <WheelColumn
                            items={days}
                            value={selectedDay}
                            onChange={setSelectedDay}
                            suffix="일"
                        />
                    </div>
                </div>

                {/* Confirm button */}
                <button style={styles.confirmBtn} onClick={handleConfirm}>
                    확인
                </button>
            </div>

            {/* 휠 스크롤바 숨김 처리 및 스크롤 스냅 스타일 */}
            <style jsx global>{`
                ul {
                    list-style: none;
                    margin: 0;
                    padding: 0;
                }
                .hide-scrollbar::-webkit-scrollbar {
                    display: none;
                }
                .hide-scrollbar {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `}</style>
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
        padding: '24px',
        width: '100%',
        maxWidth: '430px',
        animation: 'slideUp 0.3s ease-out',
        paddingBottom: '40px',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
    },
    title: {
        fontSize: '18px',
        fontWeight: '700',
        color: '#111',
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
        height: '200px', // 5 items * 40px
        marginBottom: '30px',
        overflow: 'hidden',
        display: 'flex',
        justifyContent: 'center',
    },
    selectionHighlight: {
        position: 'absolute',
        top: '50%',
        left: '0',
        right: '0',
        height: '40px',
        transform: 'translateY(-50%)',
        backgroundColor: '#f5f7f9',
        borderRadius: '8px',
        zIndex: 0,
        pointerEvents: 'none',
    },
    wheelsRow: {
        display: 'flex',
        justifyContent: 'space-between',
        width: '100%',
        height: '100%',
        position: 'relative',
        zIndex: 1,
        padding: '0 10px',
    },
    wheelColumnWrapper: {
        flex: 1,
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
    },
    wheelList: {
        height: '100%',
        overflowY: 'auto',
        scrollSnapType: 'y mandatory',
        scrollbarWidth: 'none', // Firefox
        msOverflowStyle: 'none', // IE/Edge
    },
    wheelItem: {
        height: '40px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        scrollSnapAlign: 'center',
        fontSize: '16px',
        transition: 'all 0.2s',
        cursor: 'pointer',
        userSelect: 'none',
    },
    confirmBtn: {
        width: '100%',
        backgroundColor: '#57C0A1',
        color: 'white',
        border: 'none',
        borderRadius: '12px',
        padding: '16px',
        fontSize: '16px',
        fontWeight: '700',
        cursor: 'pointer',
        transition: 'background-color 0.2s',
    },
};

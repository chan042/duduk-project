
import React, { useRef, useEffect } from 'react';
import styles from './expense.module.css';

// 지출 내역 BottomSheet
export default function BottomSheet({ isOpen, onClose, children }) {
    const sheetRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (sheetRef.current && !sheetRef.current.contains(event.target)) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('touchstart', handleClickOutside);
            // 배경 스크롤 방지
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
            // 배경 스크롤 복구
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className={styles.bottomSheetOverlay}>
            <div className={styles.bottomSheetContent} ref={sheetRef}>
                <div className={styles.bottomSheetHandle} />
                {children}
            </div>
        </div>
    );
}

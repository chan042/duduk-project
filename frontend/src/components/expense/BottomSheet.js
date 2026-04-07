
import React, { useEffect } from 'react';
import styles from './expense.module.css';

// 지출 내역 BottomSheet
export default function BottomSheet({ isOpen, onClose, children }) {

    useEffect(() => {
        if (isOpen) {
            // 배경 스크롤 방지
            document.body.style.overflow = 'hidden';
        }

        return () => {
            // 배경 스크롤 복구
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    const handleOverlayClick = (event) => {
        event.stopPropagation();
        onClose();
    };

    const handleContentClick = (event) => {
        event.stopPropagation();
    };

    return (
        <div
            className={styles.bottomSheetOverlay}
            onClick={handleOverlayClick}
            onTouchStart={(e) => e.stopPropagation()}
        >
            <div className={styles.bottomSheetContent} onClick={handleContentClick}>
                <div className={styles.bottomSheetHandle} />
                {children}
            </div>
        </div>
    );
}

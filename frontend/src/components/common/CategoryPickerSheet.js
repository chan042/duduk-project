"use client";

import { Check, X } from 'lucide-react';

import BottomSheet from './BottomSheet';
import { CATEGORIES, getCategoryIcon } from './CategoryIcons';

export default function CategoryPickerSheet({
    isOpen,
    selectedCategory,
    onSelect,
    onClose,
    zIndex = 2000,
    maxHeight = '60vh',
}) {
    const handleSelect = (category) => {
        onSelect?.(category);
        onClose?.();
    };

    const header = (
        <div style={styles.header}>
            <span style={styles.title}>카테고리 선택</span>
            <button
                type="button"
                onClick={onClose}
                style={styles.closeButton}
                aria-label="카테고리 선택 닫기"
            >
                <X size={20} />
            </button>
        </div>
    );

    return (
        <BottomSheet
            isOpen={isOpen}
            onClose={onClose}
            header={header}
            showHandle={false}
            zIndex={zIndex}
            maxHeight={maxHeight}
            padding="20px"
        >
            <div style={styles.list}>
                {CATEGORIES.map((category) => {
                    const isSelected = selectedCategory === category;

                    return (
                        <button
                            key={category}
                            type="button"
                            onClick={() => handleSelect(category)}
                            style={{
                                ...styles.option,
                                backgroundColor: isSelected ? '#e6fffa' : '#f8f9fa',
                                border: isSelected ? '2px solid var(--primary)' : '2px solid transparent',
                            }}
                        >
                            {getCategoryIcon(category, 20)}
                            <span
                                style={{
                                    ...styles.optionLabel,
                                    fontWeight: isSelected ? '600' : '400',
                                }}
                            >
                                {category}
                            </span>
                            {isSelected && (
                                <Check size={18} color="var(--primary)" style={{ marginLeft: 'auto' }} />
                            )}
                        </button>
                    );
                })}
            </div>
        </BottomSheet>
    );
}

const styles = {
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px',
    },
    title: {
        fontSize: '1.125rem',
        fontWeight: '600',
        color: 'var(--text-main)',
    },
    closeButton: {
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '4px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-main)',
    },
    list: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
    },
    option: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        width: '100%',
        padding: '12px 16px',
        borderRadius: '12px',
        cursor: 'pointer',
        color: 'var(--text-main)',
    },
    optionLabel: {
        color: 'var(--text-main)',
        textAlign: 'left',
    },
};

"use client";

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * 계산기 스타일 금액 입력 컴포넌트
 * @param {boolean} isOpen - 모달 열림 상태
 * @param {function} onClose - 닫기 핸들러
 * @param {number} initialValue - 초기 금액
 * @param {function} onConfirm - 확인 시 콜백 (금액 전달)
 */
export default function CalculatorInput({ isOpen, onClose, initialValue = 0, onConfirm }) {
    const [displayValue, setDisplayValue] = useState('0');
    const [pendingOperation, setPendingOperation] = useState(null);
    const [pendingValue, setPendingValue] = useState(null);

    useEffect(() => {
        if (isOpen) {
            setDisplayValue(initialValue > 0 ? String(initialValue) : '0');
            setPendingOperation(null);
            setPendingValue(null);
        }
    }, [isOpen, initialValue]);

    if (!isOpen) return null;

    const handleNumberClick = (num) => {
        if (displayValue === '0' && num !== '00') {
            setDisplayValue(num);
        } else if (displayValue === '0' && num === '00') {
            // 0일 때 00 누르면 그대로 0
        } else {
            setDisplayValue(displayValue + num);
        }
    };

    const handleBackspace = () => {
        if (displayValue.length > 1) {
            setDisplayValue(displayValue.slice(0, -1));
        } else {
            setDisplayValue('0');
        }
    };

    const handleClear = () => {
        setDisplayValue('0');
        setPendingOperation(null);
        setPendingValue(null);
    };

    const handleOperation = (op) => {
        const currentValue = parseInt(displayValue, 10) || 0;

        if (pendingOperation && pendingValue !== null) {
            const result = calculate(pendingValue, currentValue, pendingOperation);
            setDisplayValue(String(result));
            setPendingValue(result);
        } else {
            setPendingValue(currentValue);
        }

        setPendingOperation(op);
        setDisplayValue('0');
    };

    const calculate = (a, b, operation) => {
        switch (operation) {
            case '-': return a - b;
            case '÷': return b !== 0 ? Math.floor(a / b) : 0;
            case '×': return a * b;
            default: return b;
        }
    };

    const handleEquals = () => {
        if (pendingOperation && pendingValue !== null) {
            const currentValue = parseInt(displayValue, 10) || 0;
            const result = calculate(pendingValue, currentValue, pendingOperation);
            setDisplayValue(String(Math.max(0, result)));
            setPendingOperation(null);
            setPendingValue(null);
        }
    };

    const handleConfirm = () => {
        const finalValue = parseInt(displayValue, 10) || 0;
        onConfirm(Math.max(0, finalValue));
        onClose();
    };

    const formattedDisplay = parseInt(displayValue, 10).toLocaleString();

    return (
        <div style={styles.overlay} onClick={onClose}>
            <div style={styles.container} onClick={(e) => e.stopPropagation()}>
                {/* Handle bar */}
                <div style={styles.handleBar}></div>

                {/* Display */}
                <div style={styles.displaySection}>
                    <span style={styles.label}>수정할 금액</span>
                    <div style={styles.displayRow}>
                        <span style={styles.displayValue}>{formattedDisplay}</span>
                        <button style={styles.clearBtn} onClick={handleClear}>
                            <X size={18} color="#888" />
                        </button>
                        <span style={styles.unit}>원</span>
                    </div>
                    <div style={styles.underline}></div>
                </div>

                {/* Keypad */}
                <div style={styles.keypad}>
                    {/* Row 1 */}
                    <button style={styles.numBtn} onClick={() => handleNumberClick('1')}>1</button>
                    <button style={styles.numBtn} onClick={() => handleNumberClick('2')}>2</button>
                    <button style={styles.numBtn} onClick={() => handleNumberClick('3')}>3</button>
                    <button style={styles.opBtn} onClick={() => handleOperation('-')}>−</button>

                    {/* Row 2 */}
                    <button style={styles.numBtn} onClick={() => handleNumberClick('4')}>4</button>
                    <button style={styles.numBtn} onClick={() => handleNumberClick('5')}>5</button>
                    <button style={styles.numBtn} onClick={() => handleNumberClick('6')}>6</button>
                    <button style={styles.opBtn} onClick={() => handleOperation('÷')}>÷</button>

                    {/* Row 3 */}
                    <button style={styles.numBtn} onClick={() => handleNumberClick('7')}>7</button>
                    <button style={styles.numBtn} onClick={() => handleNumberClick('8')}>8</button>
                    <button style={styles.numBtn} onClick={() => handleNumberClick('9')}>9</button>
                    <button style={styles.opBtn} onClick={() => handleOperation('×')}>×</button>

                    {/* Row 4 */}
                    <button style={styles.numBtn} onClick={() => handleNumberClick('00')}>00</button>
                    <button style={styles.numBtn} onClick={() => handleNumberClick('0')}>0</button>
                    <button style={styles.numBtn} onClick={handleBackspace}>←</button>
                    <button style={styles.equalsBtn} onClick={handleEquals}>=</button>
                </div>

                {/* Action buttons */}
                <div style={styles.actionRow}>
                    <button style={styles.cancelBtn} onClick={onClose}>닫기</button>
                    <button style={styles.confirmBtn} onClick={handleConfirm}>수정하기</button>
                </div>
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
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        zIndex: 2000,
    },
    container: {
        backgroundColor: '#1a1a2e',
        borderTopLeftRadius: '24px',
        borderTopRightRadius: '24px',
        padding: '12px 20px 24px 20px',
        width: '100%',
        maxWidth: '430px',
        animation: 'slideUp 0.3s ease-out',
    },
    handleBar: {
        width: '40px',
        height: '4px',
        backgroundColor: '#555',
        borderRadius: '2px',
        margin: '0 auto 16px auto',
    },
    displaySection: {
        marginBottom: '20px',
    },
    label: {
        color: '#4fd1c5',
        fontSize: '0.875rem',
        fontWeight: '500',
        display: 'block',
        marginBottom: '8px',
    },
    displayRow: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    },
    displayValue: {
        color: 'white',
        fontSize: '2rem',
        fontWeight: '600',
        flex: 1,
    },
    clearBtn: {
        background: 'transparent',
        border: 'none',
        padding: '4px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    unit: {
        color: 'white',
        fontSize: '1.25rem',
        fontWeight: '500',
    },
    underline: {
        height: '2px',
        background: 'linear-gradient(90deg, #3b82f6, #0ea5e9)',
        marginTop: '8px',
    },
    keypad: {
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '10px',
        marginBottom: '20px',
    },
    numBtn: {
        backgroundColor: '#2d2d44',
        color: 'white',
        border: 'none',
        borderRadius: '12px',
        padding: '18px',
        fontSize: '1.5rem',
        fontWeight: '500',
        cursor: 'pointer',
        transition: 'background-color 0.1s',
    },
    opBtn: {
        backgroundColor: '#3d3d5c',
        color: '#4fd1c5',
        border: 'none',
        borderRadius: '12px',
        padding: '18px',
        fontSize: '1.5rem',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'background-color 0.1s',
    },
    equalsBtn: {
        backgroundColor: '#3d3d5c',
        color: '#4fd1c5',
        border: 'none',
        borderRadius: '12px',
        padding: '18px',
        fontSize: '1.5rem',
        fontWeight: '600',
        cursor: 'pointer',
    },
    actionRow: {
        display: 'flex',
        gap: '12px',
    },
    cancelBtn: {
        flex: 1,
        backgroundColor: '#3d3d5c',
        color: 'white',
        border: 'none',
        borderRadius: '12px',
        padding: '16px',
        fontSize: '1rem',
        fontWeight: '600',
        cursor: 'pointer',
    },
    confirmBtn: {
        flex: 1.5,
        backgroundColor: '#3b82f6',
        color: 'white',
        border: 'none',
        borderRadius: '12px',
        padding: '16px',
        fontSize: '1rem',
        fontWeight: '600',
        cursor: 'pointer',
    },
};

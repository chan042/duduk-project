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
    // 수식 문자열 (숫자와 연산자를 모두 포함, 예: "5000-1000")
    const [expression, setExpression] = useState('0');

    // 모달이 열릴 때 초기값으로 수식 초기화
    useEffect(() => {
        if (isOpen) {
            setExpression(initialValue > 0 ? String(initialValue) : '0');
        }
    }, [isOpen, initialValue]);

    if (!isOpen) return null;

    // 수식에서 마지막 문자가 연산자인지 확인
    const isLastCharOperator = () => {
        const lastChar = expression.slice(-1);
        return ['-', '+', '×', '÷'].includes(lastChar);
    };

    // 숫자 버튼 클릭 핸들러
    const handleNumberClick = (num) => {
        if (expression === '0' && num !== '00') {
            // 초기값이 0이면 입력한 숫자로 대체
            setExpression(num);
        } else if (expression === '0' && num === '00') {
            // 0일 때 00 누르면 그대로 0 유지
        } else {
            // 수식 끝에 숫자 추가
            setExpression(expression + num);
        }
    };

    // 백스페이스 핸들러 - 마지막 문자 하나 삭제
    const handleBackspace = () => {
        if (expression.length > 1) {
            setExpression(expression.slice(0, -1));
        } else {
            setExpression('0');
        }
    };

    // 전체 초기화 핸들러
    const handleClear = () => {
        setExpression('0');
    };

    // 연산자 버튼 클릭 핸들러 - 수식 끝에 연산자 추가
    const handleOperation = (op) => {
        // 마지막 문자가 이미 연산자면 교체, 아니면 추가
        if (isLastCharOperator()) {
            setExpression(expression.slice(0, -1) + op);
        } else {
            setExpression(expression + op);
        }
    };

    // 수식 계산 함수
    const evaluateExpression = (expr) => {
        try {
            // 연산자로 끝나는 경우 제거
            let cleanExpr = expr;
            while (['-', '+', '×', '÷'].includes(cleanExpr.slice(-1))) {
                cleanExpr = cleanExpr.slice(0, -1);
            }

            if (!cleanExpr || cleanExpr === '0') return 0;

            // 수식을 토큰으로 분리 (숫자와 연산자)
            const tokens = cleanExpr.match(/(\d+|[+\-×÷])/g);
            if (!tokens) return 0;

            // 첫 번째 숫자로 시작
            let result = parseInt(tokens[0], 10);

            // 연산자와 숫자 쌍으로 계산
            for (let i = 1; i < tokens.length; i += 2) {
                const operator = tokens[i];
                const nextNum = parseInt(tokens[i + 1], 10) || 0;

                switch (operator) {
                    case '+':
                        result += nextNum;
                        break;
                    case '-':
                        result -= nextNum;
                        break;
                    case '×':
                        result *= nextNum;
                        break;
                    case '÷':
                        result = nextNum !== 0 ? Math.floor(result / nextNum) : 0;
                        break;
                    default:
                        break;
                }
            }

            // 결과가 음수면 0으로 처리
            return Math.max(0, result);
        } catch (e) {
            return 0;
        }
    };

    // = 버튼 클릭 핸들러 - 수식 계산 후 결과 표시
    const handleEquals = () => {
        const result = evaluateExpression(expression);
        setExpression(String(result));
    };

    // 수정하기 버튼 클릭 핸들러 - 수식 계산 후 확정
    const handleConfirm = () => {
        const result = evaluateExpression(expression);
        onConfirm(result);
        onClose();
    };

    // 표시용 포맷팅 - 계산기는 항상 쉼표 없이 표시
    const formatDisplay = () => {
        return expression;
    };

    return (
        <div style={styles.overlay} onClick={onClose}>
            <div style={styles.container} onClick={(e) => e.stopPropagation()}>
                {/* Handle bar */}
                <div style={styles.handleBar}></div>

                {/* Display - 수정할 금액 표시 영역 */}
                <div style={styles.displaySection}>
                    <span style={styles.label}>수정할 금액</span>
                    <div style={styles.displayRow}>
                        <span style={styles.displayValue}>{formatDisplay()}</span>
                        <button style={styles.clearBtn} onClick={handleClear}>
                            <X size={18} color="#64748b" />
                        </button>
                        <span style={styles.unit}>원</span>
                    </div>
                    <div style={styles.underline}></div>
                </div>

                {/* Keypad - 4x4 그리드 */}
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

                {/* Action buttons - 닫기/수정하기 버튼 */}
                <div style={styles.actionRow}>
                    <button style={styles.cancelBtn} onClick={onClose}>닫기</button>
                    <button style={styles.confirmBtn} onClick={handleConfirm}>수정하기</button>
                </div>
            </div>
        </div>
    );
}

// ============================================================
// 스타일 정의 - 앱 테마(민트색/흰색)에 맞게 색상 설정
// ============================================================
const styles = {
    overlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        zIndex: 2000,
    },
    container: {
        backgroundColor: '#ffffff',  // 밝은 흰색 배경
        borderTopLeftRadius: '24px',
        borderTopRightRadius: '24px',
        padding: '12px 20px 24px 20px',
        width: '100%',
        maxWidth: '430px',
        animation: 'slideUp 0.3s ease-out',
        boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.15)',
    },
    handleBar: {
        width: '40px',
        height: '4px',
        backgroundColor: '#d1d5db',
        borderRadius: '2px',
        margin: '0 auto 16px auto',
    },
    displaySection: {
        marginBottom: '20px',
    },
    label: {
        color: '#14b8a6',  // var(--primary) 민트색
        fontSize: '0.875rem',
        fontWeight: '600',
        display: 'block',
        marginBottom: '8px',
    },
    displayRow: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    },
    displayValue: {
        color: '#0f172a',  // 어두운 텍스트
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
        color: '#0f172a',  // 어두운 텍스트
        fontSize: '1.25rem',
        fontWeight: '500',
    },
    underline: {
        height: '2px',
        background: 'linear-gradient(90deg, #14b8a6, #5eead4)',  // 민트 그라데이션
        marginTop: '8px',
    },
    keypad: {
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '10px',
        marginBottom: '20px',
    },
    numBtn: {
        backgroundColor: '#f1f5f9',  // 밝은 회색 배경
        color: '#0f172a',  // 어두운 텍스트
        border: 'none',
        borderRadius: '12px',
        padding: '18px',
        fontSize: '1.5rem',
        fontWeight: '500',
        cursor: 'pointer',
        transition: 'background-color 0.1s',
    },
    opBtn: {
        backgroundColor: '#e0f2f1',  // 연한 민트 배경
        color: '#0d9488',  // 진한 민트 텍스트
        border: 'none',
        borderRadius: '12px',
        padding: '18px',
        fontSize: '1.5rem',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'background-color 0.1s',
    },
    equalsBtn: {
        backgroundColor: '#14b8a6',  // 민트색 배경
        color: 'white',
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
        backgroundColor: '#e2e8f0',  // 밝은 회색 배경
        color: '#475569',  // 어두운 회색 텍스트
        border: 'none',
        borderRadius: '12px',
        padding: '16px',
        fontSize: '1rem',
        fontWeight: '600',
        cursor: 'pointer',
    },
    confirmBtn: {
        flex: 1.5,
        backgroundColor: '#14b8a6',  // var(--primary) 민트색
        color: 'white',
        border: 'none',
        borderRadius: '12px',
        padding: '16px',
        fontSize: '1rem',
        fontWeight: '600',
        cursor: 'pointer',
    },
};

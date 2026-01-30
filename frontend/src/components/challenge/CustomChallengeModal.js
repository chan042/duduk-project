/**
 * [파일 역할]
 * - 커스텀 챌린지 생성 모달
 * - 사용자가 제목, 상세 내용, 난이도를 입력
 * - AI로 챌린지 생성하기 버튼
 */
import { useState } from 'react';
import { X, Sparkles } from 'lucide-react';

export default function CustomChallengeModal({ isOpen, onClose, onGenerate, isLoading }) {
    const [details, setDetails] = useState('');
    const [difficulty, setDifficulty] = useState('');

    // 모달 닫을 때 입력값 초기화
    const handleClose = () => {
        setDetails('');
        setDifficulty('');
        onClose();
    };

    if (!isOpen) return null;

    const handleOverlayClick = (e) => {
        if (e.target === e.currentTarget) {
            handleClose();
        }
    };

    const handleGenerate = () => {
        if (!details.trim()) {
            alert('챌린지 상세 내용을 입력해주세요.');
            return;
        }
        if (!difficulty) {
            alert('난이도를 선택해주세요.');
            return;
        }
        onGenerate('', details.trim(), difficulty);
    };

    const getDifficultyStyle = (diff) => {
        const isSelected = difficulty === diff;
        const baseStyle = {
            flex: 1,
            padding: '12px 16px',
            borderRadius: '12px',
            border: 'none',
            fontSize: '0.9rem',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
        };

        if (diff === 'easy') {
            return {
                ...baseStyle,
                backgroundColor: isSelected ? '#DCFCE7' : '#F3F4F6',
                color: isSelected ? '#16A34A' : 'var(--text-sub)',
            };
        }
        if (diff === 'medium') {
            return {
                ...baseStyle,
                backgroundColor: isSelected ? '#FEF3C7' : '#F3F4F6',
                color: isSelected ? '#CA8A04' : 'var(--text-sub)',
            };
        }
        if (diff === 'hard') {
            return {
                ...baseStyle,
                backgroundColor: isSelected ? '#FEE2E2' : '#F3F4F6',
                color: isSelected ? '#DC2626' : 'var(--text-sub)',
            };
        }
        return baseStyle;
    };

    return (
        <div style={styles.overlay} onClick={handleOverlayClick}>
            <div style={styles.modal}>
                {/* 헤더 */}
                <div style={styles.header}>
                    <h2 style={styles.headerTitle}>나만의 챌린지 만들기</h2>
                    <button style={styles.closeButton} onClick={handleClose}>
                        <X size={24} />
                    </button>
                </div>

                {/* 콘텐츠 */}
                <div style={styles.content}>


                    {/* Details 입력 */}
                    <div style={styles.inputGroup}>
                        <label style={styles.label}>DETAILS</label>
                        <div style={styles.textareaWrapper}>
                            <textarea
                                style={styles.textarea}
                                placeholder="예: 외식을 줄여서 절약하고 싶어요."
                                value={details}
                                onChange={(e) => setDetails(e.target.value.slice(0, 300))}
                                maxLength={300}
                            />
                            <span style={styles.charCount}>{details.length} / 300</span>
                        </div>
                    </div>

                    {/* Difficulty 선택 */}
                    <div style={styles.inputGroup}>
                        <label style={styles.label}>DIFFICULTY</label>
                        <div style={styles.difficultyRow}>
                            <button
                                type="button"
                                style={getDifficultyStyle('easy')}
                                onClick={() => setDifficulty('easy')}
                            >
                                Easy
                            </button>
                            <button
                                type="button"
                                style={getDifficultyStyle('medium')}
                                onClick={() => setDifficulty('medium')}
                            >
                                Medium
                            </button>
                            <button
                                type="button"
                                style={getDifficultyStyle('hard')}
                                onClick={() => setDifficulty('hard')}
                            >
                                Hard
                            </button>
                        </div>
                    </div>

                    {/* 생성 버튼 */}
                    <button
                        style={{
                            ...styles.generateButton,
                            opacity: isLoading ? 0.7 : 1,
                            cursor: isLoading ? 'not-allowed' : 'pointer',
                        }}
                        onClick={handleGenerate}
                        disabled={isLoading}
                    >
                        <Sparkles size={18} />
                        <span>{isLoading ? 'AI가 챌린지를 생성 중...' : 'AI로 챌린지 생성하기'}</span>
                    </button>
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
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem',
    },
    modal: {
        backgroundColor: 'white',
        borderRadius: '20px',
        width: '100%',
        maxWidth: '360px',
        maxHeight: '90vh',
        overflow: 'hidden',
        position: 'relative',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '1.25rem 1.5rem',
        borderBottom: '1px solid #E5E7EB',
    },
    headerTitle: {
        fontSize: '1.1rem',
        fontWeight: '700',
        color: 'var(--text-main)',
        margin: 0,
    },
    closeButton: {
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '4px',
        color: 'var(--text-sub)',
    },
    content: {
        padding: '1.5rem',
        overflowY: 'auto',
        maxHeight: 'calc(90vh - 80px)',
    },
    inputGroup: {
        marginBottom: '1.5rem',
    },
    label: {
        display: 'block',
        fontSize: '0.75rem',
        fontWeight: '600',
        color: 'var(--text-sub)',
        marginBottom: '8px',
        letterSpacing: '0.5px',
    },
    input: {
        width: '100%',
        padding: '14px 16px',
        borderRadius: '12px',
        border: '1px solid #E5E7EB',
        fontSize: '1rem',
        color: 'var(--text-main)',
        backgroundColor: '#F9FAFB',
        outline: 'none',
        boxSizing: 'border-box',
    },
    textareaWrapper: {
        position: 'relative',
    },
    textarea: {
        width: '100%',
        padding: '14px 16px',
        borderRadius: '12px',
        border: '1px solid #E5E7EB',
        fontSize: '1rem',
        color: 'var(--text-main)',
        backgroundColor: '#F9FAFB',
        outline: 'none',
        resize: 'none',
        minHeight: '120px',
        fontFamily: 'inherit',
        boxSizing: 'border-box',
    },
    charCount: {
        position: 'absolute',
        bottom: '10px',
        right: '12px',
        fontSize: '0.75rem',
        color: 'var(--text-sub)',
    },
    difficultyRow: {
        display: 'flex',
        gap: '10px',
    },
    generateButton: {
        width: '100%',
        padding: '16px',
        borderRadius: '12px',
        backgroundColor: 'var(--primary)',
        color: 'white',
        border: 'none',
        fontSize: '1rem',
        fontWeight: '600',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        marginTop: '0.5rem',
    },
};

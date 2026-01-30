/**
 * [파일 역할]
 * - AI가 생성한 챌린지 미리보기 모달
 * - 수정 가능한 필드 제공
 * - 저장하기 버튼
 */
import { useState, useEffect } from 'react';
import { X, Clock, Wallet, Check, ShoppingCart, Utensils, Coffee, MapPin, FileText, Target, Dumbbell, Zap, Sparkles } from 'lucide-react';

// 아이콘 컴포넌트 매핑
const getIcon = (iconName, color) => {
    const iconProps = { size: 48, color };
    switch (iconName) {
        case 'shopping': return <ShoppingCart {...iconProps} />;
        case 'shopping-bag': return <ShoppingCart {...iconProps} />;
        case 'food': return <Utensils {...iconProps} />;
        case 'utensils': return <Utensils {...iconProps} />;
        case 'wallet': return <Wallet {...iconProps} />;
        case 'coffee': return <Coffee {...iconProps} />;
        case 'walk': return <MapPin {...iconProps} />;
        case 'document': return <FileText {...iconProps} />;
        case 'target': return <Target {...iconProps} />;
        case 'snack': return <Dumbbell {...iconProps} />;
        case 'sparkles': return <Sparkles {...iconProps} />;
        default: return <Zap {...iconProps} />;
    }
};

// 아이콘별 배경색 매핑
const iconColorMap = {
    shopping: '#E8F4FD',
    'shopping-bag': '#E8F4FD',
    food: '#FFEDD5',
    utensils: '#FFEDD5',
    wallet: '#D1FAE5',
    coffee: '#FCE7F3',
    walk: '#DBEAFE',
    document: '#F3E8FF',
    target: '#FEE2E2',
    snack: '#FEF3C7',
    sparkles: '#E0E7FF',
    default: '#D1FAE5'
};

// 난이도 라벨 매핑
const getDifficultyLabel = (difficulty) => {
    const diffLower = difficulty?.toLowerCase();
    switch (diffLower) {
        case '쉬움':
        case 'easy':
            return 'EASY';
        case '보통':
        case 'medium':
            return 'MEDIUM';
        case '어려움':
        case 'hard':
            return 'HARD';
        default:
            return 'MEDIUM';
    }
};

// 난이도 배지 스타일
const getDifficultyStyle = (difficulty) => {
    const diffLower = difficulty?.toLowerCase();
    switch (diffLower) {
        case '쉬움':
        case 'easy':
            return { backgroundColor: '#DCFCE7', color: '#16A34A' };
        case '보통':
        case 'medium':
            return { backgroundColor: '#FEF3C7', color: '#CA8A04' };
        case '어려움':
        case 'hard':
            return { backgroundColor: '#FEE2E2', color: '#DC2626' };
        default:
            return { backgroundColor: '#F3F4F6', color: '#6B7280' };
    }
};

export default function AIGeneratedChallengeModal({
    isOpen,
    onClose,
    challengeData,
    onSave,
    isSaving,
    source = 'custom' // 'custom' or 'coaching'
}) {
    const [editedData, setEditedData] = useState({});

    useEffect(() => {
        if (challengeData) {
            setEditedData({
                name: challengeData.name || '',
                description: challengeData.description || '',
                icon: challengeData.icon || 'target',
                icon_color: challengeData.icon_color || '#4CAF50',
                difficulty: challengeData.difficulty || 'medium',
                duration_days: challengeData.duration_days || 7,
                base_points: challengeData.base_points || 100,
                estimated_savings: challengeData.estimated_savings || 0,
                success_conditions: challengeData.success_conditions || [],
                target_amount: challengeData.target_amount,
                target_categories: challengeData.target_categories || [],
            });
        }
    }, [challengeData]);

    if (!isOpen || !challengeData) return null;

    const handleOverlayClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    const handleSave = () => {
        onSave(editedData);
    };

    const handleInputChange = (field, value) => {
        setEditedData(prev => ({ ...prev, [field]: value }));
    };

    const iconBgColor = iconColorMap[editedData.icon] || iconColorMap.default;

    return (
        <div style={styles.overlay} onClick={handleOverlayClick}>
            <div style={styles.modal}>
                {/* 닫기 버튼 */}
                <button style={styles.closeButton} onClick={onClose}>
                    <X size={24} />
                </button>

                {/* 상단 아이콘 영역 */}
                <div style={{
                    ...styles.iconArea,
                    backgroundColor: iconBgColor,
                }}>
                    <div style={styles.iconContainer}>
                        {getIcon(editedData.icon, editedData.icon_color)}
                    </div>
                </div>

                {/* 콘텐츠 영역 */}
                <div style={styles.content}>
                    {/* 난이도 배지 */}
                    <div style={{
                        ...styles.difficultyBadge,
                        ...getDifficultyStyle(editedData.difficulty),
                    }}>
                        난이도: {getDifficultyLabel(editedData.difficulty)}
                    </div>

                    {/* 타이틀 */}
                    <input
                        type="text"
                        style={styles.titleInput}
                        value={editedData.name || ''}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        placeholder="챌린지 이름"
                    />

                    {/* 포인트 & 기간 & 예상 절약 */}
                    <div style={styles.infoRow}>
                        <div style={styles.infoItem}>
                            <span style={styles.infoLabel}>포인트</span>
                            <span style={styles.infoValue}>{editedData.base_points}P</span>
                        </div>
                        <div style={styles.divider}></div>
                        <div style={styles.infoItem}>
                            <span style={styles.infoLabel}>기간</span>
                            <span style={styles.infoValue}>{editedData.duration_days}일</span>
                        </div>
                        {editedData.estimated_savings > 0 && (
                            <>
                                <div style={styles.divider}></div>
                                <div style={styles.infoItem}>
                                    <span style={styles.infoLabel}>예상 절약</span>
                                    <span style={styles.infoValue}>₩{editedData.estimated_savings?.toLocaleString()}</span>
                                </div>
                            </>
                        )}
                    </div>

                    {/* 설명 */}
                    <textarea
                        style={styles.descriptionInput}
                        value={editedData.description || ''}
                        onChange={(e) => handleInputChange('description', e.target.value)}
                        placeholder="챌린지 설명을 입력하세요"
                        rows={3}
                    />

                    {/* 성공 조건 */}
                    {editedData.success_conditions && editedData.success_conditions.length > 0 && (
                        <div style={styles.successConditions}>
                            <div style={styles.successHeader}>
                                <Check size={18} color="var(--primary)" />
                                <span>성공 조건</span>
                            </div>
                            <ul style={styles.conditionList}>
                                {editedData.success_conditions.map((condition, index) => (
                                    <li key={index} style={styles.conditionItem}>
                                        <Check size={14} color="var(--primary)" />
                                        <span>{condition}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* 저장 버튼 */}
                    <button
                        style={{
                            ...styles.saveButton,
                            opacity: isSaving ? 0.7 : 1,
                            cursor: isSaving ? 'not-allowed' : 'pointer',
                        }}
                        onClick={handleSave}
                        disabled={isSaving}
                    >
                        {isSaving ? '저장 중...' : '저장하기'}
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
    closeButton: {
        position: 'absolute',
        top: '12px',
        right: '12px',
        background: 'rgba(255,255,255,0.9)',
        border: 'none',
        borderRadius: '50%',
        width: '36px',
        height: '36px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        zIndex: 10,
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    },
    iconArea: {
        padding: '2rem',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
    },
    iconContainer: {
        width: '80px',
        height: '80px',
        borderRadius: '50%',
        backgroundColor: 'rgba(255,255,255,0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    content: {
        padding: '1.5rem',
        overflowY: 'auto',
        maxHeight: 'calc(90vh - 180px)',
    },
    difficultyBadge: {
        display: 'inline-block',
        padding: '6px 14px',
        borderRadius: '20px',
        fontSize: '0.8rem',
        fontWeight: '600',
        marginBottom: '12px',
    },
    titleInput: {
        width: '100%',
        fontSize: '1.25rem',
        fontWeight: '700',
        color: 'var(--text-main)',
        marginBottom: '12px',
        border: '1px solid #E5E7EB',
        borderRadius: '8px',
        padding: '10px 12px',
        outline: 'none',
        boxSizing: 'border-box',
    },
    infoRow: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        marginBottom: '16px',
        backgroundColor: '#F9FAFB',
        padding: '14px',
        borderRadius: '12px',
    },
    infoItem: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '2px',
    },
    infoLabel: {
        fontSize: '0.7rem',
        color: 'var(--text-sub)',
    },
    infoValue: {
        fontSize: '1rem',
        fontWeight: '700',
        color: 'var(--primary)',
    },
    divider: {
        width: '1px',
        height: '24px',
        backgroundColor: '#D1D5DB',
    },
    descriptionInput: {
        width: '100%',
        fontSize: '0.95rem',
        lineHeight: '1.6',
        color: 'var(--text-sub)',
        marginBottom: '16px',
        border: '1px solid #E5E7EB',
        borderRadius: '8px',
        padding: '10px 12px',
        outline: 'none',
        resize: 'none',
        fontFamily: 'inherit',
        boxSizing: 'border-box',
    },
    successConditions: {
        backgroundColor: '#F9FAFB',
        padding: '14px',
        borderRadius: '12px',
        marginBottom: '16px',
    },
    successHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '0.95rem',
        fontWeight: '600',
        color: 'var(--text-main)',
        marginBottom: '10px',
    },
    conditionList: {
        listStyle: 'none',
        padding: 0,
        margin: 0,
    },
    conditionItem: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '0.9rem',
        color: 'var(--text-sub)',
        marginBottom: '6px',
    },
    saveButton: {
        width: '100%',
        padding: '16px',
        borderRadius: '12px',
        backgroundColor: 'var(--primary)',
        color: 'white',
        border: 'none',
        fontSize: '1rem',
        fontWeight: '600',
        cursor: 'pointer',
    },
};

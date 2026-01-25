/**
 * [파일 역할]
 * - 챌린지 카드 컴포넌트
 * - 리스트 형태로 개별 챌린지 아이템 표시
 */
import { ShoppingCart, Utensils, Wallet, Coffee, MapPin, FileText, Target, Dumbbell, Zap, Sparkles } from 'lucide-react';

// 아이콘 컴포넌트 매핑
const getIcon = (iconName, color) => {
    const iconProps = { size: 24, color };
    switch (iconName) {
        case 'shopping': return <ShoppingCart {...iconProps} />;
        case 'food': return <Utensils {...iconProps} />;
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

// 난이도 스타일
const getDifficultyStyle = (difficulty) => {
    switch (difficulty) {
        case '쉬움':
            return { color: '#16A34A' };
        case '보통':
            return { color: '#F59E0B' };
        case '어려움':
            return { color: '#DC2626' };
        default:
            return { color: '#6B7280' };
    }
};

// 난이도 라벨 매핑
const getDifficultyLabel = (difficulty) => {
    switch (difficulty) {
        case '쉬움': return 'EASY';
        case '보통': return 'MEDIUM';
        case '어려움': return 'HARD';
        default: return 'MEDIUM';
    }
};

export default function ChallengeCard({ challenge, onStart, onRetry, onClick, isOngoing }) {
    const handleCardClick = (e) => {
        // 버튼 클릭은 전파하지 않음
        if (e.target.tagName === 'BUTTON') return;
        onClick?.(challenge);
    };

    const handleButtonClick = (e) => {
        e.stopPropagation();
        if (isOngoing || challenge.progress !== undefined) {
            onClick?.(challenge);
        } else if (challenge.failedDate) {
            onRetry?.(challenge);
        } else {
            onClick?.(challenge);
        }
    };

    // 버튼 텍스트 결정
    const getButtonText = () => {
        if (isOngoing || challenge.progress !== undefined) {
            return '진행중';
        }
        if (challenge.failedDate) {
            return '재도전';
        }
        return '참여하기';
    };

    // 버튼 스타일 결정
    const getButtonStyle = () => {
        if (isOngoing || challenge.progress !== undefined) {
            return styles.statusButton;
        }
        if (challenge.failedDate) {
            return { ...styles.joinButton, backgroundColor: '#EF4444' };
        }
        return styles.joinButton;
    };

    return (
        <div style={styles.card} onClick={handleCardClick}>
            {/* 왼쪽: 아이콘 */}
            <div style={{
                ...styles.iconContainer,
                backgroundColor: challenge.color || '#E0F2FE',
            }}>
                {getIcon(challenge.icon, challenge.iconColor || '#0EA5E9')}
            </div>

            {/* 가운데: 정보 */}
            <div style={styles.infoContainer}>
                {/* 상단: 난이도 + 태그 */}
                <div style={styles.topRow}>
                    <span style={{
                        ...styles.difficultyLabel,
                        ...getDifficultyStyle(challenge.difficulty),
                    }}>
                        {getDifficultyLabel(challenge.difficulty)}
                    </span>
                    {challenge.category && (
                        <span style={styles.categoryTag}>#{challenge.category}</span>
                    )}
                </div>

                {/* 타이틀 */}
                <div style={styles.title}>{challenge.title}</div>

                {/* 설명 또는 진행률 */}
                {isOngoing || challenge.progress !== undefined ? (
                    <div style={styles.progressInfo}>
                        {challenge.daysLeft !== undefined && (
                            <span style={styles.daysLeft}>D-{challenge.daysLeft}</span>
                        )}
                    </div>
                ) : (
                    <div style={styles.description}>
                        {challenge.description?.substring(0, 30) ||
                            `예상 절약액 ${challenge.estimatedSavings?.toLocaleString() || 0}원`}
                    </div>
                )}

                {/* AI 추천 이유 */}
                {challenge.aiReason && (
                    <div style={styles.aiReason}>
                        <Sparkles size={12} />
                        <span>{challenge.aiReason}</span>
                    </div>
                )}
            </div>

            {/* 오른쪽: 포인트 + 버튼 */}
            <div style={styles.rightContainer}>
                {/* 진행중 표시 */}
                {(isOngoing || challenge.progress !== undefined) && (
                    <span style={styles.ongoingBadge}>ONGOING</span>
                )}

                {/* 포인트 */}
                <div style={styles.points}>{challenge.points}P</div>

                {/* 액션 버튼 */}
                <button
                    style={getButtonStyle()}
                    onClick={handleButtonClick}
                >
                    {getButtonText()}
                </button>
            </div>
        </div>
    );
}

const styles = {
    card: {
        display: 'flex',
        alignItems: 'center',
        padding: '1rem',
        backgroundColor: 'white',
        borderRadius: '16px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        cursor: 'pointer',
        transition: 'transform 0.2s ease',
        gap: '12px',
    },
    iconContainer: {
        width: '48px',
        height: '48px',
        borderRadius: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    infoContainer: {
        flex: 1,
        minWidth: 0,
    },
    topRow: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '4px',
    },
    difficultyLabel: {
        fontSize: '0.7rem',
        fontWeight: '700',
    },
    categoryTag: {
        fontSize: '0.7rem',
        color: '#9CA3AF',
    },
    title: {
        fontSize: '0.95rem',
        fontWeight: '600',
        color: 'var(--text-main)',
        marginBottom: '2px',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
    },
    description: {
        fontSize: '0.75rem',
        color: 'var(--text-sub)',
    },
    progressInfo: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    },
    daysLeft: {
        fontSize: '0.75rem',
        color: '#10B981',
        fontWeight: '600',
    },
    aiReason: {
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        fontSize: '0.7rem',
        color: 'var(--primary)',
        marginTop: '4px',
    },
    rightContainer: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: '6px',
        flexShrink: 0,
    },
    ongoingBadge: {
        fontSize: '0.65rem',
        fontWeight: '600',
        color: '#10B981',
    },
    points: {
        fontSize: '1rem',
        fontWeight: '700',
        color: 'var(--text-main)',
    },
    joinButton: {
        padding: '6px 16px',
        borderRadius: '4px',
        border: 'none',
        backgroundColor: '#10B981',
        color: 'white',
        fontSize: '0.75rem',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
    },
    statusButton: {
        padding: '5px 12px',
        borderRadius: '4px',
        border: '2px solid #10B981',
        backgroundColor: 'white',
        color: '#10B981',
        fontSize: '0.7rem',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
    },
};

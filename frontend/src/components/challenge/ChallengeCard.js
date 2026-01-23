/**
 * [파일 역할]
 * - 챌린지 카드 컴포넌트
 * - 개별 챌린지 아이템을 표시
 */
import { ShoppingCart, Utensils, Wallet, Coffee, MapPin, FileText, Target, Dumbbell, Zap, Sparkles } from 'lucide-react';

// 아이콘 컴포넌트 매핑
const getIcon = (iconName, color) => {
    const iconProps = { size: 32, color };
    switch (iconName) {
        case 'shopping': return <ShoppingCart {...iconProps} />;
        case 'food': return <Utensils {...iconProps} />;
        case 'wallet': return <Wallet {...iconProps} />;
        case 'coffee': return <Coffee {...iconProps} />;
        case 'walk': return <MapPin {...iconProps} />;
        case 'document': return <FileText {...iconProps} />;
        case 'target': return <Target {...iconProps} />;
        case 'snack': return <Dumbbell {...iconProps} />;
        default: return <Zap {...iconProps} />;
    }
};

// 난이도 배지 스타일
const getDifficultyStyle = (difficulty) => {
    switch (difficulty) {
        case '쉬움':
            return { backgroundColor: '#DCFCE7', color: '#16A34A' };
        case '보통':
            return { backgroundColor: '#E0E7FF', color: '#4F46E5' };
        case '어려움':
            return { backgroundColor: '#FEE2E2', color: '#DC2626' };
        default:
            return { backgroundColor: '#F3F4F6', color: '#6B7280' };
    }
};

export default function ChallengeCard({ challenge, onStart, onRetry, onClick }) {
    const handleCardClick = (e) => {
        // 버튼 클릭은 전파하지 않음
        if (e.target.tagName === 'BUTTON') return;
        onClick?.(challenge);
    };

    return (
        <div
            style={{
                ...styles.card,
                backgroundColor: challenge.color,
            }}
            onClick={handleCardClick}
        >
            {/* 난이도 배지 */}
            <div style={{
                ...styles.difficultyBadge,
                ...getDifficultyStyle(challenge.difficulty),
            }}>
                {challenge.difficulty}
            </div>

            {/* 아이콘 */}
            <div style={styles.iconContainer}>
                {getIcon(challenge.icon, challenge.iconColor)}
            </div>

            {/* 포인트 */}
            <div style={styles.cardPoints}>
                {challenge.points}P
            </div>

            {/* 타이틀 */}
            <div style={styles.cardTitle}>
                {challenge.title}
            </div>

            {/* 도전 중인 경우 진행률 표시 */}
            {challenge.progress !== undefined && (
                <div style={styles.progressContainer}>
                    <div style={styles.progressBar}>
                        <div style={{
                            ...styles.progressFill,
                            width: `${challenge.progress}%`,
                        }} />
                    </div>
                    <span style={styles.progressText}>
                        {challenge.daysLeft}일 남음
                    </span>
                </div>
            )}

            {/* 실패한 경우 날짜 표시 */}
            {challenge.failedDate && (
                <div style={styles.failedDate}>
                    {challenge.failedDate} 실패
                </div>
            )}

            {/* AI 추천 이유 */}
            {challenge.aiReason && (
                <div style={styles.aiReason}>
                    <Sparkles size={12} />
                    <span>{challenge.aiReason}</span>
                </div>
            )}

            {/* 시작 버튼 */}
            {!challenge.progress && !challenge.failedDate && (
                <button
                    style={styles.startButton}
                    onClick={(e) => {
                        e.stopPropagation();
                        onClick?.(challenge);
                    }}
                >
                    시작하기
                </button>
            )}

            {/* 재도전 버튼 (실패한 챌린지) */}
            {challenge.failedDate && (
                <button
                    style={{ ...styles.startButton, backgroundColor: '#EF4444' }}
                    onClick={(e) => {
                        e.stopPropagation();
                        onRetry?.(challenge);
                    }}
                >
                    재도전
                </button>
            )}
        </div>
    );
}

const styles = {
    card: {
        position: 'relative',
        padding: '1rem',
        borderRadius: '16px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        cursor: 'pointer',
        transition: 'transform 0.2s ease',
    },
    difficultyBadge: {
        position: 'absolute',
        top: '10px',
        right: '10px',
        padding: '4px 8px',
        borderRadius: '10px',
        fontSize: '0.7rem',
        fontWeight: '600',
    },
    iconContainer: {
        width: '56px',
        height: '56px',
        borderRadius: '50%',
        backgroundColor: 'rgba(255,255,255,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '8px',
    },
    cardPoints: {
        fontSize: '1.1rem',
        fontWeight: '700',
        color: 'var(--text-main)',
        marginBottom: '4px',
    },
    cardTitle: {
        fontSize: '0.85rem',
        fontWeight: '500',
        color: 'var(--text-main)',
        lineHeight: '1.3',
        marginBottom: '10px',
        minHeight: '36px',
    },
    startButton: {
        padding: '6px 24px',
        borderRadius: '20px',
        backgroundColor: 'var(--primary)',
        color: 'white',
        border: 'none',
        fontSize: '0.8rem',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
    },
    progressContainer: {
        width: '100%',
        marginBottom: '8px',
    },
    progressBar: {
        width: '100%',
        height: '6px',
        backgroundColor: 'rgba(0,0,0,0.1)',
        borderRadius: '3px',
        overflow: 'hidden',
        marginBottom: '4px',
    },
    progressFill: {
        height: '100%',
        backgroundColor: 'var(--primary)',
        borderRadius: '3px',
        transition: 'width 0.3s ease',
    },
    progressText: {
        fontSize: '0.7rem',
        color: 'var(--text-sub)',
    },
    failedDate: {
        fontSize: '0.7rem',
        color: '#EF4444',
        marginBottom: '8px',
    },
    aiReason: {
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        fontSize: '0.7rem',
        color: 'var(--primary)',
        marginBottom: '8px',
    },
};

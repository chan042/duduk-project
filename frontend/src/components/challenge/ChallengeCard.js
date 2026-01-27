/**
 * [파일 역할]
 * - 챌린지 카드 컴포넌트
 * - 리스트 형태로 개별 챌린지 아이템 표시
 * - 새로운 UserChallenge 모델에 맞게 progress 객체 처리
 */
import { ShoppingCart, Utensils, Wallet, Coffee, MapPin, FileText, Target, Dumbbell, Zap, Sparkles, Camera, Edit3 } from 'lucide-react';

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
    const diffLower = difficulty?.toLowerCase();
    switch (diffLower) {
        case '쉬움':
        case 'easy':
            return { color: '#16A34A' };
        case '보통':
        case 'medium':
            return { color: '#EAB308' };
        case '어려움':
        case 'hard':
            return { color: '#DC2626' };
        default:
            return { color: '#6B7280' };
    }
};

// 난이도 라벨 매핑 (EASY/MEDIUM/HARD로 통일)
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

// progress 객체에서 percentage 추출
const getProgressPercent = (progress) => {
    if (!progress) return 0;
    if (typeof progress === 'number') return progress;
    if (typeof progress === 'object') {
        if (progress.current !== undefined && progress.target > 0) {
            return (progress.current / progress.target) * 100;
        }
        return progress.percentage || 0;
    }
    return 0;
};

// progress 객체에서 실제 수치 텍스트 추출
const getProgressText = (progress, durationDays) => {
    if (!progress || typeof progress !== 'object') return null;

    const type = progress.type;

    if (type === 'amount' || type === 'compare' || type === 'random_budget') {
        // 금액형: 현재 금액 / 목표 금액
        const current = progress.current || 0;
        const target = progress.target || 0;
        return `${current.toLocaleString()}원 / ${target.toLocaleString()}원`;
    } else if (type === 'daily_check') {
        // 기간형(일일 체크): 현재 경과일 / 전체 기간
        const checkedDays = progress.checked_days || progress.checkedDays || 0;
        const totalDays = progress.total_days || progress.totalDays || durationDays || 0;
        return `${checkedDays}일 / ${totalDays}일`;
    } else if (type === 'photo') {
        // 횟수형(사진 인증): 현재 횟수 / 목표 횟수
        const photoCount = progress.photo_count || progress.photoCount || 0;
        const requiredCount = progress.required_count || progress.requiredCount || 1;
        return `${photoCount}회 / ${requiredCount}회`;
    } else if (type === 'zero_spend') {
        // 무지출형: 현재 지출액
        const current = progress.current || 0;
        return current === 0 ? '무지출 유지 중!' : `${current.toLocaleString()}원 지출`;
    } else if (type === 'daily_rule') {
        // 일별 규칙형: 성공 일수 / 전체 일수
        const successDays = progress.success_days || 0;
        const totalDays = progress.total_days || durationDays || 7;
        return `${successDays}일 / ${totalDays}일 성공`;
    }

    return null;
};

export default function ChallengeCard({ challenge, onStart, onRetry, onClick, isOngoing }) {
    const handleCardClick = (e) => {
        // 버튼 클릭은 전파하지 않음
        if (e.target.tagName === 'BUTTON') return;
        onClick?.(challenge);
    };

    const handleButtonClick = (e) => {
        e.stopPropagation();
        const progressPercent = getProgressPercent(challenge.progress);

        if (isOngoing || progressPercent > 0 || challenge.status === 'active') {
            onClick?.(challenge);
        } else if (challenge.failedDate || challenge.status === 'failed') {
            onRetry?.(challenge);
        } else {
            onClick?.(challenge);
        }
    };

    // 버튼 텍스트 결정
    const getButtonText = () => {
        const progressPercent = getProgressPercent(challenge.progress);

        if (isOngoing || challenge.status === 'active') {
            return '진행중';
        }
        if (challenge.failedDate || challenge.status === 'failed') {
            return '재도전';
        }
        if (challenge.status === 'completed') {
            return '완료';
        }
        return '시작하기';
    };

    // 버튼 스타일 결정
    const getButtonStyle = () => {
        if (isOngoing || challenge.status === 'active') {
            return styles.statusButton;
        }
        if (challenge.failedDate || challenge.status === 'failed') {
            return { ...styles.joinButton, backgroundColor: '#EF4444' };
        }
        if (challenge.status === 'completed') {
            return { ...styles.statusButton, borderColor: '#10B981', color: '#10B981' };
        }
        return styles.joinButton;
    };

    const progressPercent = getProgressPercent(challenge.progress);

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
                    {challenge.category && challenge.category !== 'all' && (
                        <span style={styles.categoryTag}>#{challenge.category}</span>
                    )}
                    {challenge.sourceType && (
                        <span style={styles.sourceTag}>
                            {challenge.sourceType === 'ai' ? '🤖 AI' :
                                challenge.sourceType === 'custom' ? '✨ 커스텀' : ''}
                        </span>
                    )}
                    {/* 사진 인증 필요 표시 */}
                    {challenge.requiresPhoto && (
                        <span style={styles.photoTag}>
                            <Camera size={10} />
                        </span>
                    )}
                    {/* 사용자 입력 필요 표시 */}
                    {challenge.userInputs && challenge.userInputs.length > 0 && (
                        <span style={styles.inputTag}>
                            <Edit3 size={10} />
                        </span>
                    )}
                </div>

                {/* 타이틀 */}
                <div style={styles.title}>{challenge.title}</div>

                {/* 설명 또는 진행률 */}
                {(isOngoing || challenge.status === 'active') && (
                    <div style={styles.progressInfo}>
                        <div style={styles.progressBarContainer}>
                            <div style={{
                                ...styles.progressBarFill,
                                width: `${Math.min(100, progressPercent)}%`
                            }} />
                        </div>
                        {getProgressText(challenge.progressData || challenge.progress, challenge.durationDays) && (
                            <span style={styles.progressText}>
                                {getProgressText(challenge.progressData || challenge.progress, challenge.durationDays)}
                            </span>
                        )}
                        {challenge.daysLeft !== undefined && (
                            <span style={styles.daysLeft}>D-{challenge.daysLeft}</span>
                        )}
                    </div>
                )}

                <div style={styles.description}>
                    {challenge.description?.substring(0, 30) ||
                        challenge.successDescription?.substring(0, 30) ||
                        `${challenge.durationDays || challenge.duration || 7}일 챌린지`}
                </div>

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
                {(isOngoing || challenge.status === 'active') && (
                    <span style={styles.ongoingBadge}>ONGOING</span>
                )}

                {/* 포인트 */}
                <div style={styles.points}>{challenge.points || challenge.basePoints || 0}P</div>

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
    sourceTag: {
        fontSize: '0.65rem',
        color: '#6366F1',
    },
    photoTag: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '18px',
        height: '18px',
        borderRadius: '50%',
        backgroundColor: '#DBEAFE',
        color: '#3B82F6',
    },
    inputTag: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '18px',
        height: '18px',
        borderRadius: '50%',
        backgroundColor: '#FEF3C7',
        color: '#F59E0B',
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
    progressBarContainer: {
        flex: 1,
        height: '4px',
        backgroundColor: '#E5E7EB',
        borderRadius: '2px',
        overflow: 'hidden',
        maxWidth: '80px',
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: '#10B981',
        borderRadius: '2px',
        transition: 'width 0.3s ease',
    },
    progressText: {
        fontSize: '0.7rem',
        color: 'var(--text-sub)',
        whiteSpace: 'nowrap',
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

/**
 * 챌린지 카드 컴포넌트
 * - 챌린지 목록의 개별 카드 표시
 * - 상태에 따른 버튼 스타일/텍스트 렌더링
 * - 진행중인 UserChallenge의 progress 데이터 표시
 * - ready 상태의 챌린지는 비활성화 스타일로 표시
 */
import { Camera, Edit3 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
    getDifficultyLabel,
    getDifficultyStyle,
    getCharacterFace,
    getChallengeDdayLabel,
} from '@/lib/challengeUtils';
import { useChallenge } from './useChallenge';


export default function ChallengeCard({ challenge, onStart, onRetry, onClaimReward, onClick, isOngoing }) {
    const { user } = useAuth();
    const characterType = user?.character_type || 'ham';

    const {
        isActive,
        isFailed,
        isCompleted,
        isReady,
        isUnavailable,
        isSaved,
        progressPercent,
        getButtonText,
        getButtonType,
        getProgressDisplayText,
        getPointsDisplay,
    } = useChallenge(challenge, isOngoing);

    const handleCardClick = (e) => {
        // 버튼 클릭 시 카드 클릭 이벤트 무시
        if (e.target.tagName === 'BUTTON') return;
        onClick?.(challenge);
    };

    const handleButtonClick = (e) => {
        e.stopPropagation();
        if (isUnavailable) return;
        if (isReady) return;
        if (isCompleted) {
            onClaimReward?.(challenge);
        } else if (isActive || progressPercent > 0) {
            onClick?.(challenge);
        } else if (isFailed) {
            onRetry?.(challenge);
        } else {
            onClick?.(challenge);
        }
    };

    // 버튼 타입에 따른 스타일 반환
    const getButtonStyle = (buttonType) => {
        switch (buttonType) {
            case 'active':
                return styles.statusButton;
            case 'failed':
                return { ...styles.joinButton, backgroundColor: '#EF4444' };
            case 'completed':
                return { ...styles.statusButton, borderColor: 'var(--primary)', color: 'var(--primary)' };
            case 'reward':
                return styles.rewardButton;
            case 'ready':
                return styles.readyDisabledButton;
            case 'unavailable':
                return styles.unavailableButton;
            case 'saved':
                return styles.joinButton;
            default:
                return styles.joinButton;
        }
    };

    const buttonType = getButtonType();
    const ddayLabel = getChallengeDdayLabel(challenge);

    return (
        <div className={isCompleted ? 'golden-glow-card' : ''} style={isCompleted ? styles.glowWrapper : {}}>
            <div style={styles.card} onClick={handleCardClick}>
                {/* 상단 영역: 캐릭터 이미지와 정보 */}
                <div style={styles.mainContent}>
                    {/* 왼쪽: 캐릭터 이미지 표시 */}
                    <div style={styles.iconContainer}>
                        <img
                            src={getCharacterFace(challenge.difficulty, characterType)}
                            alt="character"
                            style={styles.characterImage}
                        />
                    </div>

                    {/* 중앙 정보 영역 */}
                    <div style={styles.infoContainer}>
                        {/* 상단 행: 난이도 + 태그 */}
                        <div style={styles.topRow}>
                            <span style={{
                                ...styles.difficultyLabel,
                                ...getDifficultyStyle(challenge.difficulty),
                            }}>
                                {getDifficultyLabel(challenge.difficulty)}
                            </span>
                            {/* 사진 인증 필요 태그 표시 */}
                            {challenge.requiresPhoto && (
                                <span style={styles.photoTag}>
                                    <Camera size={10} />
                                </span>
                            )}
                            {/* 사용자 입력 필요 태그 표시 */}
                            {challenge.userInputs && challenge.userInputs.length > 0 && (
                                <span style={styles.inputTag}>
                                    <Edit3 size={10} />
                                </span>
                            )}
                        </div>

                        {/* 챌린지 제목 */}
                        <div style={styles.title}>{challenge.title}</div>

                        {/* 설명 표시 */}
                        {challenge.description && (
                            <div style={styles.description}>
                                {challenge.description}
                            </div>
                        )}
                        {isUnavailable && challenge.unavailableReason && (
                            <div style={styles.unavailableReason}>
                                {challenge.unavailableReason}
                            </div>
                        )}

                        {/* 진행률 정보 (진행중인 챌린지에만 표시) */}
                        {isActive && (
                            <div style={styles.progressInfo}>
                                {getProgressDisplayText() && (
                                    <span style={styles.progressText}>
                                        {getProgressDisplayText()}
                                    </span>
                                )}
                                {ddayLabel && (
                                    <span style={styles.daysLeft}>{ddayLabel}</span>
                                )}
                            </div>
                        )}



                    </div>

                    {/* 오른쪽: 포인트 + 버튼 */}
                    <div style={styles.rightContainer}>
                        {/* 포인트 */}
                        <div style={styles.points}>
                            {getPointsDisplay()}
                        </div>

                        {/* 액션 버튼 */}
                        <button
                            style={getButtonStyle(buttonType)}
                            onClick={handleButtonClick}
                            disabled={buttonType === 'ready' || buttonType === 'unavailable'}
                        >
                            {getButtonText()}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

const styles = {
    card: {
        display: 'flex',
        flexDirection: 'column',
        padding: '1rem',
        backgroundColor: 'white',
        borderRadius: '16px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        cursor: 'pointer',
        transition: 'transform 0.2s ease',
        gap: '10px',
        position: 'relative',
        zIndex: 2,
    },
    glowWrapper: {
        position: 'relative',
        borderRadius: '16px',
    },
    mainContent: {
        display: 'flex',
        alignItems: 'center',
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
        overflow: 'hidden',
    },
    characterImage: {
        width: '100%',
        height: '100%',
        objectFit: 'contain',
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
        fontSize: '1.1rem',
        fontWeight: '700',
        color: 'var(--text-main)',
        marginBottom: '2px',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
    },
    description: {
        fontSize: '0.75rem',
        color: 'var(--text-sub)',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        marginTop: '2px',
    },
    unavailableReason: {
        fontSize: '0.72rem',
        color: '#9CA3AF',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        marginTop: '2px',
    },
    progressInfo: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginTop: '4px',
    },
    progressText: {
        fontSize: '0.75rem',
        color: 'var(--text-sub)',
        whiteSpace: 'nowrap',
    },
    daysLeft: {
        fontSize: '0.75rem',
        color: 'var(--primary)',
        fontWeight: '600',
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
        color: 'var(--primary)',
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
        backgroundColor: 'var(--primary)',
        color: 'white',
        fontSize: '0.75rem',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        minWidth: '65px',
        textAlign: 'center',
    },
    statusButton: {
        padding: '6px 16px',
        borderRadius: '4px',
        border: '2px solid var(--primary)',
        backgroundColor: 'white',
        color: 'var(--primary)',
        fontSize: '0.75rem',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        minWidth: '65px',
        textAlign: 'center',
    },
    readyDisabledButton: {
        padding: '6px 16px',
        borderRadius: '4px',
        border: '2px solid #D1D5DB',
        backgroundColor: '#F3F4F6',
        color: '#9CA3AF',
        fontSize: '0.75rem',
        fontWeight: '600',
        cursor: 'not-allowed',
        transition: 'all 0.2s ease',
        minWidth: '65px',
        textAlign: 'center',
        whiteSpace: 'nowrap',
    },
    unavailableButton: {
        padding: '6px 16px',
        borderRadius: '4px',
        border: '2px solid #E5E7EB',
        backgroundColor: '#F9FAFB',
        color: '#9CA3AF',
        fontSize: '0.75rem',
        fontWeight: '600',
        cursor: 'not-allowed',
        transition: 'all 0.2s ease',
        minWidth: '65px',
        textAlign: 'center',
        whiteSpace: 'nowrap',
    },
    rewardButton: {
        padding: '6px 16px',
        borderRadius: '4px',
        border: 'none',
        backgroundColor: '#FFD700',
        color: 'white',
        fontSize: '0.75rem',
        fontWeight: '700',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        minWidth: '65px',
        textAlign: 'center',
    },
    rewardInfo: {
        fontSize: '0.73rem',
        color: '#D97706',
        fontWeight: '600',
        marginTop: '4px',
    },
};

/**
 * [파일 역할]
 * - 챌린지 카드 컴포넌트
 * - 리스트 형태로 개별 챌린지 아이템 표시
 * - 새로운 UserChallenge 모델에 맞게 progress 객체 처리
 * - 난이도별 두둑 캐릭터 얼굴 아이콘 표시
 */
import { Camera, Edit3 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
    getDifficultyLabel,
    getDifficultyStyle,
    getCharacterFace,
} from '@/lib/challengeUtils';
import { useChallenge } from './useChallenge';


export default function ChallengeCard({ challenge, onStart, onRetry, onClick, isOngoing }) {
    const { user } = useAuth();
    const characterType = user?.character_type || 'ham';

    const {
        isActive,
        isFailed,
        progressPercent,
        getButtonText,
        getButtonType,
        getProgressDisplayText,
        getPointsDisplay,
    } = useChallenge(challenge, isOngoing);

    const handleCardClick = (e) => {
        // 버튼 클릭은 전파하지 않음
        if (e.target.tagName === 'BUTTON') return;
        onClick?.(challenge);
    };

    const handleButtonClick = (e) => {
        e.stopPropagation();
        if (isActive || progressPercent > 0) {
            onClick?.(challenge);
        } else if (isFailed) {
            onRetry?.(challenge);
        } else {
            onClick?.(challenge);
        }
    };

    // 버튼 스타일 결정
    const getButtonStyle = () => {
        const buttonType = getButtonType();
        switch (buttonType) {
            case 'active':
                return styles.statusButton;
            case 'failed':
                return { ...styles.joinButton, backgroundColor: '#EF4444' };
            case 'completed':
                return { ...styles.statusButton, borderColor: 'var(--primary)', color: 'var(--primary)' };
            default:
                return styles.joinButton;
        }
    };

    return (
        <div style={styles.card} onClick={handleCardClick}>
            {/* 상단: 메인 컨텐츠 영역 */}
            <div style={styles.mainContent}>
                {/* 왼쪽: 캐릭터 얼굴 아이콘 */}
                <div style={styles.iconContainer}>
                    <img
                        src={getCharacterFace(challenge.difficulty, characterType)}
                        alt="character"
                        style={styles.characterImage}
                    />
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

                    {/* 설명 표시 */}
                    {challenge.description && (
                        <div style={styles.description}>
                            {challenge.description}
                        </div>
                    )}

                    {/* 진행 정보 (진행률 바 없이 텍스트만) */}
                    {isActive && (
                        <div style={styles.progressInfo}>
                            {getProgressDisplayText() && (
                                <span style={styles.progressText}>
                                    {getProgressDisplayText()}
                                </span>
                            )}
                            {challenge.daysLeft !== undefined && (
                                <span style={styles.daysLeft}>D-{challenge.daysLeft}</span>
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
                        style={getButtonStyle()}
                        onClick={handleButtonClick}
                    >
                        {getButtonText()}
                    </button>
                </div>
            </div>

            {/* 하단: 진행률 바 (진행중인 챌린지만) */}
            {isActive && (
                <div style={styles.progressBarSection}>
                    <div style={styles.progressBarContainer}>
                        <div style={{
                            ...styles.progressBarFill,
                            width: `${Math.min(100, progressPercent)}%`
                        }} />
                    </div>
                </div>
            )}
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
    progressInfo: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginTop: '4px',
    },
    progressBarSection: {
        width: '100%',
        paddingTop: '4px',
        marginLeft: '60px',
    },
    progressBarContainer: {
        width: '60%',
        height: '6px',
        backgroundColor: '#E5E7EB',
        borderRadius: '3px',
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: 'var(--primary)',
        borderRadius: '3px',
        transition: 'width 0.3s ease',
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
};

/**
 * 챌린지 공통 훅
 * - 버튼 상태/스타일 결정 로직
 * - 진행률 표시 로직
 * - ChallengeCard, ChallengeDetailModal에서 공통 사용
 */
import { getProgressPercent, getProgressData, getProgressText } from '@/lib/challengeUtils';

/**
 * 챌린지 상태 및 버튼 로직을 처리하는 훅
 * @param {object} challenge
 * @param {boolean} isOngoing
 */
export const useChallenge = (challenge, isOngoing = false) => {
    const progressPercent = getProgressPercent(challenge?.progress);
    const progressData = getProgressData(challenge?.progress || challenge?.progressData);

    const isActive = isOngoing || challenge?.status === 'active';
    const isFailed = challenge?.status === 'failed' || !!challenge?.failedDate;
    const isCompleted = challenge?.status === 'completed';
    const isReady = challenge?.status === 'ready';

    /**
     * 버튼 텍스트 결정
     */
    const getButtonText = () => {
        if (isActive) return '도전중';
        if (isFailed) return '재도전';
        if (isCompleted) return '완료';
        if (isReady) return '시작하기';
        return '도전하기';
    };

    /**
     * 버튼 타입 결정
     * @returns {'active' | 'failed' | 'completed' | 'ready' | 'default'}
     */
    const getButtonType = () => {
        if (isActive) return 'active';
        if (isFailed) return 'failed';
        if (isCompleted) return 'completed';
        if (isReady) return 'ready';
        return 'default';
    };

    /**
     * 진행률 텍스트 반환
     */
    const getProgressDisplayText = () => {
        return getProgressText(
            challenge?.progressData || challenge?.progress,
            challenge?.durationDays
        );
    };

    /**
     * 포인트 표시 텍스트 반환
     */
    const getPointsDisplay = () => {
        const isRandomBudget =
            challenge?.progressType === 'random_budget' ||
            challenge?.displayConfig?.progress_type === 'random_budget' ||
            challenge?.successConditions?.type === 'random_budget';

        const points = challenge?.points || challenge?.basePoints || 0;

        if (isRandomBudget && (points === 0 || points === undefined || points === null)) {
            return '???P';
        }
        return `${points}P`;
    };

    return {
        isActive,
        isFailed,
        isCompleted,
        isReady,
        progressPercent,
        progressData,
        getButtonText,
        getButtonType,
        getProgressDisplayText,
        getPointsDisplay,
    };
};

export default useChallenge;


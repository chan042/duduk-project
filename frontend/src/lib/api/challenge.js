/**
 * [파일 역할]
 * - 챌린지 관련 API 호출 함수
 * - 백엔드 /api/challenges/ 엔드포인트와 통신
 */
import client from './client';

// 아이콘별 배경색 매핑
const iconColorMap = {
    shopping: '#E8F4FD',
    food: '#FFEDD5',
    wallet: '#D1FAE5',
    coffee: '#FCE7F3',
    walk: '#DBEAFE',
    document: '#F3E8FF',
    target: '#FEE2E2',
    snack: '#FEF3C7',
    default: '#F3F4F6'
};

// 난이도 정렬 순서 (쉬움 → 보통 → 어려움)
const difficultyOrder = { 'EASY': 1, 'MEDIUM': 2, 'HARD': 3 };

/**
 * 백엔드 응답을 프론트엔드 형식으로 변환
 */
const transformChallenge = (challenge) => ({
    id: challenge.id,
    title: challenge.name,
    description: challenge.description,
    icon: challenge.icon,
    iconColor: challenge.icon_color,
    color: iconColorMap[challenge.icon] || iconColorMap.default,
    points: challenge.points,
    difficulty: challenge.difficulty_display,
    duration: challenge.duration_days ? `${challenge.duration_days}일` : '진행중',
    category: challenge.keyword ? challenge.keyword.toLowerCase() : 'all',
    isUserCreated: challenge.is_user_created || false,
});

/**
 * UserChallenge 응답을 프론트엔드 형식으로 변환
 */
const transformUserChallenge = (uc) => ({
    id: uc.id,
    title: uc.challenge_name,
    icon: uc.challenge_icon,
    iconColor: uc.challenge_icon_color,
    color: iconColorMap[uc.challenge_icon] || iconColorMap.default,
    points: uc.points_earned || 0,
    difficulty: uc.status_display,
    progress: uc.progress_percent,
    daysLeft: uc.remaining_days,
    duration: `${uc.remaining_days}일 남음`,
    // 실패한 경우
    failedDate: uc.status === 'FAILED' ? new Date(uc.completed_at).toLocaleDateString('ko-KR') : null,
});

/**
 * 챌린지 목록 정렬 (쉬움 → 보통 → 어려움)
 */
const sortByDifficulty = (challenges) => {
    return challenges.sort((a, b) => {
        const orderA = difficultyOrder[a.difficulty] || 2;
        const orderB = difficultyOrder[b.difficulty] || 2;
        return orderA - orderB;
    });
};

/**
 * 두둑/이벤트 챌린지 목록 조회
 * @param {string} tab - 'duduk' | 'event'
 */
export const getChallenges = async (tab = 'duduk') => {
    try {
        const response = await client.get(`/api/challenges/list/?tab=${tab}`);
        const sorted = sortByDifficulty(response.data);
        return sorted.map(transformChallenge);
    } catch (error) {
        console.error('Get Challenges Error:', error);
        throw error;
    }
};

/**
 * 내 챌린지 목록 조회 (진행중/성공/실패)
 * @param {string} status - 'in_progress' | 'success' | 'failed'
 */
export const getMyChallenges = async (status = null) => {
    try {
        const url = status ? `/api/challenges/my/?status=${status}` : '/api/challenges/my/';
        const response = await client.get(url);
        return response.data.map(transformUserChallenge);
    } catch (error) {
        console.error('Get My Challenges Error:', error);
        throw error;
    }
};

/**
 * 사용자 챌린지 목록 조회
 */
export const getUserChallenges = async () => {
    try {
        const response = await client.get('/api/challenges/list/?tab=user');
        const data = Array.isArray(response.data) ? response.data : [];
        const sorted = sortByDifficulty(data);
        return sorted.map(transformChallenge);
    } catch (error) {
        console.error('Get User Challenges Error:', error);
        return [];
    }
};

/**
 * 챌린지 시작
 * @param {number} id - 챌린지 ID
 */
export const startChallenge = async (id) => {
    try {
        const response = await client.post(`/api/challenges/list/${id}/start/`);
        return response.data;
    } catch (error) {
        console.error('Start Challenge Error:', error);
        throw error;
    }
};

/**
 * 챌린지 취소
 * @param {number} id - UserChallenge ID
 */
export const cancelChallenge = async (id) => {
    try {
        const response = await client.post(`/api/challenges/my/${id}/cancel/`);
        return response.data;
    } catch (error) {
        console.error('Cancel Challenge Error:', error);
        throw error;
    }
};

/**
 * 사용자 포인트 조회
 */
export const getUserPoints = async () => {
    try {
        const response = await client.get('/api/challenges/points/');
        return response.data;
    } catch (error) {
        console.error('Get User Points Error:', error);
        throw error;
    }
};

/**
 * 사용자 챌린지 생성
 * @param {Object} challengeData - 챌린지 데이터 (name, description, duration_days, target_amount, target_category)
 */
export const createUserChallenge = async (challengeData) => {
    try {
        const response = await client.post('/api/challenges/list/create_user_challenge/', challengeData);
        return response.data;
    } catch (error) {
        console.error('Create User Challenge Error:', error);
        throw error;
    }
};

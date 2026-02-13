/**
 * [파일 역할]
 * - 게임 관련 API 호출 함수
 * - 게임 보상(포인트 적립) API와 통신
 */
import client from './client';

/**
 * 게임 보상 적립 API
 * @param {number} points - 게임에서 획득한 포인트 (생존 시간 초)
 * @returns {Promise<{success: boolean, earned_points: number, total_points: number}>}
 */
export const submitGameReward = async (points) => {
    try {
        const response = await client.post('/api/users/game-reward/', {
            points: points
        });
        return response.data;
    } catch (error) {
        console.error('Submit Game Reward Error:', error);
        throw error;
    }
};

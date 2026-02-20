/**
 * [파일 역할]
 * - 챌린지 관련 API 호출 함수
 * - 백엔드 /api/challenges/ 엔드포인트와 통신
 * - ChallengeTemplate, UserChallenge 모델에 맞게 데이터 변환
 */
import client from './client';

// 아이콘별 배경색 매핑


// 난이도 정렬 순서
const difficultyOrder = { '쉬움': 1, '보통': 2, '어려움': 3, 'EASY': 1, 'MEDIUM': 2, 'HARD': 3 };

/**
 * 백엔드 ChallengeTemplate 응답을 프론트엔드 형식으로 변환
 */
const transformTemplate = (template) => ({
    id: template.id,
    uniqueId: `template_${template.id}`,
    title: template.name,
    description: template.description,
    points: template.base_points || 0,
    basePoints: template.base_points || 0,
    maxPoints: template.max_points,
    difficulty: template.difficulty_display || template.difficulty,
    difficultyRaw: template.difficulty,
    duration: template.duration_days ? `${template.duration_days}일` : '진행중',
    durationDays: template.duration_days,
    sourceType: template.source_type,
    category: template.source_type || 'all',
    displayConfig: template.display_config || {},
    userInputs: template.user_inputs || [],
    successDescription: template.success_description,
    successConditions: template.success_conditions,
    requiresDailyCheck: template.requires_daily_check || false,
    requiresPhoto: template.requires_photo || false,
    photoFrequency: template.photo_frequency,
    photoDescription: template.photo_description,
    // 이벤트 전용
    isEventActive: template.is_event_active,
    eventStartAt: template.event_start_at,
    eventEndAt: template.event_end_at,
    eventBannerUrl: template.event_banner_url,
    // 사용자 상태 정보
    status: template.my_challenge_status,
    userChallengeId: template.my_challenge_id,
});

/**
 * UserChallenge 응답을 프론트엔드 형식으로 변환
 */
const transformUserChallenge = (uc) => {
    // progress에서 percentage 추출
    let progressPercent = 0;
    if (uc.progress) {
        if (typeof uc.progress === 'object') {
            progressPercent = uc.progress.percentage || 0;
        } else if (typeof uc.progress === 'number') {
            progressPercent = uc.progress;
        }
    }

    return {
        id: uc.id,
        uniqueId: `uc_${uc.id}`,
        title: uc.name,
        description: uc.description,
        points: uc.base_points || uc.earned_points || 0,
        basePoints: uc.base_points || 0,
        maxPoints: uc.max_points,
        difficulty: uc.difficulty_display || uc.difficulty,
        difficultyRaw: uc.difficulty,
        progress: progressPercent,
        progressData: uc.progress,
        daysLeft: uc.remaining_days,
        duration: uc.remaining_days !== undefined ? `${uc.remaining_days}일 남음` : `${uc.duration_days}일`,
        durationDays: uc.duration_days,
        status: uc.status,
        statusDisplay: uc.status_display,
        sourceType: uc.source_type,
        category: uc.source_type || 'all',
        displayConfig: uc.display_config || {},
        successConditions: uc.success_conditions || {},
        userInputValues: uc.user_input_values || {},
        systemGeneratedValues: uc.system_generated_values || {},
        userInputs: uc.user_inputs || [],
        successDescription: uc.success_description,
        attemptNumber: uc.attempt_number || 1,
        startedAt: uc.started_at,
        endsAt: uc.ends_at,
        completedAt: uc.completed_at,
        earnedPoints: uc.earned_points || 0,
        penaltyPoints: uc.penalty_points || 0,
        bonusEarned: uc.bonus_earned || false,
        // 실패한 경우
        failedDate: uc.status === 'failed' ? new Date(uc.completed_at).toLocaleDateString('ko-KR') : null,
        // 템플릿 ID
        templateId: uc.template,
        requiresPhoto: uc.requires_photo || false,
        requiresDailyCheck: uc.requires_daily_check || false,
        photoDescription: uc.photo_description,
    };
};

/**
 * 챌린지 목록 정렬
 */
const sortByDifficulty = (challenges) => {
    return [...challenges].sort((a, b) => {
        const orderA = difficultyOrder[a.difficulty] || difficultyOrder[a.difficultyRaw] || 2;
        const orderB = difficultyOrder[b.difficulty] || difficultyOrder[b.difficultyRaw] || 2;
        return orderA - orderB;
    });
};

/**
 * 챌린지 템플릿 목록 조회 (두둑/이벤트)
 * @param {string} tab - 'duduk' | 'event'
 */
export const getChallengeTemplates = async (tab = 'duduk') => {
    try {
        const response = await client.get(`/api/challenges/templates/?tab=${tab}`);
        const sorted = sortByDifficulty(response.data.map(transformTemplate));
        return sorted;
    } catch (error) {
        console.error('Get Challenge Templates Error:', error.message || error);
        throw error;
    }
};

/**
 * 챌린지 템플릿 상세 조회
 * @param {number} id - 템플릿 ID
 */
export const getChallengeTemplateDetail = async (id) => {
    try {
        const response = await client.get(`/api/challenges/templates/${id}/`);
        return transformTemplate(response.data);
    } catch (error) {
        console.error('Get Template Detail Error:', error);
        throw error;
    }
};

/**
 * 챌린지 입력값 프리뷰 조회 (비교형 전용)
 * @param {number} templateId
 * @param {object} userInputValues
 */
export const previewTemplateInput = async (templateId, userInputValues = {}) => {
    try {
        const response = await client.post(`/api/challenges/templates/${templateId}/preview_input/`, {
            user_input_values: userInputValues,
        });
        return response.data;
    } catch (error) {
        console.error('Preview Template Input Error:', error);
        throw error;
    }
};

/**
 * 두둑/이벤트 챌린지 목록 조회
 * @param {string} tab - 'duduk' | 'event'
 */
export const getChallenges = async (tab = 'duduk') => {
    return getChallengeTemplates(tab);
};

/**
 * 내 챌린지 목록 조회
 * @param {string} status
 */
export const getMyChallenges = async (status = null) => {
    try {
        let url = '/api/challenges/my/';

        if (status) {
            const statusMap = {
                'in_progress': 'active',
                'active': 'active',
                'success': 'completed',
                'completed': 'completed',
                'failed': 'failed',
                'finished': 'finished', // completed + failed
                'ready': 'ready',
                'cancelled': 'cancelled',
            };
            const mappedStatus = statusMap[status] || status;
            url += `?status=${mappedStatus}`;
        }

        const response = await client.get(url);
        return response.data.map(transformUserChallenge);
    } catch (error) {
        console.error('Get My Challenges Error:', error);
        throw error;
    }
};

/**
 * 내 챌린지 상세 조회
 * @param {number} id
 */
export const getMyChallengeDetail = async (id) => {
    try {
        const response = await client.get(`/api/challenges/my/${id}/`);
        return transformUserChallenge(response.data);
    } catch (error) {
        console.error('Get My Challenge Detail Error:', error);
        throw error;
    }
};

/**
 * 사용자 챌린지 목록 조회
 */
export const getUserChallenges = async () => {
    try {
        const [customRes, aiRes] = await Promise.all([
            client.get('/api/challenges/my/?source_type=custom'),
            client.get('/api/challenges/my/?source_type=ai')
        ]);

        const customData = Array.isArray(customRes.data) ? customRes.data : [];
        const aiData = Array.isArray(aiRes.data) ? aiRes.data : [];

        const combined = [...customData, ...aiData];
        const sorted = sortByDifficulty(combined.map(transformUserChallenge));
        return sorted;
    } catch (error) {
        console.error('Get User Challenges Error:', error);
        return [];
    }
};

/**
 * 템플릿 기반 챌린지 시작
 * @param {number} templateId
 * @param {object} userInputValues
 */
export const startChallenge = async (templateId, userInputValues = {}) => {
    try {
        const response = await client.post('/api/challenges/my/', {
            template_id: templateId,
            user_input_values: userInputValues,
        });
        return transformUserChallenge(response.data);
    } catch (error) {
        console.error('Start Challenge Error:', error);
        throw error;
    }
};

/**
 * 챌린지 취소
 * @param {number} id
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
 * 챌린지 재도전
 * @param {number} id
 */
export const retryChallenge = async (id) => {
    try {
        const response = await client.post(`/api/challenges/my/${id}/retry/`);
        return transformUserChallenge(response.data);
    } catch (error) {
        console.error('Retry Challenge Error:', error);
        throw error;
    }
};

/**
 * 일일 체크
 * @param {number} id
 */
export const checkDaily = async (id) => {
    try {
        const response = await client.post(`/api/challenges/my/${id}/check_daily/`);
        return response.data;
    } catch (error) {
        console.error('Check Daily Error:', error);
        throw error;
    }
};

/**
 * 사진 인증 업로드
 * @param {number} id
 * @param {Object} payload
 */
export const uploadPhoto = async (id, payload) => {
    try {
        const response = await client.post(`/api/challenges/my/${id}/upload_photo/`, {
            image_base64: payload?.image_base64,
            photo_url: payload?.photo_url,
            mime_type: payload?.mime_type,
            captured_at: payload?.captured_at,
        });
        return response.data;
    } catch (error) {
        console.error('Upload Photo Error:', error);
        throw error;
    }
};

/**
 * 일별 로그 조회
 * @param {number} id
 */
export const getDailyLogs = async (id) => {
    try {
        const response = await client.get(`/api/challenges/my/${id}/daily_logs/`);
        return response.data;
    } catch (error) {
        console.error('Get Daily Logs Error:', error);
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
        console.error('Get User Points Error:', error.message || error);
        throw error;
    }
};

/**
 * 챌린지 통계 조회
 */
export const getChallengeStats = async () => {
    try {
        const response = await client.get('/api/challenges/stats/');
        return response.data;
    } catch (error) {
        console.error('Get Challenge Stats Error:', error);
        throw error;
    }
};

/**
 * 사용자 커스텀 챌린지 생성
 * @param {Object} challengeData
 */
export const createUserChallenge = async (challengeData) => {
    try {
        const response = await client.post('/api/challenges/my/create_custom/', {
            name: challengeData.name,
            description: challengeData.description || '',

            difficulty: challengeData.difficulty || 'normal',
            duration_days: challengeData.duration_days || 7,
            target_amount: challengeData.target_amount || null,
            target_categories: challengeData.target_categories || [],
        });
        return transformUserChallenge(response.data);
    } catch (error) {
        console.error('Create User Challenge Error:', error);
        throw error;
    }
};

/**
 * AI 챌린지 생성
 * @param {string} title
 * @param {string} details
 * @param {string} difficulty
 */
export const generateAIChallenge = async (title, details, difficulty) => {
    try {
        const response = await client.post('/api/challenges/my/generate_ai/', {
            title,
            details,
            difficulty,
        });
        return response.data;
    } catch (error) {
        console.error('Generate AI Challenge Error:', error);
        throw error;
    }
};

/**
 * AI 챌린지 시작
 * @param {object} challengeData
 */
export const startAIChallenge = async (challengeData) => {
    try {
        const response = await client.post('/api/challenges/my/start_ai/', challengeData);
        return transformUserChallenge(response.data);
    } catch (error) {
        console.error('Start AI Challenge Error:', error);
        throw error;
    }
};

/**
 * 코칭 기반 AI 챌린지 생성
 * @param {number} coachingId
 * @param {string} difficulty
 */
export const generateChallengeFromCoaching = async (coachingId, difficulty = 'normal') => {
    try {
        const response = await client.post('/api/challenges/my/generate_from_coaching/', {
            coaching_id: coachingId,
            difficulty,
        });
        return response.data;
    } catch (error) {
        console.error('Generate Challenge from Coaching Error:', error);
        throw error;
    }
};

/**
 * 코칭 기반 AI 챌린지 시작
 * @param {number} coachingId - 코칭 ID
 * @param {object} challengeData
 */
export const startChallengeFromCoaching = async (coachingId, challengeData) => {
    try {
        const response = await client.post('/api/challenges/my/start_from_coaching/', {
            coaching_id: coachingId,
            ...challengeData,
        });
        return transformUserChallenge(response.data);
    } catch (error) {
        console.error('Start Challenge from Coaching Error:', error);
        throw error;
    }
};

/**
 * 챌린지 삭제
 * @param {number} id
 */
export const deleteChallenge = async (id) => {
    try {
        const response = await client.delete(`/api/challenges/my/${id}/`);
        return response.data;
    } catch (error) {
        console.error('Delete Challenge Error:', error);
        throw error;
    }
};

/**
 * 저장된 챌린지 시작
 * @param {number} id
 */
export const startSavedChallenge = async (id) => {
    try {
        const response = await client.post(`/api/challenges/my/${id}/start/`);
        return transformUserChallenge(response.data);
    } catch (error) {
        console.error('Start Saved Challenge Error:', error);
        throw error;
    }
};

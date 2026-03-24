/**
 * [파일 역할]
 * - 인증 관련 API 호출 함수를 제공합니다.
 * - 로그인, 회원가입, 프로필 조회 기능을 포함합니다.
 */
import axios from 'axios';
import client from './client';
import { getBaseURL } from './client';

/**
 * 로그인 API
 * @param {string} email - 사용자 이메일
 * @param {string} password - 비밀번호
 * @returns {Promise<{access: string, refresh: string}>} JWT 토큰
 */
export const login = async (email, password) => {
    const response = await client.post('/api/users/login/', {
        email,
        password
    });
    return response.data;
};

/**
 * 회원가입 API
 * @param {string} email - 이메일
 * @param {string} username - 사용자명
 * @param {string} password - 비밀번호
 * @param {string} passwordConfirm - 비밀번호 확인
 * @param {string} characterType - 캐릭터 타입 (선택적)
 * @param {string} characterName - 캐릭터 이름 (선택적)
 * @returns {Promise<{message: string, user: object}>}
 */
export const register = async (email, username, password, passwordConfirm, characterType = null, characterName = null) => {
    const data = {
        email,
        username,
        password,
        password_confirm: passwordConfirm
    };

    // 캐릭터 정보가 있을 때만 포함
    if (characterType) {
        data.character_type = characterType;
    }
    if (characterName) {
        data.character_name = characterName;
    }

    const response = await client.post('/api/users/register/', data);
    return response.data;
};

/**
 * Google 로그인 API
 * @param {string} accessToken - Google OAuth access token
 * @returns {Promise<{access: string, refresh: string, user: object}>}
 */
export const loginWithGoogle = async (accessToken) => {
    const response = await axios.post(`${getBaseURL()}/api/users/auth/google/`, {
        access_token: accessToken
    }, {
        headers: {
            'Content-Type': 'application/json'
        }
    });

    return response.data;
};

/**
 * 프로필 조회 API
 * @returns {Promise<object>} 사용자 프로필 정보
 */
export const getProfile = async () => {
    const response = await client.get('/api/users/profile/');
    return response.data;
};

/**
 * 프로필 수정 API
 * @param {object} data - 수정할 프로필 데이터
 * @returns {Promise<object>} 수정된 프로필 정보
 */
export const updateProfile = async (data) => {
    const response = await client.patch('/api/users/profile/', data);
    return response.data;
};



/**
 * 토큰 갱신 API
 * @param {string} refreshToken - 리프레시 토큰
 * @returns {Promise<{access: string}>} 새로운 액세스 토큰
 */
export const refreshToken = async (refreshToken) => {
    const response = await client.post('/api/users/token/refresh/', {
        refresh: refreshToken
    });
    return response.data;
};

/**
 * 회원탈퇴 API
 * @returns {Promise<{message: string}>}
 */
export const deleteAccount = async () => {
    const response = await client.delete('/api/users/profile/');
    return response.data;
};

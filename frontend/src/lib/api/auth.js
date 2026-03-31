import axios from 'axios';
import client, { getBaseURL } from './client';

function postSocialAuth(path, payload) {
    return axios.post(`${getBaseURL()}${path}`, payload, {
        headers: {
            'Content-Type': 'application/json',
        },
    });
}

export const login = async (email, password) => {
    const response = await client.post('/api/users/login/', {
        email,
        password,
    });
    return response.data;
};

export const register = async (
    email,
    username,
    password,
    passwordConfirm,
    characterType = null,
    characterName = null,
) => {
    const data = {
        email,
        username,
        password,
        password_confirm: passwordConfirm,
    };

    if (characterType) {
        data.character_type = characterType;
    }
    if (characterName) {
        data.character_name = characterName;
    }

    const response = await client.post('/api/users/register/', data);
    return response.data;
};

export const loginWithGoogle = async (googleAuth) => {
    const requestBody = typeof googleAuth === 'string'
        ? { access_token: googleAuth }
        : googleAuth;

    const response = await postSocialAuth('/api/users/auth/google/', requestBody);
    return response.data;
};

export const loginWithKakao = async (payload) => {
    const response = await postSocialAuth('/api/users/auth/kakao/', payload);
    return response.data;
};

export const loginWithNaver = async (payload) => {
    const response = await postSocialAuth('/api/users/auth/naver/', payload);
    return response.data;
};

export const getProfile = async () => {
    const response = await client.get('/api/users/profile/');
    return response.data;
};

export const updateProfile = async (data) => {
    const response = await client.patch('/api/users/profile/', data);
    return response.data;
};

export const refreshToken = async (refreshToken) => {
    const response = await client.post('/api/users/token/refresh/', {
        refresh: refreshToken,
    });
    return response.data;
};

export const deleteAccount = async () => {
    const response = await client.delete('/api/users/profile/');
    return response.data;
};

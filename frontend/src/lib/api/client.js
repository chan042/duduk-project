import axios from 'axios';

// 환경변수 기반으로 API URL 선택 (.env.local에서 관리)
export function getBaseURL() {
    if (typeof window === 'undefined') {
        return process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_URL_127 || 'http://localhost:8000';
    }

    const { protocol, hostname } = window.location;
    const fallbackBaseURL = `${protocol}//${hostname}:8000`;

    if (hostname === '127.0.0.1') {
        return process.env.NEXT_PUBLIC_API_URL_127 || fallbackBaseURL;
    }

    if (hostname === 'localhost') {
        return process.env.NEXT_PUBLIC_API_URL || fallbackBaseURL;
    }

    const configuredBaseURL = process.env.NEXT_PUBLIC_API_URL;
    if (configuredBaseURL && !configuredBaseURL.includes('localhost') && !configuredBaseURL.includes('127.0.0.1')) {
        return configuredBaseURL;
    }

    return fallbackBaseURL;
}

const baseURL = getBaseURL();

console.log('[API Client] baseURL:', baseURL);

const client = axios.create({
    baseURL: baseURL,
    headers: {
        'Content-Type': 'application/json',
    },
});

/**
 * 요청 인터셉터: 모든 API 요청에 JWT 토큰 자동 첨부
 */
client.interceptors.request.use(
    (config) => {
        // 브라우저 환경에서만 localStorage 접근
        if (typeof window !== 'undefined') {
            const token = localStorage.getItem('accessToken');
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

/**
 * 응답 인터셉터: 401 에러 시 토큰 갱신 시도
 */
client.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // 401 에러이고, 재시도하지 않은 요청인 경우
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            if (typeof window !== 'undefined') {
                const refreshToken = localStorage.getItem('refreshToken');

                // refreshToken이 있는 경우에만 갱신 시도
                if (refreshToken) {
                    try {
                        const response = await axios.post(
                            `${baseURL}/api/users/token/refresh/`,
                            { refresh: refreshToken }
                        );

                        const { access } = response.data;
                        localStorage.setItem('accessToken', access);

                        // 원래 요청 재시도
                        originalRequest.headers.Authorization = `Bearer ${access}`;
                        return client(originalRequest);
                    } catch (refreshError) {
                        // 토큰 갱신 실패 시 토큰 삭제하고 에러 반환
                        // (컴포넌트에서 처리하도록 함)
                        localStorage.removeItem('accessToken');
                        localStorage.removeItem('refreshToken');
                        window.location.href = '/login';
                        return Promise.reject(refreshError);
                    }
                } else {
                    // refreshToken이 없을 때 바로 로그인 화면으로
                    localStorage.removeItem('accessToken');
                    window.location.href = '/login';
                }
            }
        }

        return Promise.reject(error);
    }
);


export default client;

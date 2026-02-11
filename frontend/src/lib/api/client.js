import axios from 'axios';

// Use environment variable for backend URL, fallback to localhost for local development
const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

console.log('[API Client] baseURL:', baseURL);
console.log('[API Client] NEXT_PUBLIC_API_URL:', process.env.NEXT_PUBLIC_API_URL);

const client = axios.create({
    baseURL: baseURL,
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 10000, // 10 second timeout
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
                            'http://localhost:8000/api/users/token/refresh/',
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
                        return Promise.reject(refreshError);
                    }
                }
            }
        }

        return Promise.reject(error);
    }
);


export default client;

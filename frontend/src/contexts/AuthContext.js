"use client";

/**
 * [파일 역할]
 * - 인증 상태를 관리하는 React Context를 제공합니다.
 * - 로그인, 로그아웃, 사용자 정보 조회 기능을 포함합니다.
 * - 앱 전체에서 인증 상태에 접근할 수 있게 합니다.
 */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getProfile } from '@/lib/api/auth';

// Context 생성
const AuthContext = createContext(null);

/**
 * AuthProvider 컴포넌트
 * 앱 전체를 감싸서 인증 상태를 제공합니다.
 */
export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    /**
     * 사용자 프로필을 가져와서 상태에 저장
     */
    const fetchUser = useCallback(async () => {
        try {
            const accessToken = localStorage.getItem('accessToken');
            if (!accessToken) {
                setUser(null);
                setLoading(false);
                return;
            }

            const profile = await getProfile();
            setUser(profile);
        } catch (error) {
            console.error('프로필 조회 실패:', error);
            setUser(null);
            // 토큰이 유효하지 않으면 삭제
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
        } finally {
            setLoading(false);
        }
    }, []);

    /**
     * 초기 로드 시 사용자 정보 가져오기
     */
    useEffect(() => {
        fetchUser();
    }, [fetchUser]);

    /**
     * 로그인 처리
     * @param {string} accessToken - 액세스 토큰
     * @param {string} refreshToken - 리프레시 토큰
     */
    const handleLogin = useCallback(async (accessToken, refreshToken) => {
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', refreshToken);
        await fetchUser();

        // 프로필 완성 여부 확인을 위해 다시 프로필 조회
        try {
            const profile = await getProfile();
            if (!profile.is_profile_complete) {
                router.push('/userinfo');
            } else {
                router.push('/');
            }
        } catch (error) {
            router.push('/');
        }
    }, [fetchUser, router]);

    /**
     * 로그아웃 처리
     */
    const handleLogout = useCallback(() => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        setUser(null);
        router.push('/login');
    }, [router]);

    /**
     * Google 로그인 처리
     * @param {string} accessToken - Google Access Token
     */
    const loginWithGoogle = useCallback(async (accessToken) => {
        try {
            const response = await fetch('http://localhost:8000/api/users/auth/google/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ access_token: accessToken }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Google 로그인 실패');
            }

            const data = await response.json();
            const { access, refresh } = data;

            localStorage.setItem('accessToken', access);
            localStorage.setItem('refreshToken', refresh);
            await fetchUser();

            // 프로필 완성 여부에 따라 리다이렉트
            const profile = await getProfile();
            if (!profile.is_profile_complete) {
                router.push('/userinfo');
            } else {
                router.push('/');
            }
        } catch (error) {
            console.error('Google 로그인 실패:', error);
            throw error;
        }
    }, [fetchUser, router]);

    /**
     * 로그인 여부 확인
     */
    const isAuthenticated = !!user;

    const value = {
        user,
        loading,
        isAuthenticated,
        login: handleLogin,
        loginWithGoogle,
        logout: handleLogout,
        refreshUser: fetchUser
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

/**
 * useAuth 훅
 * AuthContext의 값을 쉽게 사용할 수 있게 해주는 커스텀 훅
 */
export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth는 AuthProvider 내부에서 사용해야 합니다.');
    }
    return context;
}

"use client";

/**
 * [파일 역할]
 * - 인증 상태를 관리하는 React Context를 제공합니다.
 * - 로그인, 로그아웃, 사용자 정보 조회 기능을 포함합니다.
 * - 앱 전체에서 인증 상태에 접근할 수 있게 합니다.
 */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getProfile, loginWithGoogle as loginWithGoogleApi } from '@/lib/api/auth';

// Context 생성
const AuthContext = createContext(null);

function getCapacitorRuntime() {
    if (typeof window === 'undefined') {
        return null;
    }

    return window.Capacitor ?? null;
}

function isNativeCapacitorApp() {
    const capacitor = getCapacitorRuntime();
    if (!capacitor) {
        return false;
    }

    if (typeof capacitor.isNativePlatform === 'function') {
        return capacitor.isNativePlatform();
    }

    if (typeof capacitor.getPlatform === 'function') {
        return capacitor.getPlatform() !== 'web';
    }

    return false;
}

function getCapacitorPlugin(name) {
    const capacitor = getCapacitorRuntime();
    return capacitor?.Plugins?.[name] ?? null;
}

function isCapacitorPluginAvailable(name) {
    const capacitor = getCapacitorRuntime();
    if (!capacitor) {
        return false;
    }

    if (typeof capacitor.isPluginAvailable === 'function') {
        return capacitor.isPluginAvailable(name);
    }

    return Boolean(getCapacitorPlugin(name));
}

/**
 * AuthProvider 컴포넌트
 * 앱 전체를 감싸서 인증 상태를 제공합니다.
 */
export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isNativeApp, setIsNativeApp] = useState(false);
    const router = useRouter();

    useEffect(() => {
        setIsNativeApp(isNativeCapacitorApp());
    }, []);

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
     * 네이티브 앱용 Google 로그인 시작
     * - 외부 HTTPS 로그인 페이지를 연 뒤
     * - duduk://auth/google 딥링크로 JWT를 전달받습니다.
     */
    const startNativeGoogleLogin = useCallback(async () => {
        const webURL = process.env.NEXT_PUBLIC_WEB_URL?.trim();
        if (!webURL) {
            throw new Error('NEXT_PUBLIC_WEB_URL이 설정되지 않았습니다.');
        }

        if (!isCapacitorPluginAvailable('Browser')) {
            throw new Error('Capacitor Browser 플러그인을 찾을 수 없습니다. `npm install` 후 `npx cap sync`를 실행해주세요.');
        }

        const browserPlugin = getCapacitorPlugin('Browser');
        if (!browserPlugin?.open) {
            throw new Error('Capacitor Browser 플러그인을 사용할 수 없습니다.');
        }

        const authURL = new URL('/mobile-auth/google', webURL);
        authURL.searchParams.set('app_callback', 'duduk://auth/google');

        await browserPlugin.open({
            url: authURL.toString(),
        });
    }, []);

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
            const data = await loginWithGoogleApi(accessToken);
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
            if (error?.message === 'Network Error' || error?.name === 'TypeError') {
                throw new Error('백엔드 서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요.');
            }
            throw error;
        }
    }, [fetchUser, router]);

    useEffect(() => {
        if (!isNativeApp) {
            return undefined;
        }

        if (!isCapacitorPluginAvailable('App')) {
            console.warn('Capacitor App 플러그인을 찾을 수 없어 appUrlOpen 리스너를 등록하지 않습니다.');
            return undefined;
        }

        let listenerHandle;
        let isCancelled = false;

        const registerListener = async () => {
            const appPlugin = getCapacitorPlugin('App');
            const browserPlugin = getCapacitorPlugin('Browser');

            if (!appPlugin?.addListener) {
                console.warn('Capacitor App 플러그인을 사용할 수 없어 appUrlOpen 리스너를 등록하지 않습니다.');
                return;
            }

            try {
                listenerHandle = await appPlugin.addListener('appUrlOpen', async ({ url }) => {
                    if (!url || !url.startsWith('duduk://auth/google')) {
                        return;
                    }

                    try {
                        const callbackURL = new URL(url);
                        const access = callbackURL.searchParams.get('access');
                        const refresh = callbackURL.searchParams.get('refresh');

                        if (!access || !refresh) {
                            throw new Error('로그인 토큰이 누락되었습니다.');
                        }

                        if (browserPlugin?.close) {
                            await browserPlugin.close().catch(() => {});
                        }

                        await handleLogin(access, refresh);
                    } catch (error) {
                        console.error('앱 딥링크 로그인 처리 실패:', error);
                    }
                });

                if (isCancelled) {
                    listenerHandle?.remove?.();
                }
            } catch (error) {
                console.error('앱 딥링크 리스너 등록 실패:', error);
            }
        };

        registerListener();

        return () => {
            isCancelled = true;
            listenerHandle?.remove?.();
        };
    }, [handleLogin, isNativeApp]);

    /**
     * 로그인 여부 확인
     */
    const isAuthenticated = !!user;

    const value = {
        user,
        loading,
        isAuthenticated,
        isNativeApp,
        login: handleLogin,
        loginWithGoogle,
        startNativeGoogleLogin,
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

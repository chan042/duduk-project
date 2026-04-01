"use client";

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    getProfile,
    loginWithGoogle as loginWithGoogleApi,
    loginWithKakao as loginWithKakaoApi,
    loginWithNaver as loginWithNaverApi,
} from '@/lib/api/auth';

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

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isNativeApp, setIsNativeApp] = useState(false);
    const router = useRouter();

    useEffect(() => {
        setIsNativeApp(isNativeCapacitorApp());
    }, []);

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
            console.error('Failed to fetch profile:', error);
            setUser(null);
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchUser();
    }, [fetchUser]);

    const redirectAfterLogin = useCallback(async () => {
        try {
            const profile = await getProfile();
            if (!profile.is_profile_complete) {
                router.push('/userinfo');
                return;
            }
        } catch (error) {
            console.error('Failed to verify profile after login:', error);
        }

        router.push('/');
    }, [router]);

    const persistTokens = useCallback((accessToken, refreshToken) => {
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', refreshToken);
    }, []);

    const handleLogin = useCallback(async (accessToken, refreshToken) => {
        persistTokens(accessToken, refreshToken);
        await fetchUser();
        await redirectAfterLogin();
    }, [fetchUser, persistTokens, redirectAfterLogin]);

    const handleLogout = useCallback(() => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        setUser(null);
        router.push('/login');
    }, [router]);

    const completeSocialLogin = useCallback(async (requestLogin, payload, providerLabel) => {
        try {
            const data = await requestLogin(payload);
            await handleLogin(data.access, data.refresh);
            return data;
        } catch (error) {
            console.error(`${providerLabel} login failed:`, error);

            if (error?.message === 'Network Error' || error?.name === 'TypeError') {
                throw new Error('백엔드 서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해 주세요.');
            }

            throw error;
        }
    }, [handleLogin]);

    const startNativeGoogleLogin = useCallback(async () => {
        const webURL = process.env.NEXT_PUBLIC_WEB_URL?.trim();
        if (!webURL) {
            throw new Error('NEXT_PUBLIC_WEB_URL이 설정되지 않았습니다.');
        }

        if (!isCapacitorPluginAvailable('Browser')) {
            throw new Error('Capacitor Browser 플러그인을 찾을 수 없습니다. `npm install` 후 `npx cap sync`를 실행해 주세요.');
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

    useEffect(() => {
        if (!isNativeApp) {
            return undefined;
        }

        if (!isCapacitorPluginAvailable('App')) {
            console.warn('Capacitor App plugin is unavailable. appUrlOpen listener was not registered.');
            return undefined;
        }

        let listenerHandle;
        let isCancelled = false;

        const registerListener = async () => {
            const appPlugin = getCapacitorPlugin('App');
            const browserPlugin = getCapacitorPlugin('Browser');

            if (!appPlugin?.addListener) {
                console.warn('Capacitor App plugin is unavailable. appUrlOpen listener was not registered.');
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
                        console.error('Failed to complete native Google login:', error);
                    }
                });

                if (isCancelled) {
                    listenerHandle?.remove?.();
                }
            } catch (error) {
                console.error('Failed to register native auth listener:', error);
            }
        };

        registerListener();

        return () => {
            isCancelled = true;
            listenerHandle?.remove?.();
        };
    }, [handleLogin, isNativeApp]);

    const loginWithGoogle = useCallback((payload) => {
        return completeSocialLogin(loginWithGoogleApi, payload, 'Google');
    }, [completeSocialLogin]);

    const loginWithKakao = useCallback((payload) => {
        return completeSocialLogin(loginWithKakaoApi, payload, 'Kakao');
    }, [completeSocialLogin]);

    const loginWithNaver = useCallback((payload) => {
        return completeSocialLogin(loginWithNaverApi, payload, 'Naver');
    }, [completeSocialLogin]);

    const value = {
        user,
        loading,
        isAuthenticated: !!user,
        isNativeApp,
        login: handleLogin,
        loginWithGoogle,
        loginWithKakao,
        loginWithNaver,
        startNativeGoogleLogin,
        logout: handleLogout,
        refreshUser: fetchUser,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
}

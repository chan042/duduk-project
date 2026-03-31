"use client";

import { useState, useEffect } from 'react';
import { getCategoryStats } from '@/lib/api/transaction';
import { useAuth } from '@/contexts/AuthContext';

export default function TotalSpending() {
    const { user, isAuthenticated, isNativeApp, startNativeGoogleLogin } = useAuth();
    const [totalSpending, setTotalSpending] = useState(0);
    const [loading, setLoading] = useState(true);
    const [isAngry, setIsAngry] = useState(false);

    useEffect(() => {
        fetchTotalSpending();
    }, [isAuthenticated]);

    const fetchTotalSpending = async () => {
        // 인증되지 않은 경우 API 호출하지 않음
        if (!isAuthenticated) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const today = new Date();
            const response = await getCategoryStats(today.getFullYear(), today.getMonth() + 1);
            setTotalSpending(response.total);
        } catch (err) {
            console.error('Failed to fetch total spending:', err);
        } finally {
            setLoading(false);
        }
    };

    // 두둑이 클릭 핸들러
    const handleCharacterClick = () => {
        setIsAngry(true);
        setTimeout(() => {
            setIsAngry(false);
        }, 700);
    };

    const handleLoginClick = async () => {
        if (!isNativeApp) {
            return;
        }

        try {
            await startNativeGoogleLogin();
        } catch (error) {
            console.error('네이티브 Google 로그인 시작 실패:', error);
            alert('Google 로그인에 실패했습니다. 다시 시도해주세요.');
        }
    };

    // 사용자 예산 가져오기 (없으면 0)
    const budget = user?.monthly_budget ? Number(user.monthly_budget) : 0;
    const remaining = budget - totalSpending;
    const percentUsed = budget > 0 ? Math.round((totalSpending / budget) * 100) : 0;
    const remainingPercent = 100 - percentUsed;

    // 캐릭터 타입 가져오기
    const characterType = user?.character_type || 'char_cat';

    // 남은 예산 비율에 따른 표정 선택
    const getFaceExpression = (remainingPercent) => {
        if (isAngry) return 'face_angry'; // 클릭 시 강제 화난 표정

        if (remainingPercent >= 80) return 'face_happy';        // 0~20% 사용
        if (remainingPercent >= 60) return 'face_basic';        // 21~40% 사용
        if (remainingPercent >= 40) return 'face_surprise';     // 41~60% 사용
        if (remainingPercent >= 20) return 'face_worry';        // 61~80% 사용
        if (remainingPercent >= 0) return 'face_sad';           // 81~100% 사용
        return 'face_angry';                                     // 101%~ 사용
    };

    const faceExpression = getFaceExpression(remainingPercent);
    const characterImagePath = `/images/characters/${characterType}/${faceExpression}.png`;

    // 비로그인 상태일 경우 로그인 유도 UI 표시
    if (!isAuthenticated) {
        return (
            <div style={{
                backgroundColor: 'white',
                borderRadius: '24px',
                padding: '24px 28px',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
                marginBottom: '16px',
                textAlign: 'center',
                border: '1px solid rgba(0,0,0,0.02)'
            }}>
                <h2 style={{
                    fontSize: '1.25rem',
                    fontWeight: '800',
                    color: 'var(--text-main)',
                    marginBottom: '0.75rem'
                }}>
                    이번 달 쓴 돈
                </h2>
                <p style={{ color: 'var(--text-sub)', marginBottom: '1rem' }}>
                    로그인하고 지출 현황을 확인하세요
                </p>
                {isNativeApp ? (
                    <button
                        type="button"
                        onClick={handleLoginClick}
                        style={{
                            display: 'inline-block',
                            padding: '0.75rem 1.5rem',
                            backgroundColor: 'var(--primary)',
                            color: 'white',
                            borderRadius: 'var(--radius-md)',
                            textDecoration: 'none',
                            fontWeight: '600',
                            border: 'none'
                        }}
                    >
                        로그인하기
                    </button>
                ) : (
                    <a
                        href="/login"
                        style={{
                            display: 'inline-block',
                            padding: '0.75rem 1.5rem',
                            backgroundColor: 'var(--primary)',
                            color: 'white',
                            borderRadius: 'var(--radius-md)',
                            textDecoration: 'none',
                            fontWeight: '600'
                        }}
                    >
                        로그인하기
                    </a>
                )}
            </div>
        );
    }

    return (
        <div style={{
            backgroundColor: 'white',
            borderRadius: '24px',
            padding: '24px 28px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
            marginBottom: '16px',
            position: 'relative',
            overflow: 'hidden',
            border: '1px solid rgba(0,0,0,0.02)'
        }}>
            {/* 배경 데코레이션 (캐릭터 뒤 은은한 원) */}
            <div style={{
                position: 'absolute',
                top: '40%',
                right: '10px',
                width: '100px',
                height: '100px',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(237, 242, 247, 0.8) 0%, rgba(255,255,255,0) 70%)',
                zIndex: 0
            }} />

            <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column' }}>
                {/* 1. 상단: 타이틀 */}
                <h2 style={{
                    fontSize: '1.25rem',
                    fontWeight: '800',
                    color: 'var(--text-main)',
                    marginBottom: '0.25rem'
                }}>
                    이번 달 쓴 돈
                </h2>

                {/* 2. 중단: 금액 (좌측) + 캐릭터 (우측) */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-end',
                    marginBottom: '24px',
                    position: 'relative' // 캐릭터 위치 조정을 위해
                }}>
                    {/* 금액 */}
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                        <h2 style={{
                            fontSize: '32px',
                            fontWeight: '800',
                            color: 'var(--text-main)',
                            letterSpacing: '-0.5px',
                            lineHeight: '1.2'
                        }}>
                            {loading ? '...' : totalSpending.toLocaleString()}
                        </h2>
                        <span style={{
                            fontSize: '20px',
                            fontWeight: '600',
                            color: 'var(--text-main)',
                            marginBottom: '4px'
                        }}>원</span>
                    </div>

                    {/* 캐릭터 이미지 */}
                    <div
                        onClick={handleCharacterClick}
                        style={{
                            width: '90px',
                            height: '90px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            animation: isAngry ? 'shake 0.5s cubic-bezier(.36,.07,.19,.97) both' : 'fadeInScale 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
                            marginBottom: '-5px', // 미세 위치 조정
                            marginRight: '-5px',
                            cursor: 'pointer',
                            transition: 'transform 0.1s'
                        }}
                    >
                        <img
                            src={characterImagePath}
                            alt="두둑이 표정"
                            style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'contain',
                                transform: isAngry ? 'scale(1.1) rotate(-5deg)' : 'scale(1) rotate(0deg)',
                                transition: isAngry
                                    ? 'transform 0.1s cubic-bezier(0.36, 0.07, 0.19, 0.97)'
                                    : 'transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                            }}
                            onError={(e) => {
                                e.target.style.display = 'none';
                            }}
                        />
                    </div>
                </div>

                {/* 3. 하단: 프로그레스 바 + 정보 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {/* 프로그레스 바 */}
                    <div style={{
                        width: '100%',
                        height: '10px',
                        backgroundColor: '#F1F5F9', // slate-100
                        borderRadius: '999px',
                        overflow: 'hidden'
                    }}>
                        <div style={{
                            width: `${Math.min(percentUsed, 100)}%`,
                            height: '100%',
                            backgroundColor: percentUsed > 100 ? '#EF4444' : 'var(--primary)', // 초과시 빨강
                            borderRadius: '999px',
                            transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}></div>
                    </div>

                    {/* 남은 예산 및 퍼센트 텍스트 */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '13px',
                        fontWeight: '500'
                    }}>
                        <span style={{ color: '#64748B' }}> {/* slate-500 */}
                            남은 예산 <span style={{ color: '#334155', fontWeight: '600' }}>{remaining.toLocaleString()}원</span>
                        </span>
                        <span style={{
                            color: percentUsed > 90 ? '#EF4444' : 'var(--primary)',
                            fontWeight: '700',
                            fontSize: '14px'
                        }}>
                            {percentUsed}%
                        </span>
                    </div>
                </div>

                {/* 애니메이션 스타일 */}
                <style jsx>{`
                    @keyframes fadeInScale {
                        from {
                            opacity: 0;
                            transform: scale(0.8) translateY(10px);
                        }
                        to {
                            opacity: 1;
                            transform: scale(1) translateY(0);
                        }
                    }
                    @keyframes shake {
                        10%, 90% { transform: translate3d(-1px, 0, 0); }
                        20%, 80% { transform: translate3d(2px, 0, 0); }
                        30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
                        40%, 60% { transform: translate3d(4px, 0, 0); }
                    }
                `}</style>
            </div>
        </div>
    );
}

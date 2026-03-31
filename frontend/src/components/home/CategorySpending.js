"use client";

import { useState, useEffect } from 'react';
import { getCategoryStats } from '@/lib/api/transaction';
import { CATEGORY_COLORS, normalizeCategory } from '@/components/common/CategoryIcons';
import { useAuth } from '@/contexts/AuthContext';

// 기본 색상 팔레트 (카테고리 매핑 실패시 사용)
const FALLBACK_COLORS = [
    '#14B8A6', '#0D9488', '#5EEAD4', '#2DD4BF',
    '#0F766E', '#99F6E4', '#06B6D4', '#0891B2',
    '#67E8F9', '#10B981', '#34D399', '#22D3EE'
];

export default function CategorySpending() {
    const { isAuthenticated, isNativeApp, startNativeGoogleLogin } = useAuth();
    const [data, setData] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchCategoryStats();
    }, [isAuthenticated]);

    const fetchCategoryStats = async () => {
        // 인증되지 않은 경우 API 호출하지 않음
        if (!isAuthenticated) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError(null);
            const today = new Date();
            const response = await getCategoryStats(today.getFullYear(), today.getMonth() + 1);
            console.log('API Response Categories:', response.categories.map(c => c.category)); // Debugging log

            // 카테고리별 색상 지정 및 정렬
            const categoriesWithColors = response.categories
                .map((cat, index) => {
                    const normalizedName = normalizeCategory(cat.category);
                    return {
                        name: normalizedName,
                        originalName: cat.category,
                        amount: cat.amount,
                        percent: cat.percent,
                        color: CATEGORY_COLORS[normalizedName] || FALLBACK_COLORS[index % FALLBACK_COLORS.length]
                    };
                })
                .sort((a, b) => b.amount - a.amount) // 금액 내림차순 정렬
                .slice(0, 5); // 상위 5개만 선택

            setData(categoriesWithColors);
            setTotal(response.total);

        } catch (err) {
            console.error('Failed to fetch category stats:', err);
            setError('데이터를 불러오는데 실패했습니다.');
        } finally {
            setLoading(false);
        }
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

    // 클릭된 카테고리 인덱스 (null이면 전체 토탈 표시)
    const [activeIndex, setActiveIndex] = useState(null);

    // SVG 좌표 계산 (반지름 r 추가)
    const getCoordinatesForPercent = (percent, radius = 1) => {
        const x = radius * Math.cos(2 * Math.PI * percent);
        const y = radius * Math.sin(2 * Math.PI * percent);
        return [x, y];
    };

    if (loading) {
        return (
            <div style={{
                backgroundColor: 'white',
                borderRadius: 'var(--radius-lg)',
                padding: '1rem 1.5rem',
                boxShadow: 'var(--shadow-md)',
                marginBottom: '0.75rem',
                textAlign: 'center'
            }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '0.25rem' }}>카테고리별 소비</h2>
                <p style={{ color: 'var(--text-sub)', padding: '3rem 0' }}>데이터를 불러오는 중...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{
                backgroundColor: 'white',
                borderRadius: 'var(--radius-lg)',
                padding: '1rem 1.5rem',
                boxShadow: 'var(--shadow-md)',
                marginBottom: '0.75rem',
                textAlign: 'center'
            }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '0.25rem' }}>카테고리별 소비</h2>
                <p style={{ color: '#ef4444', padding: '3rem 0' }}>{error}</p>
            </div>
        );
    }

    if (data.length === 0) {
        return (
            <div style={{
                backgroundColor: 'white',
                borderRadius: 'var(--radius-lg)',
                padding: '1rem 1.5rem',
                boxShadow: 'var(--shadow-md)',
                marginBottom: '0.75rem',
                textAlign: 'center'
            }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '0.25rem' }}>카테고리별 소비</h2>
                {!isAuthenticated ? (
                    <>
                        <p style={{ color: 'var(--text-sub)', padding: '2rem 0 1rem 0' }}>로그인하고 카테고리별 지출을 확인하세요</p>
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
                                    marginBottom: '1rem',
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
                                    fontWeight: '600',
                                    marginBottom: '1rem'
                                }}
                            >
                                로그인하기
                            </a>
                        )}
                    </>
                ) : (
                    <p style={{ color: 'var(--text-sub)', padding: '3rem 0' }}>아직 지출 내역이 없습니다.</p>
                )}
            </div>
        );
    }

    // Top 5 항목들의 총합 계산 (차트 정규화용)
    const totalTop5 = data.reduce((acc, curr) => acc + curr.amount, 0);
    let cumulativePercent = 0;

    // 현재 표시할 중앙 데이터
    const centerData = activeIndex !== null ? data[activeIndex] : null;

    return (
        <div style={{
            backgroundColor: 'white',
            borderRadius: 'var(--radius-lg)',
            padding: '1rem 1.5rem',
            boxShadow: 'var(--shadow-md)',
            marginBottom: '0.75rem'
        }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '0.25rem' }}>카테고리별 소비</h2>

            {/* Donut Chart */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.25rem', position: 'relative' }}>
                <svg viewBox="-1.25 -1.25 2.5 2.5" style={{ transform: 'rotate(-90deg)', width: '320px', height: '320px', overflow: 'visible' }}>
                    {data.map((slice, index) => {
                        // 차트에는 Top 5 내에서의 비중을 사용
                        const relativePercent = slice.amount / totalTop5;
                        const start = cumulativePercent;
                        cumulativePercent += relativePercent;
                        const end = cumulativePercent;

                        const isActive = activeIndex === index;
                        const outerRadius = isActive ? 1.1 : 1.0;

                        const [startX, startY] = getCoordinatesForPercent(start, outerRadius);
                        const [endX, endY] = getCoordinatesForPercent(end, outerRadius);

                        const largeArcFlag = relativePercent > 0.5 ? 1 : 0;

                        const pathData = [
                            `M ${startX} ${startY}`,
                            `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${endX} ${endY}`, // 외곽 큰 호
                            `L 0 0`, // 중심으로 선을 긋지만 실제로는 fill-rule로 구멍 뚫기에 영향
                        ].join(' ');

                        // Donut shape trick: L 0 0 is simple for pie, but for donut we rely on overlaying a white circle or using complex path with inner radius.
                        // The previous implementation utilized overlaying white circle. I keep it that way but handle simple pie slices for now and overlay circle. 
                        // Wait, previous code was: M start A ... L 0 0. This creates a pie slice.
                        // And then a white circle r=0.75 on top. This works fine for donut.
                        // However, if we expand outer radius, the inner "hole" is still covered by the fixed white circle.
                        // So just expanding the pie slice works perfectly.

                        return (
                            <path
                                key={index}
                                d={pathData}
                                fill={slice.color}
                                stroke="white"
                                strokeWidth="0.02" // 경계선 줄임
                                style={{
                                    cursor: 'pointer',
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    opacity: activeIndex !== null && !isActive ? 0.6 : 1
                                }}
                                onClick={() => setActiveIndex(isActive ? null : index)}
                            />
                        );
                    })}
                    {/* Center Hole for Donut Effect */}
                    <circle cx="0" cy="0" r="0.75" fill="white" />
                </svg>

                {/* Center Text Overlay */}
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    textAlign: 'center',
                    pointerEvents: 'none', // 클릭 통과
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '160px' // 구멍 크기에 맞게 제한
                }}>
                    {centerData ? (
                        <>
                            <div style={{
                                fontSize: '1rem',
                                fontWeight: '600',
                                color: centerData.color,
                                marginBottom: '0.25rem'
                            }}>
                                {centerData.name}
                            </div>
                            <div style={{
                                fontSize: '1.25rem',
                                fontWeight: '800',
                                color: 'var(--text-main)',
                                lineHeight: '1.2'
                            }}>
                                {centerData.percent.toFixed(1)}%
                            </div>
                            <div style={{
                                fontSize: '0.9rem',
                                color: 'var(--text-sub)',
                                marginTop: '0.25rem'
                            }}>
                                ₩{centerData.amount.toLocaleString()}
                            </div>
                        </>
                    ) : (
                        <>
                            <div style={{
                                fontSize: '1rem',
                                fontWeight: '600',
                                color: 'var(--text-sub)',
                                lineHeight: '1.4',
                            }}>
                                차트를 눌러<br />자세히 보기
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {data.map((item, index) => (
                    <div
                        key={index}
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '0.75rem',
                            borderBottom: index < data.length - 1 ? '1px solid #f7fafc' : 'none',
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: 'transparent',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{ width: '12px', height: '12px', borderRadius: '4px', backgroundColor: item.color }}></div>
                            <span style={{ fontSize: '1rem', color: 'var(--text-main)', fontWeight: '500' }}>{item.name}</span>
                        </div>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-sub)', fontWeight: '500' }}>
                            {item.percent.toFixed(1)}%
                        </span>
                    </div>
                ))}
            </div>
        </div >
    );
}

"use client";

import { useState, useEffect } from 'react';
import { getCategoryStats } from '@/lib/api/transaction';
import { CATEGORY_COLORS, normalizeCategory } from '@/components/common/CategoryIcons';

// 기본 색상 팔레트 (카테고리 매핑 실패시 사용)
const FALLBACK_COLORS = [
    '#14b8a6', '#f59e0b', '#8b5cf6', '#ec4899',
    '#3b82f6', '#ef4444', '#10b981', '#6366f1',
    '#f97316', '#06b6d4', '#84cc16', '#d946ef'
];

export default function CategorySpending() {
    const [data, setData] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);


    useEffect(() => {
        fetchCategoryStats();
    }, []);

    const fetchCategoryStats = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await getCategoryStats();
            console.log('API Response Categories:', response.categories.map(c => c.category)); // Debugging log

            // 카테고리별 색상 지정
            const categoriesWithColors = response.categories.map((cat, index) => {
                const normalizedName = normalizeCategory(cat.category);
                return {
                    name: normalizedName,
                    originalName: cat.category, // Keep original for reference if needed
                    amount: cat.amount,
                    percent: cat.percent,
                    color: CATEGORY_COLORS[normalizedName] || FALLBACK_COLORS[index % FALLBACK_COLORS.length]
                };
            });

            setData(categoriesWithColors);
            setTotal(response.total);
            // 기본값으로 가장 큰 비율의 카테고리 선택

        } catch (err) {
            console.error('Failed to fetch category stats:', err);
            setError('데이터를 불러오는데 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    // SVG 좌표 계산
    const getCoordinatesForPercent = (percent) => {
        const x = Math.cos(2 * Math.PI * percent);
        const y = Math.sin(2 * Math.PI * percent);
        return [x, y];
    };

    // 카테고리 클릭 핸들러


    if (loading) {
        return (
            <div style={{
                backgroundColor: 'white',
                borderRadius: 'var(--radius-lg)',
                padding: '2rem 1.5rem',
                boxShadow: 'var(--shadow-md)',
                marginBottom: '2.5rem',
                textAlign: 'center'
            }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '2rem' }}>카테고리별 소비</h2>
                <p style={{ color: 'var(--text-sub)', padding: '3rem 0' }}>데이터를 불러오는 중...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{
                backgroundColor: 'white',
                borderRadius: 'var(--radius-lg)',
                padding: '2rem 1.5rem',
                boxShadow: 'var(--shadow-md)',
                marginBottom: '2.5rem',
                textAlign: 'center'
            }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '2rem' }}>카테고리별 소비</h2>
                <p style={{ color: '#ef4444', padding: '3rem 0' }}>{error}</p>
            </div>
        );
    }

    if (data.length === 0) {
        return (
            <div style={{
                backgroundColor: 'white',
                borderRadius: 'var(--radius-lg)',
                padding: '2rem 1.5rem',
                boxShadow: 'var(--shadow-md)',
                marginBottom: '2.5rem',
                textAlign: 'center'
            }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '2rem' }}>카테고리별 소비</h2>
                <p style={{ color: 'var(--text-sub)', padding: '3rem 0' }}>아직 지출 내역이 없습니다.</p>
            </div>
        );
    }

    let cumulativePercent = 0;

    return (
        <div style={{
            backgroundColor: 'white',
            borderRadius: 'var(--radius-lg)',
            padding: '2rem 1.5rem',
            boxShadow: 'var(--shadow-md)',
            marginBottom: '2.5rem'
        }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '2rem' }}>카테고리별 소비</h2>

            {/* Donut Chart */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2.5rem', position: 'relative' }}>
                <svg viewBox="-1.5 -1.5 3 3" style={{ transform: 'rotate(-90deg)', width: '200px', height: '200px' }}>
                    {data.map((slice, index) => {
                        const start = cumulativePercent;
                        cumulativePercent += slice.percent / 100;
                        const end = cumulativePercent;

                        const [startX, startY] = getCoordinatesForPercent(start);
                        const [endX, endY] = getCoordinatesForPercent(end);

                        const largeArcFlag = slice.percent > 50 ? 1 : 0;

                        const pathData = [
                            `M ${startX} ${startY}`,
                            `A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY}`,
                            `L 0 0`,
                        ].join(' ');

                        // 선택된 카테고리인지 확인
                        return (
                            <path
                                key={index}
                                d={pathData}
                                fill={slice.color}
                                stroke="white"
                                strokeWidth="0.08"
                            />
                        );
                    })}
                    {/* Center Hole for Donut Effect */}
                    <circle cx="0" cy="0" r="0.7" fill="white" />
                </svg>
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-sub)', fontWeight: '500' }}>
                                {item.percent.toFixed(1)}%
                            </span>
                            <span style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-main)' }}>
                                ₩{item.amount.toLocaleString()}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div >
    );
}

"use client";

import { useState, useEffect } from 'react';
import { getCategoryStats } from '@/lib/api/transaction';
import { useAuth } from '@/contexts/AuthContext';

export default function TotalSpending() {
    const { user } = useAuth();
    const [totalSpending, setTotalSpending] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchTotalSpending();
    }, []);

    const fetchTotalSpending = async () => {
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

    // 사용자 예산 가져오기 (없으면 0)
    const budget = user?.monthly_budget ? Number(user.monthly_budget) : 0;
    const remaining = budget - totalSpending;
    const percentUsed = budget > 0 ? Math.round((totalSpending / budget) * 100) : 0;

    return (
        <div style={{
            backgroundColor: 'white',
            borderRadius: 'var(--radius-lg)',
            padding: '1.75rem',
            boxShadow: 'var(--shadow-md)',
            marginBottom: '0.75rem',
            position: 'relative',
            overflow: 'hidden'
        }}>
            <div style={{ position: 'relative', zIndex: 1 }}>
                <p style={{ fontSize: '0.95rem', color: 'var(--text-sub)', marginBottom: '0.5rem', fontWeight: '500' }}>이번 달 총 소비</p>
                <h2 style={{ fontSize: '2.25rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '1.25rem', letterSpacing: '-0.02em' }}>
                    {loading ? '...' : `₩${totalSpending.toLocaleString()}`}
                </h2>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-sub)', fontWeight: '500' }}>
                        남은 예산: {remaining.toLocaleString()}/{budget.toLocaleString()}(₩)
                    </span>
                    <span style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--primary)' }}>{percentUsed}%</span>
                </div>

                <div style={{ width: '100%', height: '12px', backgroundColor: '#edf2f7', borderRadius: '6px', overflow: 'hidden' }}>
                    <div style={{
                        width: `${Math.min(percentUsed, 100)}%`,
                        height: '100%',
                        backgroundColor: 'var(--primary)',
                        borderRadius: '6px',
                        transition: 'width 0.3s ease'
                    }}></div>
                </div>
            </div>
        </div>
    );
}

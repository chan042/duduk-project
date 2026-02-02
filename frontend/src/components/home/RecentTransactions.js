import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { getTransactions } from '../../lib/api/transaction';
import { getCategoryIconComponent, normalizeCategory, CATEGORY_COLORS } from '@/components/common/CategoryIcons';

export default function RecentTransactions() {
    const [transactions, setTransactions] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchTransactions = async () => {
            try {
                const data = await getTransactions();
                setTransactions(data.transactions);
            } catch (error) {
                console.error('Failed to fetch transactions:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchTransactions();
    }, []);

    // 날짜 포맷팅 (예: 2024-11-30 -> 11월 30일)
    const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
    };

    if (isLoading) {
        return <div style={{ padding: '2rem', textAlign: 'center' }}>로딩 중...</div>;
    }

    return (
        <div style={{
            backgroundColor: 'white',
            borderRadius: 'var(--radius-lg)',
            padding: '1.75rem',
            boxShadow: 'var(--shadow-md)',
            marginBottom: '0.75rem' // Reduced margin as per previous task
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-main)' }}>최근 내역</h2>
                <Link
                    href="/expense?view=list"
                    style={{
                        textDecoration: 'none',
                        fontSize: '0.9rem',
                        color: 'var(--text-sub)',
                        fontWeight: '600',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem'
                    }}
                >
                    더보기 <ChevronRight size={16} />
                </Link>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
                {!Array.isArray(transactions) || transactions.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-sub)' }}>
                        아직 지출 내역이 없습니다.
                    </div>
                ) : (
                    transactions
                        .sort((a, b) => new Date(b.date) - new Date(a.date)) // 최근 날짜 순으로 정렬
                        .slice(0, 5) // 최근 5개만 선택
                        .map((t, index) => {
                            const normalizedCategory = normalizeCategory(t.category);
                            const Icon = getCategoryIconComponent(normalizedCategory);
                            const iconColor = CATEGORY_COLORS[normalizedCategory] || '#14b8a6';

                            return (
                                <div key={t.id} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '1rem 0',
                                    borderBottom: index < 4 ? '1px solid #f1f5f9' : 'none',
                                    cursor: 'pointer'
                                }}>
                                    <div style={{
                                        backgroundColor: '#f7f9fa',
                                        padding: '0.75rem',
                                        borderRadius: '50%',
                                        marginRight: '1rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>
                                        <Icon size={20} color={iconColor} strokeWidth={2} />
                                    </div>

                                    <div style={{ flex: 1 }}>
                                        <h3 style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--text-main)', marginBottom: '0.25rem' }}>
                                            {t.store || t.item || '알 수 없음'}
                                        </h3>
                                        <p style={{ fontSize: '0.8rem', color: 'var(--text-sub)', fontWeight: '500' }}>
                                            {formatDate(t.date)} | {t.category}
                                        </p>
                                    </div>

                                    <span style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-main)' }}>
                                        {t.amount.toLocaleString()}원
                                    </span>
                                </div>
                            );
                        })
                )}
            </div>
        </div>
    );
}

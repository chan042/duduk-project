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
        <div style={{ paddingBottom: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', paddingLeft: '0.5rem', paddingRight: '0.5rem' }}>
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {!Array.isArray(transactions) || transactions.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-sub)' }}>
                        아직 지출 내역이 없습니다.
                    </div>
                ) : (
                    transactions
                        .sort((a, b) => new Date(b.date) - new Date(a.date)) // 최근 날짜 순으로 정렬
                        .slice(0, 5) // 최근 5개만 선택
                        .map((t) => {
                            const normalizedCategory = normalizeCategory(t.category);
                            const Icon = getCategoryIconComponent(normalizedCategory);
                            // Using fixed teal color for RecentTransactions design consistency, or use specific color if desired by user.
                            // User requirement: "Same category is displayed with same icon and color"
                            // But originally this component used a fixed teal theme (bg #ccfbf1, icon #14b8a6).
                            // If we use CATEGORY_COLORS, we might break the designated "Recent Items" look.
                            // However, user explicitly asked for "same icon and color".
                            // Compromise: Use the correct ICON but keep the teal styling for this specific widget to prevent visual breakage, 
                            // UNLESS user strictly wants colorful icons here too. 
                            // Reviewing request: "Same category is displayed with same icon and color in all screens".
                            // Okay, I will try to respect the color too. But the background circle is hardcoded teal.
                            // I will set the icon color to the category color. The background will remain teal-ish or I should make it neutral?
                            // Let's keep the background as is for now and just change the icon color.
                            const iconColor = CATEGORY_COLORS[normalizedCategory] || '#14b8a6';

                            return (
                                <div key={t.id} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    backgroundColor: 'white',
                                    padding: '1.25rem',
                                    borderRadius: 'var(--radius-md)',
                                    boxShadow: 'var(--shadow-sm)',
                                    transition: 'transform 0.1s ease',
                                    cursor: 'pointer'
                                }}>
                                    <div style={{
                                        backgroundColor: '#f7f9fa', // Changed to neutral to support colored icons
                                        padding: '0.85rem',
                                        borderRadius: '50%',
                                        marginRight: '1.25rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>
                                        <Icon size={22} color={iconColor} strokeWidth={2} />
                                    </div>

                                    <div style={{ flex: 1 }}>
                                        <h3 style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--text-main)', marginBottom: '0.25rem' }}>
                                            {t.store || t.item || '알 수 없음'}
                                        </h3>
                                        <p style={{ fontSize: '0.85rem', color: 'var(--text-sub)', fontWeight: '500' }}>
                                            {formatDate(t.date)} | {t.category}
                                        </p>
                                    </div>

                                    <span style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-main)' }}>
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

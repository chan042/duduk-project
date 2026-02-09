"use client";

import { Bot, Plus, Home, Calendar, Trophy, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function BottomNavigation({ onQuickAddClick }) {
    const pathname = usePathname();
    const isHome = pathname === '/';

    return (
        <div style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: 'white',
            borderTop: '1px solid #eee',
            height: '60px',
            maxWidth: '430px',
            margin: '0 auto',
            zIndex: 100,
            paddingBottom: 'env(safe-area-inset-bottom)',
        }}>
            {/* Grid 레이아웃: 5개 버튼 균등 배치 */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(5, 1fr)',
                alignItems: 'center',
                height: '100%',
                position: 'relative',
                padding: '0 0.5rem',
            }}>
                {/* 챌린지 */}
                <Link href="/challenge" style={{
                    ...styles.navButton,
                    color: pathname === '/challenge' ? 'var(--primary)' : 'var(--text-sub)'
                }}>
                    <Trophy size={24} />
                    <span style={styles.navLabel}>챌린지</span>
                </Link>

                {/* 달력 */}
                <Link href="/expense" style={{
                    ...styles.navButton,
                    color: pathname === '/expense' ? 'var(--primary)' : 'var(--text-sub)'
                }}>
                    <Calendar size={24} />
                    <span style={styles.navLabel}>달력</span>
                </Link>

                {/* 홈 (선택 시 + 버튼으로 변경) */}
                {isHome ? (
                    <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
                        <button
                            onClick={onQuickAddClick}
                            style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '50%',
                                backgroundColor: 'var(--primary)',
                                color: 'white',
                                border: 'none',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                            }}
                        >
                            <Plus size={22} />
                        </button>
                    </div>
                ) : (
                    <Link href="/" style={{
                        ...styles.navButton,
                        color: 'var(--text-sub)'
                    }}>
                        <Home size={24} />
                        <span style={styles.navLabel}>홈</span>
                    </Link>
                )}

                {/* 코칭 */}
                <Link href="/coaching" style={{
                    ...styles.navButton,
                    color: pathname === '/coaching' ? 'var(--primary)' : 'var(--text-sub)'
                }}>
                    <Bot size={24} />
                    <span style={styles.navLabel}>코칭</span>
                </Link>

                {/* 윤택지수 */}
                <Link href="/yuntaek-index" style={{
                    ...styles.navButton,
                    color: pathname === '/yuntaek-index' ? 'var(--primary)' : 'var(--text-sub)'
                }}>
                    <TrendingUp size={24} />
                    <span style={styles.navLabel}>윤택지수</span>
                </Link>
            </div>
        </div>
    );
}

const styles = {
    navButton: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textDecoration: 'none',
        fontSize: '0.75rem',
        gap: '4px',
        cursor: 'pointer',
    },
    navLabel: {
        fontSize: '0.75rem',
    },
};

"use client";

import { Bot, Plus, User, Home, Calendar } from 'lucide-react';
import Link from 'next/link';

export default function BottomNavigation({ onQuickAddClick }) {
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
            {/* Grid 레이아웃: 5개 버튼 균등 배치 (좌2 + 중1 + 우2) */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(5, 1fr)',
                alignItems: 'center',
                height: '100%',
                position: 'relative',
                padding: '0 0.5rem',
            }}>
                {/* 좌측 버튼 1: 홈 */}
                <Link href="/" style={styles.navButton}>
                    <Home size={24} />
                    <span style={styles.navLabel}>홈</span>
                </Link>

                <Link href="/expense" style={styles.navButton}>
                    <Calendar size={24} />
                    <span style={styles.navLabel}>달력</span>
                </Link>

                {/* 중앙 Quick Add 버튼 */}
                <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
                    <button
                        onClick={onQuickAddClick}
                        style={{
                            width: '56px',
                            height: '56px',
                            borderRadius: '50%',
                            backgroundColor: 'var(--primary)',
                            color: 'white',
                            border: 'none',
                            boxShadow: '0 4px 6px rgba(0,0,0,0.2)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            transform: 'translateY(-20px)',
                        }}
                    >
                        <Plus size={32} />
                    </button>
                </div>

                {/* 우측 버튼 1: 코칭 */}
                <Link href="/coaching" style={styles.navButton}>
                    <Bot size={24} />
                    <span style={styles.navLabel}>코칭</span>
                </Link>

                {/* 우측 버튼 2: 프로필 */}
                <Link href="/profile" style={styles.navButton}>
                    <User size={24} />
                    <span style={styles.navLabel}>프로필</span>
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
        color: 'var(--text-sub)',
        textDecoration: 'none',
        fontSize: '0.75rem',
        gap: '4px',
        cursor: 'pointer',
    },
    navLabel: {
        fontSize: '0.75rem',
    },
};

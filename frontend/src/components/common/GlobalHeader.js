"use client";

import { usePathname, useRouter } from 'next/navigation';
import { User, Bell, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { useNotification } from '@/contexts/NotificationContext';


export default function GlobalHeader() {
    const pathname = usePathname();
    const router = useRouter();
    const { unreadCount } = useNotification();
    const isHome = pathname === '/';
    const managesOwnSafeArea = pathname === '/chatbot';

    const getHeaderContent = () => {
        if (isHome) {
            return {
                left: (
                    <Link href="/profile" style={{ display: 'flex', alignItems: 'center' }}>
                        <User color="var(--text-main)" size={24} />
                    </Link>
                ),
                title: 'Duduk',
                right: (
                    <Link href="/notification" style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                        <Bell color="var(--text-main)" size={24} />
                        {unreadCount > 0 && <div style={styles.notificationBadge} />}
                    </Link>
                )
            };
        }

        if (pathname === '/profile') {
            return {
                title: '프로필',
                left: (
                    <button onClick={() => router.back()} style={styles.backButton}>
                        <ChevronLeft size={24} />
                    </button>
                )
            };
        }

        if (pathname === '/notification') {
            return {
                title: '알림',
                left: (
                    <button onClick={() => router.back()} style={styles.backButton}>
                        <ChevronLeft size={24} />
                    </button>
                )
            };
        }

        if (pathname === '/challenge-battle/search') {
            return {
                title: ' ',
                left: (
                    <button onClick={() => router.push('/yuntaek-index')} style={styles.backButton}>
                        <ChevronLeft size={24} />
                    </button>
                )
            };
        }

        if (pathname === '/challenge-battle/progress') {
            return {
                title: ' ',
                left: (
                    <button onClick={() => router.push('/yuntaek-index')} style={styles.backButton}>
                        <ChevronLeft size={24} />
                    </button>
                )
            };
        }

        if (pathname === '/challenge-battle/result') {
            return {
                title: '대결 결과',
                left: (
                    <button onClick={() => router.push('/yuntaek-index')} style={styles.backButton}>
                        <ChevronLeft size={24} />
                    </button>
                )
            };
        }

        if (pathname === '/challenge-battle/result2') {
            return {
                title: '대결 결과',
                left: (
                    <button onClick={() => router.push('/yuntaek-index')} style={styles.backButton}>
                        <ChevronLeft size={24} />
                    </button>
                )
            };
        }

        return null;
    };

    const content = getHeaderContent();
    if (!content) {
        if (managesOwnSafeArea) {
            return null;
        }
        return <div style={styles.safeAreaSpacer} aria-hidden="true" />;
    }

    return (
        <header style={styles.header}>
            {isHome ? (
                <>
                    <div style={styles.sideArea}>
                        {content.left}
                    </div>
                    <h1 style={styles.homeTitle}>
                        {content.title}
                    </h1>
                    <div style={styles.sideArea}>
                        {content.right}
                    </div>
                </>
            ) : (
                <>
                    <div style={styles.leftGroup}>
                        {content.left}
                        <h1 style={styles.pageTitle}>
                            {content.title}
                        </h1>
                    </div>
                    {content.right && (
                        <div style={styles.rightGroup}>
                            {content.right}
                        </div>
                    )}
                </>
            )}
        </header>
    );
}

const styles = {
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 'calc(1rem + var(--safe-area-top)) 1rem 1rem',
        backgroundColor: 'var(--background-light)',
        position: 'sticky',
        top: 0,
        zIndex: 50
    },
    safeAreaSpacer: {
        height: 'var(--safe-area-top)',
        backgroundColor: 'var(--background-light)',
        flexShrink: 0,
    },
    sideArea: {
        width: '40px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    },
    leftGroup: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem' // Gap between icon and title
    },
    rightGroup: {
        display: 'flex',
        alignItems: 'center'
    },
    homeTitle: {
        color: 'var(--primary)',
        fontSize: '1.5rem',
        fontWeight: 'bold'
    },
    pageTitle: {
        color: 'var(--text-main)',
        fontSize: '1.5rem',
        fontWeight: 'bold'
    },
    pointsBadge: {
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        backgroundColor: 'white',
        padding: '6px 12px',
        borderRadius: '20px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    },
    pointsText: {
        fontSize: '0.875rem',
        fontWeight: '600',
        color: 'var(--primary)',
    },
    notificationBadge: {
        position: 'absolute',
        top: '-1px',
        right: '1px',
        width: '8px',
        height: '8px',
        backgroundColor: '#ff4d4f',
        borderRadius: '50%',
        border: '1.5px solid var(--background-light)',
    },
    backButton: {
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        color: 'var(--text-main)',
        padding: '0.25rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    }
};

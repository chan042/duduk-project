"use client";

import { usePathname } from 'next/navigation';
import { User, Bell } from 'lucide-react';
import Link from 'next/link';


export default function GlobalHeader() {
    const pathname = usePathname();
    const isHome = pathname === '/';

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
                        <div style={styles.notificationBadge} />
                    </Link>
                )
            };
        }

        if (pathname === '/profile') {
            return { title: '프로필' };
        }

        if (pathname === '/notification') {
            return { title: '알림' };
        }

        return null;
    };

    const content = getHeaderContent();
    if (!content) return null;

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
        padding: '1rem',
        backgroundColor: 'var(--background-light)',
        position: 'sticky',
        top: 0,
        zIndex: 50
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
    }
};

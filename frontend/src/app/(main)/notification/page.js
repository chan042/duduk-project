"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useNotification } from '@/contexts/NotificationContext';
import NotificationCard from '@/components/notification/NotificationCard';
import LoadingOverlay from '@/components/common/LoadingOverlay';

export default function NotificationPage() {
    const { notifications, loading, fetchNotifications, markAsRead, markAllAsRead } = useNotification();
    const router = useRouter();
    const hasUnread = notifications.some((n) => !n.is_read);

    // 페이지 진입 시 전체 알림 목록 fetch
    useEffect(() => {
        fetchNotifications();
    }, [fetchNotifications]);

    const getSafeRedirect = (url) => {
        if (typeof url !== 'string') {
            return '/';
        }

        const normalized = url.trim();
        if (!normalized.startsWith('/') || normalized.startsWith('//') || normalized.includes('\\')) {
            return '/';
        }

        if (/[\u0000-\u001F\u007F]/.test(normalized)) {
            return '/';
        }

        return normalized;
    };

    const handleNotificationClick = async (notification) => {
        if (!notification.is_read) {
            markAsRead(notification.id);
        }
        router.push(getSafeRedirect(notification.redirect_url));
    };

    if (loading) {
        return <LoadingOverlay message="알림을 불러오는 중..." />;
    }

    if (notifications.length === 0) {
        return (
            <div style={styles.emptyContainer}>
                <p style={styles.emptyMessage}>새로운 알림이 없습니다.</p>
            </div>
        );
    }

    return (
        <div style={styles.page}>
            {hasUnread && (
                <button onClick={markAllAsRead} style={styles.readAllButton}>
                    전체 읽음
                </button>
            )}
            <div style={styles.list}>
                {notifications.map((notification) => (
                    <NotificationCard
                        key={notification.id}
                        notification={notification}
                        onClick={() => handleNotificationClick(notification)}
                    />
                ))}
            </div>
        </div>
    );
}

const styles = {
    emptyContainer: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: 'calc(100vh - 120px)',
        padding: '1rem',
    },
    emptyMessage: {
        color: 'var(--text-gray)',
        textAlign: 'center',
    },
    page: {
        padding: '1rem',
        minHeight: 'calc(100vh - 120px)',
    },
    readAllButton: {
        display: 'block',
        marginLeft: 'auto',
        marginBottom: '0.75rem',
        padding: '0.5rem 1rem',
        fontSize: '0.875rem',
        color: 'var(--primary)',
        backgroundColor: 'transparent',
        border: '1px solid var(--primary)',
        borderRadius: '8px',
        cursor: 'pointer',
    },
    list: {
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
    },
};

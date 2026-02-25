"use client";

import { useEffect, useState } from 'react';
import { MessageCircle, Target, TrendingUp } from 'lucide-react';

export function formatRelativeDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '방금 전';
    if (minutes < 60) return `${minutes}분 전`;
    if (hours < 24) return `${hours}시간 전`;
    if (days < 30) return `${days}일 전`;
    return date.toLocaleDateString('ko-KR');
}

const ICON_MAP = {
    COACHING: <MessageCircle size={24} color="var(--primary)" />,
    MONTHLY_REPORT: <TrendingUp size={24} color="var(--success)" />,
    CHALLENGE: <Target size={24} color="var(--primary)" />,
};

export default function NotificationCard({ notification, onClick }) {
    const [relativeDate, setRelativeDate] = useState('');

    useEffect(() => {
        const updateRelativeDate = () => {
            setRelativeDate(formatRelativeDate(notification.created_at));
        };

        updateRelativeDate();
        const timer = setInterval(updateRelativeDate, 60000);
        return () => clearInterval(timer);
    }, [notification.created_at]);

    const icon = ICON_MAP[notification.notification_type] || (
        <MessageCircle size={24} color="var(--text-gray)" />
    );

    return (
        <div
            onClick={onClick}
            style={{
                ...styles.card,
                backgroundColor: notification.is_read ? 'var(--background-light)' : 'white',
                borderLeft: notification.is_read ? 'none' : '3px solid var(--primary)',
            }}
        >
            <div style={styles.iconContainer}>
                {icon}
            </div>
            <div style={styles.content}>
                <h3 style={styles.title}>{notification.title}</h3>
                <p style={styles.message}>{notification.message}</p>
                <span style={styles.time}>{relativeDate}</span>
            </div>
        </div>
    );
}

const styles = {
    card: {
        display: 'flex',
        gap: '1rem',
        padding: '1rem',
        borderRadius: '8px',
        cursor: 'pointer',
        transition: 'all 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    },
    iconContainer: {
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    content: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.25rem',
    },
    title: {
        fontSize: '1rem',
        fontWeight: '600',
        color: 'var(--text-main)',
        margin: 0,
    },
    message: {
        fontSize: '0.875rem',
        color: 'var(--text-gray)',
        margin: 0,
    },
    time: {
        fontSize: '0.75rem',
        color: 'var(--text-light)',
        marginTop: '0.25rem',
    },
};

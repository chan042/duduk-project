"use client";

export default function NotificationPage() {
    return (
        <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: 'calc(100vh - 120px)',
            padding: '1rem'
        }}>
            <p style={{
                color: 'var(--text-gray)',
                textAlign: 'center'
            }}>
                새로운 알림이 없습니다.
            </p>
        </div>
    );
}

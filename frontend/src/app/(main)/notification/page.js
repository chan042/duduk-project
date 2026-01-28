"use client";

export default function NotificationPage() {
    return (
        <div style={{ padding: '1rem' }}>
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                color: 'var(--text-gray)'
            }}>
                <p style={{ textAlign: 'center', marginTop: '2rem' }}>
                    새로운 알림이 없습니다.
                </p>
            </div>
        </div>
    );
}

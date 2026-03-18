"use client";

import { useEffect, useState } from 'react';
import { X, CheckCircle } from 'lucide-react';

export default function MissionDetailModal({ isOpen, onClose, mission }) {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setIsVisible(true);
            // 배경 스크롤만 차단하고 앱 프레임 중심은 유지한다.
            document.body.style.overflow = 'hidden';
        } else {
            setTimeout(() => {
                setIsVisible(false);
                document.body.style.overflow = '';
            }, 300);
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    if (!isVisible && !isOpen) return null;

    return (
        <div style={{
            ...styles.overlay,
            opacity: isOpen ? 1 : 0,
            pointerEvents: isOpen ? 'auto' : 'none',
        }} onClick={onClose}>
            <div style={{
                ...styles.modalContainer,
                transform: isOpen ? 'scale(1)' : 'scale(0.95)',
                opacity: isOpen ? 1 : 0,
            }} onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div style={styles.header}>
                    <h3 style={styles.title}>미션 상세</h3>
                    <button onClick={onClose} style={styles.closeButton}>
                        <X size={24} color="var(--text-main)" />
                    </button>
                </div>

                {/* Content */}
                <div style={styles.content}>
                    <div style={styles.statusBadge(mission.status)}>
                        {mission.status === '진행중' ? 'ONGOING' : 'FINISHED'}
                    </div>
                    <h2 style={styles.missionTitle}>{mission.title}</h2>
                    <p style={styles.missionDescription}>{mission.description}</p>
                    
                    {/* Status Content */}
                    <div style={styles.statusSection}>
                        {mission.status === '진행중' ? (
                            <div style={styles.ongoingContainer}>
                                <div style={styles.ongoingIcon}>🏃</div>
                                <p style={styles.ongoingText}>먼저 달성해서 우위를 점하세요!</p>
                            </div>
                        ) : (
                            <div style={styles.finishedContainer}>
                                <CheckCircle size={28} color="var(--primary)" style={styles.finishedIcon} />
                                <p style={styles.finishedText}>
                                    <span style={styles.winnerName}>{mission.winner}</span>님이 달성했습니다!
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

const styles = {
    overlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        maxWidth: '430px',
        margin: '0 auto',
        boxSizing: 'border-box',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem',
        transition: 'opacity 0.3s ease-out',
    },
    modalContainer: {
        backgroundColor: 'white',
        borderRadius: '20px',
        width: '100%',
        maxWidth: '360px',
        maxHeight: '90vh',
        overflow: 'hidden',
        position: 'relative',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15)',
        transition: 'all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)',
        display: 'flex',
        flexDirection: 'column',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '1.25rem 1.5rem',
    },
    title: {
        fontSize: '1.1rem',
        fontWeight: '700',
        color: 'var(--text-main)',
        margin: 0,
    },
    closeButton: {
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '4px',
        color: 'var(--text-sub)',
    },
    content: {
        padding: '1.5rem',
        paddingTop: 0,
        overflowY: 'auto',
        maxHeight: 'calc(90vh - 80px)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
    },
    statusBadge: (status) => ({
        alignSelf: 'flex-start',
        padding: '4px 10px',
        borderRadius: '20px',
        fontSize: '0.8rem',
        fontWeight: '700',
        color: status === '진행중' ? '#3b82f6' : 'var(--text-sub)',
        backgroundColor: status === '진행중' ? '#eff6ff' : '#f1f5f9',
    }),
    missionTitle: {
        fontSize: '1.4rem',
        fontWeight: '700',
        color: 'var(--text-main)',
        margin: 0,
        lineHeight: 1.3,
    },
    missionDescription: {
        fontSize: '1rem',
        color: 'var(--text-sub)',
        lineHeight: 1.6,
        margin: 0,
    },
    statusSection: {
        marginTop: '1rem',
        padding: '1.5rem',
        borderRadius: 'var(--radius-md)',
        backgroundColor: '#f8fafc',
    },
    ongoingContainer: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
    },
    ongoingIcon: {
        fontSize: '2rem',
    },
    ongoingText: {
        fontSize: '1.05rem',
        fontWeight: '600',
        color: 'var(--text-main)',
        margin: 0,
    },
    finishedContainer: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.75rem',
    },
    finishedIcon: {
        marginBottom: '0.25rem',
    },
    finishedText: {
        fontSize: '1.1rem',
        color: 'var(--text-main)',
        margin: 0,
        textAlign: 'center',
    },
    winnerName: {
        fontWeight: '700',
        color: 'var(--primary)',
    }
};

"use client";

import { X, Coffee, ShoppingBag, MapPin, Droplets, Zap, Lightbulb } from 'lucide-react';

export default function CoachingDetailPopup({ isOpen, onClose, data }) {
    if (!isOpen || !data) return null;

    const getIcon = (subject) => {
        const props = { size: 48, color: "#2f855a", strokeWidth: 1.5 };
        switch (subject) {
            case "행동 변화 제안": return <Zap {...props} />;
            case "누수 소비": return <Droplets {...props} />;
            case "위치 기반 대안": return <MapPin {...props} />;
            case "키워드 기반 대안": return <ShoppingBag {...props} />;
            default: return <Coffee {...props} />; // Default icon
        }
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
            padding: '1.5rem'
        }} onClick={onClose}>
            <div style={{
                backgroundColor: 'white',
                width: '100%',
                maxWidth: '360px',
                borderRadius: '24px',
                overflow: 'hidden',
                position: 'relative',
                animation: 'slideUp 0.3s ease-out'
            }} onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div style={{
                    padding: '1.5rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid #f0f0f0'
                }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>AI 코칭</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                        <X size={24} color="#666" />
                    </button>
                </div>

                {/* Content */}
                <div style={{ padding: '2rem 1.5rem' }}>
                    {/* Icon */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'center',
                        marginBottom: '1.5rem'
                    }}>
                        {getIcon(data.tag)}
                    </div>

                    {/* Title */}
                    <h2 style={{
                        fontSize: '1.5rem',
                        fontWeight: 'bold',
                        textAlign: 'center',
                        marginBottom: '0.5rem',
                        lineHeight: '1.3'
                    }}>
                        {data.title}
                    </h2>

                    {/* Tag */}
                    <div style={{
                        textAlign: 'center',
                        marginBottom: '2rem'
                    }}>
                        <span style={{
                            color: '#2f855a',
                            fontWeight: '600',
                            fontSize: '0.95rem'
                        }}>
                            {data.tag}
                        </span>
                    </div>

                    {/* Main Content */}
                    <p style={{
                        fontSize: '1rem',
                        color: '#2d3748',
                        lineHeight: '1.6',
                        marginBottom: '1.5rem',
                        whiteSpace: 'pre-wrap'
                    }}>
                        {data.description}
                    </p>

                    {/* Analysis Box */}
                    <div style={{
                        backgroundColor: '#fffbeb', // Light yellow bg
                        padding: '1.25rem',
                        borderRadius: '12px',
                        marginBottom: '2rem'
                    }}>
                        <h4 style={{
                            fontSize: '0.9rem',
                            fontWeight: 'bold',
                            color: '#4a5568',
                            marginBottom: '0.5rem'
                        }}>
                            왜 이 코칭이 나왔을까요?
                        </h4>
                        <p style={{
                            fontSize: '0.95rem',
                            color: '#2d3748',
                            lineHeight: '1.5'
                        }}>
                            {data.analysis}
                        </p>
                    </div>

                    {/* Button */}
                    <button style={{
                        width: '100%',
                        padding: '1rem',
                        backgroundColor: '#2f855a',
                        color: 'white',
                        border: 'none',
                        borderRadius: '12px',
                        fontSize: '1rem',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                    }} onClick={onClose}>
                        챌린지 시작하기
                    </button>
                </div>
            </div>
            <style jsx>{`
                @keyframes slideUp {
                    from { transform: translateY(20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
            `}</style>
        </div>
    );
}

"use client";

import { X, Coffee, ShoppingBag, MapPin, Droplets, Zap, Lightbulb, Sparkles } from 'lucide-react';

export default function CoachingDetailPopup({ isOpen, onClose, data, onStartChallenge }) {
    if (!isOpen || !data) return null;

    const getIcon = (subject) => {
        const props = { size: 48, color: "#14b8a6", strokeWidth: 1.5 };
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
            padding: '1.5rem',
            overflowY: 'auto',
            overscrollBehavior: 'contain'
        }} onClick={onClose} onTouchMove={(e) => e.target === e.currentTarget && e.preventDefault()}>
            <div style={{
                backgroundColor: 'white',
                width: '100%',
                maxWidth: '360px',
                maxHeight: '80vh', // 최대 높이 제한
                display: 'flex',   // Flexbox 사용
                flexDirection: 'column', // 세로 방향 배치
                borderRadius: '24px',
                overflow: 'hidden', // 모서리 둥글게 유지
                position: 'relative',
                animation: 'slideUp 0.3s ease-out'
            }} onClick={e => e.stopPropagation()}>

                {/* Floating Close Button */}
                <button
                    onClick={onClose}
                    style={{
                        position: 'absolute',
                        top: '1.5rem',
                        right: '1.5rem',
                        zIndex: 20,
                        background: 'rgba(255, 255, 255, 0.8)',
                        backdropFilter: 'blur(8px)',
                        border: '1px solid rgba(0,0,0,0.05)',
                        borderRadius: '50%',
                        width: '40px',
                        height: '40px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                        transition: 'transform 0.2s ease'
                    }}
                    onMouseDown={e => e.currentTarget.style.transform = 'scale(0.95)'}
                    onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                >
                    <X size={20} color="#334155" />
                </button>

                {/* Scrollable Content */}
                <div style={{
                    padding: '0',
                    overflowY: 'auto',
                    overscrollBehavior: 'contain',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    background: '#ffffff'
                }}>

                    {/* Header Section */}
                    <div style={{
                        padding: '4.5rem 2rem 1.5rem 2rem',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        textAlign: 'center'
                    }}>
                        {/* Tag */}
                        <span style={{
                            backgroundColor: 'rgba(20, 184, 166, 0.1)',
                            color: '#0d9488',
                            padding: '6px 14px',
                            borderRadius: '100px',
                            fontSize: '0.85rem',
                            fontWeight: '700',
                            letterSpacing: '-0.01em',
                            marginBottom: '1rem'
                        }}>
                            {data.tag}
                        </span>

                        {/* Title */}
                        <h2 style={{
                            fontSize: '1.75rem',
                            fontWeight: '800',
                            color: '#111827',
                            marginBottom: '1rem',
                            lineHeight: '1.3',
                            letterSpacing: '-0.03em',
                            wordBreak: 'keep-all'
                        }}>
                            {data.title}
                        </h2>
                    </div>

                    {/* Body Content */}
                    <div style={{
                        padding: '0 2rem 8rem 2rem', // Bottom padding for footer
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2.5rem'
                    }}>
                        {/* Description */}
                        <div style={{
                            fontSize: '1.1rem',
                            color: '#334155',
                            lineHeight: '1.75',
                            letterSpacing: '-0.015em',
                            fontWeight: '400',
                            whiteSpace: 'pre-wrap'
                        }}>
                            {data.description}
                        </div>

                        {/* Analysis Card - Soft Surface Design */}
                        <div style={{
                            backgroundColor: '#f8fafc', // Very light slate/gray
                            borderRadius: '24px',
                            padding: '1.75rem',
                            border: '1px solid #f1f5f9'
                        }}>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                marginBottom: '1rem'
                            }}>
                                <Sparkles size={18} color="#0f766e" fill="#0f766e" />
                                <h4 style={{
                                    fontSize: '1rem',
                                    fontWeight: '700',
                                    color: '#0f766e', // Dark Teal
                                    margin: 0,
                                    letterSpacing: '-0.02em'
                                }}>
                                    이 코칭이 생성된 이유
                                </h4>
                            </div>
                            <p style={{
                                fontSize: '1rem',
                                color: '#1e293b', // Slate 800
                                lineHeight: '1.65',
                                margin: 0,
                                fontWeight: '500'
                            }}>
                                {data.analysis || "분석 내용이 없습니다."}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer (Floating Button) */}
                <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    padding: '1.5rem',
                    background: 'linear-gradient(to top, #ffffff 60%, rgba(255,255,255,0))',
                    zIndex: 10,
                    pointerEvents: 'none' // Let clicks pass through transparent part
                }}>
                    <div className="glow-button-wrapper" style={{ width: '100%', pointerEvents: 'auto' }}>
                        <button style={{
                            width: '100%',
                            padding: '1.1rem',
                            backgroundColor: '#14b8a6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '16px', // Slightly more rounded
                            fontSize: '1.05rem',
                            fontWeight: '700',
                            cursor: 'pointer',
                            position: 'relative',
                            zIndex: 2,
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                        }} onClick={() => {
                            if (onStartChallenge) {
                                onStartChallenge(data);
                            }
                            onClose();
                        }}>
                            이 코칭으로 챌린지 생성
                        </button>
                    </div>
                </div>
            </div>
            <style jsx>{`
                @keyframes slideUp {
                    from { transform: translateY(20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                @keyframes aurora {
                    0% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                    100% { background-position: 0% 50%; }
                }
                .glow-button-wrapper {
                    position: relative;
                    z-index: 1;
                }
                .glow-button-wrapper::before {
                    content: "";
                    position: absolute;
                    inset: -2px;
                    border-radius: 16px;
                    background: linear-gradient(45deg, #ff0000, #ff7300, #fffb00, #48ff00, #00ffd5, #002bff, #7a00ff, #ff00c8, #ff0000);
                    background-size: 400%;
                    z-index: -1;
                    filter: blur(4px);
                    opacity: 0.7;
                    animation: aurora 10s linear infinite;
                }
            `}</style>
        </div>
    );
}

"use client";

import { useState } from 'react';
import { Headset } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ChatbotFloatingButton() {
    const [isHovered, setIsHovered] = useState(false);
    const router = useRouter();

    return (
        <button
            onClick={() => router.push('/chatbot')}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{
                position: 'fixed',
                bottom: '100px',
                right: 'max(16px, calc(50vw - 195px))',
                transform: isHovered
                    ? 'translateY(-4px) scale(1.05)'
                    : 'translateY(0) scale(1)',
                width: '52px',
                height: 'auto',
                minHeight: '102px',
                padding: '0.75rem 0',
                border: 'none',
                borderRadius: '26px',
                background: isHovered
                    ? 'linear-gradient(135deg, var(--primary-dark) 0%, var(--primary) 48%, #5eead4 100%)'
                    : 'linear-gradient(135deg, #0d9488 0%, #14b8a6 48%, #5eead4 100%)',
                color: '#ffffff',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.8rem',
                boxShadow: isHovered 
                    ? '0 15px 30px rgba(13, 148, 136, 0.3)' 
                    : '0 10px 22px rgba(0, 0, 0, 0.15)',
                cursor: 'pointer',
                zIndex: 50,
                transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
            aria-label="Duduk AI 열기"
        >
            <Headset size={22} strokeWidth={2.5} />
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '1px'
            }}>
                <span style={{
                    fontSize: '0.65rem',
                    fontWeight: '900',
                    letterSpacing: '0.04em',
                    lineHeight: 1,
                    textShadow: '0 1px 2px rgba(0,0,0,0.1)'
                }}>
                    DUDUK
                </span>
                <span style={{
                    fontSize: '0.78rem',
                    fontWeight: '900',
                    lineHeight: 1,
                    letterSpacing: '0.02em',
                    opacity: 0.95
                }}>
                    AI
                </span>
            </div>
        </button>
    );
}

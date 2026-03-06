"use client";

import { useState } from 'react';
import { MessageCircle } from 'lucide-react';
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
                bottom: '90px', // Just above bottom nav
                right: 'max(20px, calc(50vw - 195px))', // Align with main 430px container
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                backgroundColor: 'var(--primary)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: isHovered
                    ? '0 6px 16px rgba(20, 184, 166, 0.4)'
                    : 'var(--shadow-md)',
                border: 'none',
                cursor: 'pointer',
                zIndex: 50,
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                transform: isHovered ? 'scale(1.05) translateY(-2px)' : 'scale(1)',
            }}
            aria-label="채팅 봇 실행하기"
        >
            <MessageCircle size={30} strokeWidth={2.5} />
        </button>
    );
}

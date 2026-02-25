"use client";

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import ChatMessage from '@/components/chatbot/ChatMessage';
import ChatInput from '@/components/chatbot/ChatInput';
import { useAuth } from '@/contexts/AuthContext';

export default function ChatbotPage() {
    const router = useRouter();
    const { user } = useAuth();
    const messagesEndRef = useRef(null);

    // 초기 상태에 인사말(assistant) 메시지 하나 추가
    const [messages, setMessages] = useState([
        { id: 1, role: 'assistant', content: '안녕하세요! 저는 소비를 도와주는 챗봇이에요. 무엇을 도와드릴까요?' }
    ]);
    const [isTyping, setIsTyping] = useState(false);

    // 새 메시지가 추가될 때마다 맨 아래로 자동 스크롤
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isTyping]);

    // 사용자가 메시지 전송
    const handleSendMessage = (text) => {
        const newUserMsg = { id: Date.now(), role: 'user', content: text };
        setMessages((prev) => [...prev, newUserMsg]);

        // 임시 로직: AI 응답 시뮬레이션
        setIsTyping(true);
        setTimeout(() => {
            const newAssistantMsg = {
                id: Date.now() + 1,
                role: 'assistant',
                content: '현재 개발 중인 기능입니다! 곧 똑똑한 소비 조언으로 찾아뵐게요.'
            };
            setMessages((prev) => [...prev, newAssistantMsg]);
            setIsTyping(false);
        }, 1500);
    };

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100dvh', // Use dvh for mobile browser compatibility
            backgroundColor: '#ffffff',
            position: 'relative',
            overflow: 'hidden' // Prevent body scroll
        }}>
            {/* 상단 헤더 (뒤로가기 포함) - 채팅방 느낌 */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                padding: '16px',
                borderBottom: '1px solid #f0f0f0',
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                backdropFilter: 'blur(10px)',
                position: 'sticky',
                top: 0,
                zIndex: 10
            }}>
                <button
                    onClick={() => router.back()}
                    style={{
                        background: 'none',
                        border: 'none',
                        padding: '8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text-main)'
                    }}
                >
                    <ChevronLeft size={24} />
                </button>
                <div style={{ flex: 1, textAlign: 'center', fontWeight: 'bold', fontSize: '1.1rem', marginRight: '40px' }}>
                    소비 코치
                </div>
            </div>

            {/* 대화 내용 영역 */}
            <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '20px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                paddingBottom: '-20px' // 여백
            }}>
                {messages.map((msg) => (
                    <ChatMessage key={msg.id} message={msg} characterType={user?.character_type || 'char_cat'} />
                ))}

                {isTyping && (
                    <div className="animate-fade-in-up" style={{ alignSelf: 'flex-start' }}>
                        <div style={{
                            backgroundColor: '#f1f5f9',
                            padding: '12px 16px',
                            borderRadius: '20px',
                            borderTopLeftRadius: '4px',
                            color: 'var(--text-sub)',
                            fontSize: '0.9rem',
                            display: 'flex',
                            gap: '4px'
                        }}>
                            <span className="dot">.</span>
                            <span className="dot" style={{ animationDelay: '0.2s' }}>.</span>
                            <span className="dot" style={{ animationDelay: '0.4s' }}>.</span>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* 하단 입력 영역 */}
            <div style={{ flexShrink: 0 }}>
                <ChatInput onSendMessage={handleSendMessage} disabled={isTyping} />
            </div>

            <style jsx>{`
                .dot {
                    animation: bounce 1.4s infinite ease-in-out both;
                }
                @keyframes bounce {
                    0%, 80%, 100% { transform: scale(0); }
                    40% { transform: scale(1); }
                }
            `}</style>
        </div>
    );
}

// 레이아웃 적용을 원치 않는 경우를 위해 기존 BottomNav 안보이게 처리 등 필요 시 
// HIDE_BOTTOM_NAV_ROUTES 에 '/chatbot' 추가가 필요할 수 있음 (현재는 일단 전체화면 형태)

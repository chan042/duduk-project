"use client";

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import ChatMessage from '@/components/chatbot/ChatMessage';
import ChatInput from '@/components/chatbot/ChatInput';
import { useAuth } from '@/contexts/AuthContext';
import { createChatSession, sendChatMessage } from '@/lib/api/chatbot';

const INTRO_MESSAGE_ID = 1;
const DEFAULT_ASSISTANT_NAME = '두둑이';

const createIntroMessage = (assistantName) => ({
    id: INTRO_MESSAGE_ID,
    role: 'assistant',
    content: `안녕하세요! 저는 ${assistantName} 상담사에요. 무엇을 도와드릴까요?`,
});

export default function ChatbotPage() {
    const router = useRouter();
    const { user, loading } = useAuth();
    const messagesEndRef = useRef(null);
    const sessionIdRef = useRef(null); // 대화 세션 ID 보관
    const assistantName = user?.character_name?.trim() || DEFAULT_ASSISTANT_NAME;

    // 초기 상태에 인사말(assistant) 메시지 하나 추가
    const [messages, setMessages] = useState([
        createIntroMessage(DEFAULT_ASSISTANT_NAME)
    ]);
    const [isTyping, setIsTyping] = useState(false);

    // 새 메시지가 추가될 때마다 맨 아래로 자동 스크롤
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isTyping]);

    useEffect(() => {
        const nextIntroMessage = createIntroMessage(assistantName);
        setMessages((prev) => {
            const hasOnlyIntroMessage = (
                prev.length === 1 &&
                prev[0].id === INTRO_MESSAGE_ID &&
                prev[0].role === 'assistant'
            );

            if (!hasOnlyIntroMessage || prev[0].content === nextIntroMessage.content) {
                return prev;
            }

            return [nextIntroMessage];
        });
    }, [assistantName]);

    // 컴포넌트 마운트 시 대화 세션 생성
    useEffect(() => {
        if (loading) return;
        const initSession = async () => {
            try {
                const session = await createChatSession();
                sessionIdRef.current = session.id;
            } catch (error) {
                console.error('챗봇 세션 생성 실패:', error);
            }
        };
        initSession();
    }, [loading]);

    useEffect(() => {
        const previousBodyOverflow = document.body.style.overflow;
        const previousHtmlOverflow = document.documentElement.style.overflow;
        const previousBodyOverscroll = document.body.style.overscrollBehavior;
        const previousHtmlOverscroll = document.documentElement.style.overscrollBehavior;

        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
        document.body.style.overscrollBehavior = 'none';
        document.documentElement.style.overscrollBehavior = 'none';

        return () => {
            document.body.style.overflow = previousBodyOverflow;
            document.documentElement.style.overflow = previousHtmlOverflow;
            document.body.style.overscrollBehavior = previousBodyOverscroll;
            document.documentElement.style.overscrollBehavior = previousHtmlOverscroll;
        };
    }, []);

    // 사용자가 메시지 전송
    const handleSendMessage = async (text) => {
        const newUserMsg = { id: Date.now(), role: 'user', content: text };
        setMessages((prev) => [...prev, newUserMsg]);
        setIsTyping(true);

        try {
            // 세션 ID가 없으면 재시도로 세션 생성
            if (!sessionIdRef.current) {
                const session = await createChatSession();
                sessionIdRef.current = session.id;
            }

            const result = await sendChatMessage(sessionIdRef.current, text);
            const assistantMsg = result.assistant_message;

            setMessages((prev) => [
                ...prev,
                {
                    id: assistantMsg.id,
                    role: assistantMsg.role,
                    content: assistantMsg.content,
                },
            ]);
        } catch (error) {
            console.error('메시지 전송 실패:', error);
            setMessages((prev) => [
                ...prev,
                {
                    id: Date.now() + 1,
                    role: 'assistant',
                    content: '죄송해요, 일시적인 오류가 발생했어요. 잠시 후 다시 시도해주세요. 🙏',
                },
            ]);
        } finally {
            setIsTyping(false);
        }
    };

    if (loading) return null;

    return (
        <div style={{
            display: 'grid',
            gridTemplateRows: 'auto minmax(0, 1fr) auto',
            height: '100%',
            minHeight: 0,
            maxHeight: '100%',
            backgroundColor: '#ffffff',
            position: 'relative',
            overflow: 'hidden'
        }}>
            {/* 상단 헤더 (뒤로가기 포함) - 채팅방 느낌 */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                flexShrink: 0,
                padding: 'calc(16px + var(--safe-area-top)) 16px 16px',
                borderBottom: '1px solid #f0f0f0',
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                backdropFilter: 'blur(10px)',
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
                    {assistantName} 상담사
                </div>
            </div>

            {/* 대화 내용 영역 */}
            <div style={{
                minHeight: 0,
                overflowY: 'auto',
                WebkitOverflowScrolling: 'touch',
                padding: '20px 16px 24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
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
                <ChatInput onSendMessage={handleSendMessage} disabled={isTyping} characterName={assistantName} />
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

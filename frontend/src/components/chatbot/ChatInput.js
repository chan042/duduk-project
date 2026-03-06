"use client";

import { useState } from 'react';
import { Send } from 'lucide-react';

export default function ChatInput({ onSendMessage, disabled, characterName }) {
    const [message, setMessage] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (message.trim() && !disabled) {
            onSendMessage(message.trim());
            setMessage('');
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
        }
    };

    return (
        <div style={{
            padding: '16px',
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            borderTop: '1px solid #f0f0f0',
            backdropFilter: 'blur(10px)',
            position: 'sticky',
            bottom: 0,
            zIndex: 10,
            paddingBottom: 'calc(16px + env(safe-area-inset-bottom))'
        }}>
            <form
                onSubmit={handleSubmit}
                style={{
                    display: 'flex',
                    alignItems: 'flex-end',
                    gap: '12px',
                    backgroundColor: '#f8fafc',
                    borderRadius: '24px',
                    padding: '8px 16px',
                    border: '1px solid #e2e8f0',
                    transition: 'border-color 0.2s ease',
                    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)'
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = 'var(--primary)'}
                onBlur={(e) => e.currentTarget.style.borderColor = '#e2e8f0'}
            >
                <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={`${characterName || "두둑이"}(이)에게 질문하기`}
                    disabled={disabled}
                    rows={1}
                    style={{
                        flex: 1,
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        resize: 'none',
                        fontSize: '0.95rem',
                        lineHeight: '1.5',
                        maxHeight: '100px',
                        padding: '8px 0',
                        color: 'var(--text-main)',
                    }}
                />
                <button
                    type="submit"
                    disabled={!message.trim() || disabled}
                    style={{
                        background: message.trim() && !disabled ? 'var(--primary)' : '#cbd5e1',
                        color: 'white',
                        border: 'none',
                        borderRadius: '50%',
                        width: '36px',
                        height: '36px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: message.trim() && !disabled ? 'pointer' : 'not-allowed',
                        transition: 'all 0.2s ease',
                        transform: message.trim() && !disabled ? 'scale(1)' : 'scale(0.95)',
                        marginBottom: '4px'
                    }}
                >
                    <Send size={18} />
                </button>
            </form>
        </div>
    );
}

"use client";

export default function ChatMessage({ message, characterType }) {
    const isUser = message.role === 'user';
    const normalizedCharacterType = characterType?.startsWith('char_')
        ? characterType
        : `char_${characterType || 'cat'}`;
    const chatbotAvatarSrc = `/images/characters/${normalizedCharacterType}/headset.png?v=20260225`;

    return (
        <div
            className="animate-fade-in-up"
            style={{
                display: 'flex',
                flexDirection: isUser ? 'row-reverse' : 'row',
                alignItems: 'flex-end',
                gap: '8px',
                marginBottom: '16px',
                width: '100%',
                animation: 'fadeInUp 0.3s ease-out forwards',
            }}
        >
            {/* 챗봇 프로필 아이콘 (두둑이 캐릭터) */}
            {!isUser && (
                <div style={{
                    minWidth: '40px',
                    height: '40px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '4px'
                }}>
                    <img
                        src={chatbotAvatarSrc}
                        alt="Duduki Avatar"
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                </div>
            )}

            {/* 메시지 버블 */}
            <div style={{
                maxWidth: '75%',
                padding: '12px 16px',
                borderRadius: '20px',
                backgroundColor: isUser ? 'var(--primary)' : '#f1f5f9',
                color: isUser ? '#ffffff' : 'var(--text-main)',
                borderBottomRightRadius: isUser ? '4px' : '20px',
                borderBottomLeftRadius: isUser ? '20px' : '4px',
                boxShadow: isUser ? '0 2px 8px rgba(20, 184, 166, 0.25)' : '0 1px 2px rgba(0,0,0,0.05)',
                fontSize: '0.95rem',
                lineHeight: '1.5',
                wordBreak: 'break-word',
            }}>
                {message.content}
            </div>
        </div>
    );
}

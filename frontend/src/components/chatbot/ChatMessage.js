"use client";

export default function ChatMessage({ message, characterType }) {
    const isUser = message.role === 'user';
    const normalizedCharacterType = characterType?.startsWith('char_')
        ? characterType
        : `char_${characterType || 'cat'}`;
    const chatbotAvatarSrc = `/images/characters/${normalizedCharacterType}/headset.png?v=20260324`;

    const bubbleStyle = {
        display: 'inline-block',
        width: 'fit-content',
        maxWidth: '100%',
        padding: '12px 16px',
        borderRadius: '20px',
        backgroundColor: isUser ? 'var(--primary)' : '#f1f5f9',
        color: isUser ? '#ffffff' : 'var(--text-main)',
        borderBottomRightRadius: isUser ? '4px' : '20px',
        borderBottomLeftRadius: isUser ? '20px' : '4px',
        boxShadow: isUser ? '0 2px 8px rgba(20, 184, 166, 0.25)' : '0 1px 2px rgba(0,0,0,0.05)',
        fontSize: '0.95rem',
        lineHeight: '1.5',
        whiteSpace: 'pre-wrap',
        wordBreak: 'keep-all',
        overflowWrap: 'break-word',
        WebkitTextSizeAdjust: '100%',
    };

    return (
        <div
            style={{
                display: 'flex',
                justifyContent: isUser ? 'flex-end' : 'flex-start',
                marginBottom: '16px',
                width: '100%',
                minWidth: 0,
            }}
        >
            {isUser ? (
                <div style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    maxWidth: '75%',
                    minWidth: 0,
                }}>
                    <div style={bubbleStyle}>
                        {message.content}
                    </div>
                </div>
            ) : (
                <div style={{
                    display: 'inline-flex',
                    alignItems: 'flex-end',
                    gap: '8px',
                    maxWidth: 'calc(100% - 16px)',
                    minWidth: 0,
                }}>
                    <div style={{
                        width: '40px',
                        minWidth: '40px',
                        height: '40px',
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '4px',
                    }}>
                        <img
                            src={chatbotAvatarSrc}
                            alt="Duduki Avatar"
                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                        />
                    </div>
                    <div style={{
                        ...bubbleStyle,
                        maxWidth: 'calc(100% - 48px)',
                        minWidth: 0,
                    }}>
                        {message.content}
                    </div>
                </div>
            )}
        </div>
    );
}

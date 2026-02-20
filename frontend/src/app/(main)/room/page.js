"use client";

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Shirt, Store, DoorClosed, Gamepad2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getEquippedItems } from '@/lib/api/shop';
import CoinRain from '@/components/room/CoinRain';

export default function RoomPage() {
    const router = useRouter();
    const { user, refreshUser } = useAuth();
    const [characterType, setCharacterType] = useState('char_dog');
    const [equippedItems, setEquippedItems] = useState({
        clothing: null,
        item: null,
        background: null
    });
    const [isLoading, setIsLoading] = useState(true);
    const characterRef = useRef(null);

    // 캐릭터 클릭 시 랜덤 대사
    const CHARACTER_MESSAGES = [
        '오늘 지출은 잘 관리되고 있나요?',
        '게임을 통해 포인트를 얻을 수 있어요.',
        '가끔씩 하늘을 날아다니는 꿈을 꿔요.',
        '오늘 하루도 수고 많았어요!',
        '오늘은 어떤 챌린지에 참여하나요?',
        '작은 절약이 큰 행복을 만들어요!',
        '예산을 초과하면 나도 슬퍼요...',
        '같이 두둑한 지갑 만들어봐요!',
        '나를 위한 소비는 가치있죠!',
        '제 패션 어때요? 전 너무 마음에 들어요!',
    ];
    const [characterSpeech, setCharacterSpeech] = useState(null);
    const [speechVisible, setSpeechVisible] = useState(false);
    const speechTimerRef = useRef(null);

    const handleCharacterClick = () => {
        const msg = CHARACTER_MESSAGES[Math.floor(Math.random() * CHARACTER_MESSAGES.length)];
        setCharacterSpeech(msg);
        setSpeechVisible(true);
        if (speechTimerRef.current) clearTimeout(speechTimerRef.current);
        speechTimerRef.current = setTimeout(() => setSpeechVisible(false), 3000);
    };

    // 사용자 캐릭터 타입 설정
    useEffect(() => {
        if (user && user.character_type) {
            let type = user.character_type.toLowerCase();
            if (!type.startsWith('char_')) {
                type = `char_${type}`;
            }
            setCharacterType(type);
        }
    }, [user]);

    // 착장 상태 로드 (localStorage)
    useEffect(() => {
        setIsLoading(true);
        const data = getEquippedItems();
        setEquippedItems({
            clothing: data.clothing || null,
            item: data.item || null,
            background: data.background || null
        });
        setIsLoading(false);
    }, []);

    // 캐릭터 이미지 경로 생성 (image_key 사용)
    const getCharacterImagePath = () => {
        const clothing = equippedItems.clothing;
        const item = equippedItems.item;

        // 기본 이미지
        if (!clothing && !item) {
            return `/images/characters/${characterType}/body.png`;
        }

        // 의상만 착용
        if (clothing && !item) {
            return `/images/characters/${characterType}/${clothing.image_key}.png`;
        }

        // 아이템만 착용
        if (!clothing && item) {
            return `/images/characters/${characterType}/${item.image_key}.png`;
        }

        // 둘 다 착용
        return `/images/characters/${characterType}/${clothing.image_key}_${item.image_key}.png`;
    };

    // 배경 이미지 경로
    const getBackgroundPath = () => {
        if (equippedItems.background) {
            return equippedItems.background.image || equippedItems.background.image_url;
        }
        return '/images/room_background.png'; // 기본 배경
    };

    if (isLoading) {
        return (
            <div style={styles.container}>
                <div style={styles.loading}>로딩 중...</div>
            </div>
        );
    }

    return (
        <div style={styles.container}>
            {/* 배경 이미지 - CSS background */}
            <div style={{
                ...styles.backgroundContainer,
                backgroundImage: `url("${getBackgroundPath()}")`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
            }} />

            {/* 상단 네비게이션 */}
            <div style={styles.header}>
                <button onClick={() => router.push('/challenge')} style={styles.iconButton}>
                    <ChevronLeft color="#333" size={20} />
                </button>
                <button onClick={() => router.push('/game')} style={styles.iconButton}>
                    <Gamepad2 color="#333" size={20} />
                </button>
                <div style={styles.headerIcons}>
                    <button onClick={() => router.push('/closet')} style={styles.iconButton}>
                        <Shirt color="#333" size={20} />
                    </button>
                    <button onClick={() => router.push('/shop')} style={styles.iconButton}>
                        <Store color="#333" size={20} />
                    </button>
                </div>
            </div>

            {/* 코인 비 */}
            <CoinRain characterRef={characterRef} onPointEarned={refreshUser} />

            {/* 캐릭터 + 말풍선 */}
            <div
                ref={characterRef}
                style={styles.characterContainer}
                onClick={handleCharacterClick}
            >
                {/* 말풍선 */}
                {characterSpeech && (
                    <div style={{
                        position: 'absolute',
                        bottom: '100%',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        marginBottom: '20px',
                        backgroundColor: '#fdf6e3',
                        padding: '20px 22px 14px 22px',
                        borderRadius: '20px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                        fontSize: '0.85rem',
                        fontWeight: '500',
                        color: '#5c4a3a',
                        whiteSpace: 'nowrap',
                        zIndex: 30,
                        opacity: speechVisible ? 1 : 0,
                        transition: 'opacity 0.4s ease',
                        pointerEvents: 'none',
                    }}>
                        <div style={{
                            position: 'absolute',
                            top: '-20px',
                            left: '4px',
                            backgroundColor: '#7a3e48',
                            color: 'white',
                            padding: '4px 12px',
                            borderRadius: '10px',
                            fontSize: '0.75rem',
                            fontWeight: 'bold',
                            whiteSpace: 'nowrap',
                        }}>
                            {user?.character_name || '두둑이'}
                        </div>
                        {characterSpeech}

                    </div>
                )}
                <Image
                    src={getCharacterImagePath()}
                    alt="Character"
                    width={290}
                    height={290}
                    style={{ objectFit: 'contain' }}
                    priority
                />
            </div>

        </div>
    );
}

const styles = {
    container: {
        position: 'fixed',
        top: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: '430px',
        height: '100vh',
        overflow: 'hidden',
        zIndex: 50,
    },
    backgroundContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 0,
        backgroundColor: '#e6e0d4', // 배경 미선택 시 베이지색
    },
    header: {
        position: 'absolute',
        top: '16px',
        left: '16px',
        zIndex: 10,
        display: 'flex',
        gap: '8px',
    },
    headerIcons: {
        display: 'flex',
        gap: '8px',
    },
    iconButton: {
        background: 'transparent',
        border: 'none',
        padding: '8px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        filter: 'drop-shadow(0 0 2px white) drop-shadow(0 0 2px white)',
    },
    characterContainer: {
        position: 'absolute',
        bottom: '120px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 5,
    },

    loading: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        fontSize: '1rem',
        color: '#666',
    },
};

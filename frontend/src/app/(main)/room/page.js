"use client";

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Shirt, Store, DoorClosed, Gamepad2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getEquippedItems } from '@/lib/api/shop';

export default function RoomPage() {
    const router = useRouter();
    const { user } = useAuth();
    const [characterType, setCharacterType] = useState('char_dog');
    const [equippedItems, setEquippedItems] = useState({
        clothing: null,
        item: null,
        background: null
    });
    const [isLoading, setIsLoading] = useState(true);

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

            {/* 캐릭터 */}
            <div style={styles.characterContainer}>
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

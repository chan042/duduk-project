"use client";

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getEquippedItems } from '@/lib/api/shop';
import CoinRain from '@/components/room/CoinRain';

const LOCALSTORAGE_KEY = 'room_last_visit_date';

function getTodayString() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

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

    // ── 문 환영 화면 상태 ──
    const [doorOpened, setDoorOpened] = useState(false); // 초기값 false: 첫 렌더부터 문 화면 표시
    const [isFirstVisitToday, setIsFirstVisitToday] = useState(false);
    const [showCoinRain, setShowCoinRain] = useState(false);

    // 전환 후 말풍선 상태
    const [transitionSpeech, setTransitionSpeech] = useState(null);
    const [transitionSpeechVisible, setTransitionSpeechVisible] = useState(false);
    const transitionTimerRef = useRef(null);

    // 하루 1회 방문 체크 (테스트를 위해 항상 문 화면 표시)
    useEffect(() => {
        // TODO: 테스트 완료 후 아래 주석 해제
        // const today = getTodayString();
        // const lastVisit = localStorage.getItem(LOCALSTORAGE_KEY);
        // if (lastVisit !== today) {
        //     setIsFirstVisitToday(true);
        //     setDoorOpened(false);
        //     setShowCoinRain(false);
        // } else {
        //     setIsFirstVisitToday(false);
        //     setDoorOpened(true);
        //     setShowCoinRain(false);
        // }

        // 테스트: 항상 문 화면 표시
        setIsFirstVisitToday(true);
        setDoorOpened(false);
        setShowCoinRain(false);
    }, []);

    // 문 클릭 핸들러
    const handleDoorClick = () => {
        const today = getTodayString();
        localStorage.setItem(LOCALSTORAGE_KEY, today);
        setDoorOpened(true);

        // 전환 말풍선 표시
        const userName = user?.username || '사용자';
        setTransitionSpeech(`${userName}님을 보니 너무 좋아요! 코인 선물을 드릴게요. 오늘도 두둑한 하루를 보내볼까요?`);
        setTransitionSpeechVisible(true);

        // 코인비 시작
        setShowCoinRain(true);

        // 3초 후 전환 말풍선 사라짐
        if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
        transitionTimerRef.current = setTimeout(() => {
            setTransitionSpeechVisible(false);
        }, 3000);
    };

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

    // ── 문 화면 (첫 방문, 문 열기 전) ──
    if (!doorOpened) {
        const charName = user?.character_name || '두둑이';
        return (
            <div style={styles.container}>
                <style>{`
                    @keyframes doorFloat {
                        0%, 100% { transform: translate(-50%, -50%) translateY(0px); }
                        50% { transform: translate(-50%, -50%) translateY(-15px); }
                    }
                    @keyframes doorGlow {
                        0%, 100% { 
                            filter: drop-shadow(0 0 15px rgba(255, 223, 130, 0.5)) drop-shadow(0 0 30px rgba(255, 223, 130, 0.3));
                        }
                        50% { 
                            filter: drop-shadow(0 0 25px rgba(255, 223, 130, 0.8)) drop-shadow(0 0 50px rgba(255, 223, 130, 0.5));
                        }
                    }
                    @keyframes fadeInUp {
                        from { opacity: 0; transform: translateY(10px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                `}</style>

                {/* 배경 */}
                <div style={styles.doorBackground} />

                {/* 좌상단 뒤로가기 */}
                <div style={styles.header}>
                    <button onClick={() => router.push('/challenge')} style={styles.iconButton}>
                        <ChevronLeft color="#333" size={26} />
                    </button>
                </div>

                {/* 문 이미지 (플로팅) */}
                <div
                    style={styles.doorImageContainer}
                    onClick={handleDoorClick}
                >
                    <Image
                        src="/images/door.png"
                        alt="Door"
                        width={300}
                        height={380}
                        style={{
                            objectFit: 'contain',
                            cursor: 'pointer',
                            position: 'relative',
                            zIndex: 2,
                        }}
                        priority
                    />
                </div>

                {/* 말풍선 (문 화면) */}
                <div style={styles.doorSpeechBubble}>
                    <div style={styles.doorSpeechNameTag}>
                        {charName}
                    </div>
                    오늘도 와주셨군요! {charName}가 기다리고 있어요. 방문을 열어 환영해주세요!
                </div>
            </div>
        );
    }

    // ── 일반 방 화면 ──
    return (
        <div style={styles.container}>
            {/* 배경 이미지 - CSS background */}
            <div style={{
                ...styles.backgroundContainer,
                backgroundImage: `url("${getBackgroundPath()}")`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
            }} />

            {/* 상단 뒤로가기 */}
            <div style={styles.header}>
                <button onClick={() => router.push('/challenge')} style={styles.iconButton}>
                    <ChevronLeft color="#333" size={26} />
                </button>
            </div>

            {/* 우측 세로 아이콘 메뉴 */}
            <div style={styles.sideMenu}>
                <button onClick={() => router.push('/game')} style={styles.iconButton}>
                    <Image src="/images/icon/game_icon.png" alt="게임" width={48} height={48} style={{ objectFit: 'contain' }} />
                </button>
                <button onClick={() => router.push('/closet')} style={styles.iconButton}>
                    <Image src="/images/icon/closet_icon.png" alt="옷장" width={48} height={48} style={{ objectFit: 'contain' }} />
                </button>
                <button onClick={() => router.push('/shop')} style={styles.iconButton}>
                    <Image src="/images/icon/shop_icon.png" alt="상점" width={48} height={48} style={{ objectFit: 'contain' }} />
                </button>
            </div>

            {/* 코인 비 – 문 클릭 후 첫 방문일 때만 */}
            {showCoinRain && (
                <CoinRain characterRef={characterRef} onPointEarned={refreshUser} />
            )}

            {/* 캐릭터 */}
            <div
                ref={characterRef}
                style={styles.characterContainer}
                onClick={handleCharacterClick}
            >
                <Image
                    src={getCharacterImagePath()}
                    alt="Character"
                    width={290}
                    height={290}
                    style={{ objectFit: 'contain' }}
                    priority
                />
            </div>

            {/* 전환 말풍선 (문 클릭 직후) – 화면 기준 하단 고정 */}
            {transitionSpeech && (
                <div style={{
                    position: 'absolute',
                    bottom: '30px',
                    left: '20px',
                    right: '20px',
                    backgroundColor: '#fdf6e3',
                    padding: '24px 20px 16px 20px',
                    borderRadius: '20px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                    fontSize: '1rem',
                    fontWeight: '500',
                    color: '#5c4a3a',
                    whiteSpace: 'normal',
                    wordBreak: 'keep-all',
                    zIndex: 30,
                    opacity: transitionSpeechVisible ? 1 : 0,
                    transition: 'opacity 0.4s ease',
                    pointerEvents: 'none',
                }}>
                    <div style={{
                        position: 'absolute',
                        top: '-12px',
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
                    {transitionSpeech}
                </div>
            )}

            {/* 캐릭터 클릭 말풍선 – 화면 기준 하단 고정 */}
            {characterSpeech && !transitionSpeechVisible && (
                <div style={{
                    position: 'absolute',
                    bottom: '30px',
                    left: '20px',
                    right: '20px',
                    backgroundColor: '#fdf6e3',
                    padding: '24px 20px 16px 20px',
                    borderRadius: '20px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                    fontSize: '1rem',
                    fontWeight: '500',
                    color: '#5c4a3a',
                    whiteSpace: 'normal',
                    wordBreak: 'keep-all',
                    zIndex: 30,
                    opacity: speechVisible ? 1 : 0,
                    transition: 'opacity 0.4s ease',
                    pointerEvents: 'none',
                }}>
                    <div style={{
                        position: 'absolute',
                        top: '-12px',
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
    sideMenu: {
        position: 'absolute',
        right: '16px',
        top: '16px',
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
    },
    iconButton: {
        background: 'transparent',
        border: 'none',
        padding: '8px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
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

    // ── 문 화면 스타일 ──
    doorBackground: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 0,
        background: 'linear-gradient(180deg, #f5efe6 0%, #e6e0d4 50%, #d4cfc4 100%)',
    },
    doorImageContainer: {
        position: 'absolute',
        top: '42%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 5,
        cursor: 'pointer',
        animation: 'doorFloat 3s ease-in-out infinite',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },

    doorSpeechBubble: {
        position: 'absolute',
        bottom: '12%',
        left: '20px',
        right: '20px',
        backgroundColor: '#fdf6e3',
        padding: '24px 20px 16px 20px',
        borderRadius: '20px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
        fontSize: '1rem',
        fontWeight: '500',
        color: '#5c4a3a',
        whiteSpace: 'normal',
        wordBreak: 'keep-all',
        zIndex: 30,
        animation: 'fadeInUp 0.6s ease',
    },
    doorSpeechNameTag: {
        position: 'absolute',
        top: '-12px',
        left: '4px',
        backgroundColor: '#7a3e48',
        color: 'white',
        padding: '4px 12px',
        borderRadius: '10px',
        fontSize: '0.75rem',
        fontWeight: 'bold',
        whiteSpace: 'nowrap',
    },
};

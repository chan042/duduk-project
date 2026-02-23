"use client";

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { DoorClosed } from 'lucide-react';
import { getProfile } from '@/lib/api/auth';
import { submitGameReward } from '@/lib/api/game';

const GAME_STATES = {
    START: 'START',
    PLAYING: 'PLAYING',
    DYING: 'DYING',
    GAME_OVER: 'GAME_OVER'
};

export default function FlappyGame({ onClose }) {
    const canvasRef = useRef(null);
    const [gameState, setGameState] = useState(GAME_STATES.START);
    const [lives, setLives] = useState(3);
    const [score, setScore] = useState(0);
    const [characterType, setCharacterType] = useState('char_dog');
    const [earnedPoints, setEarnedPoints] = useState(null);
    const rewardSubmittedRef = useRef(false);
    const gameLoopRef = useRef(null);
    const audioRef = useRef(null);
    const gameDataRef = useRef({
        bird: {
            x: 100,
            y: 200,
            velocity: 0,
            width: 120,
            height: 120
        },
        obstacles: [],
        lastObstacleTime: 0,
        startTime: null,
        isInvincible: false,
        invincibleUntil: 0,
        isGrayscale: false,
        currentSpeed: 3,
        lastHitTime: 0,
        bgScrollX: 0
    });

    // 게임 상수
    const GRAVITY = 0.29;
    const JUMP_VELOCITY = -7;
    const OBSTACLE_WIDTH = 240;
    const FIRST_SPEED = 3;
    const OBSTACLE_GAP = 240;
    const OBSTACLE_INTERVAL = 2400;
    const HITBOX_MARGIN = 100;

    // 사용자 프로필에서 캐릭터 타입 조회
    useEffect(() => {
        const fetchCharacterType = async () => {
            try {
                const profile = await getProfile();
                if (profile.character_type) {
                    setCharacterType(profile.character_type);
                }
            } catch (error) {
                console.error('프로필 조회 실패:', error);
                // 실패 시 기본 캐릭터(char_dog) 유지
            }
        };
        fetchCharacterType();
    }, []);

    // 배경음악 초기화
    useEffect(() => {
        // Audio 객체 생성 (브라우저 환경에서만)
        if (typeof window !== 'undefined') {
            audioRef.current = new Audio('/sounds/game_sound.mp3');
            audioRef.current.loop = true; // 반복 재생
            audioRef.current.volume = 0.5; // 볼륨 50%
        }

        return () => {
            // 컴포넌트 언마운트 시 음악 정지
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
            }
        };
    }, []);

    // 캐릭터 타입에 따라 이미지 로드
    useEffect(() => {
        const images = {
            startBg: new window.Image(),
            startButton: new window.Image(),
            gameBg: new window.Image(),
            bird: new window.Image(),
            obstacle: new window.Image()
        };

        images.startBg.src = '/images/start_game.png';
        images.startButton.src = '/images/text_game_start.png';
        images.gameBg.src = '/images/game_background.png';
        images.bird.src = `/images/characters/${characterType}/fly.png`;
        images.obstacle.src = '/images/obstacle.png';

        gameDataRef.current.images = images;
    }, [characterType]);

    const startGame = () => {
        setGameState(GAME_STATES.PLAYING);
        setLives(3);
        setScore(0);
        setEarnedPoints(null);
        rewardSubmittedRef.current = false;
        gameDataRef.current = {
            ...gameDataRef.current,
            bird: {
                x: 100,
                y: 200,
                velocity: 0,
                width: 110,
                height: 110
            },
            obstacles: [],
            lastObstacleTime: Date.now(),
            startTime: Date.now(),
            isInvincible: false,
            invincibleUntil: 0,
            isGrayscale: false,
            currentSpeed: FIRST_SPEED,
            bgScrollX: 0,
            lastHitTime: 0
        };

        // 게임 시작 시 음악 재생
        if (audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(e => console.log('Audio play failed:', e));
        }
    };

    const jump = () => {
        if (gameState === GAME_STATES.PLAYING) {
            gameDataRef.current.bird.velocity = JUMP_VELOCITY;
        }
    };

    useEffect(() => {
        const handleInteraction = (e) => {
            if (gameState === GAME_STATES.PLAYING) {
                jump();
            }
        };

        const canvas = canvasRef.current;
        if (canvas) {
            canvas.addEventListener('click', handleInteraction);
            canvas.addEventListener('touchstart', handleInteraction);

            return () => {
                canvas.removeEventListener('click', handleInteraction);
                canvas.removeEventListener('touchstart', handleInteraction);
            };
        }
    }, [gameState]);

    useEffect(() => {
        if (gameState === GAME_STATES.START) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const { images } = gameDataRef.current;

        const gameLoop = () => {
            const data = gameDataRef.current;
            const currentTime = Date.now();

            // 1. 상태 업데이트 (PLAYING일 때만)
            if (gameState === GAME_STATES.PLAYING) {
                // 점수 업데이트 (생존 시간)
                const secondsSurvived = Math.floor((currentTime - data.startTime) / 1000);
                setScore(secondsSurvived);

                // 난이도 상승 로직: 15초마다 속도 1.0씩 증가
                if (secondsSurvived > 0) {
                    const speedIncrease = Math.floor(secondsSurvived / 15) * 1.0;
                    data.currentSpeed = FIRST_SPEED + speedIncrease;
                }

                // 배경 스크롤 업데이트
                data.bgScrollX += data.currentSpeed * 0.5;

                // 새 위치 업데이트
                data.bird.velocity += GRAVITY;
                data.bird.y += data.bird.velocity;

                if (data.bird.y > canvas.height - data.bird.height) {
                    data.bird.y = canvas.height - data.bird.height;
                    data.bird.velocity = 0;
                }
                if (data.bird.y < 0) {
                    data.bird.y = 0;
                    data.bird.velocity = 0;
                }


                if (currentTime - data.lastObstacleTime > OBSTACLE_INTERVAL) {
                    const gapY = Math.random() * (canvas.height - OBSTACLE_GAP - 100) + 50;
                    data.obstacles.push({
                        x: canvas.width,
                        gapY: gapY,
                        passed: false
                    });
                    data.lastObstacleTime = currentTime;
                }

                // 장애물 이동 (현재 속도 적용)
                data.obstacles = data.obstacles.filter(obstacle => {
                    obstacle.x -= data.currentSpeed;
                    return obstacle.x > -OBSTACLE_WIDTH;
                });

                // 무적 상태 해제
                if (data.isInvincible && currentTime > data.invincibleUntil) {
                    data.isInvincible = false;
                }

                // 충돌 감지
                if (!data.isInvincible) {
                    for (let obstacle of data.obstacles) {
                        const birdLeft = data.bird.x + HITBOX_MARGIN;
                        const birdRight = data.bird.x + data.bird.width - HITBOX_MARGIN;
                        const birdTop = data.bird.y + HITBOX_MARGIN;
                        const birdBottom = data.bird.y + data.bird.height - HITBOX_MARGIN;

                        const obstacleLeft = obstacle.x;
                        const obstacleRight = obstacle.x + OBSTACLE_WIDTH;

                        if (birdRight > obstacleLeft && birdLeft < obstacleRight) {
                            const gapTop = obstacle.gapY;
                            const gapBottom = obstacle.gapY + OBSTACLE_GAP;

                            if (birdTop < gapTop || birdBottom > gapBottom) {
                                setLives(prev => {
                                    const newLives = prev - 1;
                                    if (newLives <= 0) {
                                        setGameState(GAME_STATES.DYING);
                                        // 게임 오버 시 음악 정지
                                        if (audioRef.current) {
                                            audioRef.current.pause();
                                            audioRef.current.currentTime = 0;
                                        }

                                        // 포인트 적립 API 호출
                                        if (!rewardSubmittedRef.current) {
                                            rewardSubmittedRef.current = true;
                                            const finalScore = Math.floor((currentTime - data.startTime) / 1000);
                                            submitGameReward(finalScore)
                                                .then(result => {
                                                    setEarnedPoints(result.earned_points);
                                                })
                                                .catch(err => {
                                                    console.error('포인트 적립 실패:', err);
                                                    setEarnedPoints(0);
                                                });
                                        }
                                        setTimeout(() => {
                                            setGameState(GAME_STATES.GAME_OVER);
                                        }, 2000);
                                    }
                                    return newLives;
                                });

                                data.isInvincible = true;
                                data.invincibleUntil = currentTime + 1000;
                                data.lastHitTime = currentTime;
                                break;
                            }
                        }
                    }
                }
            }

            // 2. 그리기 (모든 상태)
            // DYING, GAME_OVER는 흑백, PLAYING은 컬러
            const isGrayscale = (gameState === GAME_STATES.DYING || gameState === GAME_STATES.GAME_OVER);
            drawFrame(ctx, canvas, data, images, currentTime, isGrayscale);

            gameLoopRef.current = requestAnimationFrame(gameLoop);
        };

        gameLoopRef.current = requestAnimationFrame(gameLoop);

        return () => {
            if (gameLoopRef.current) {
                cancelAnimationFrame(gameLoopRef.current);
            }
        };
    }, [gameState]);

    const drawFrame = (ctx, canvas, data, images, currentTime, grayscale) => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 흑백 필터 적용
        if (grayscale) {
            ctx.filter = 'grayscale(100%)';
        } else {
            ctx.filter = 'none';
        }

        // 배경 그리기 (스크롤 루프)
        if (images.gameBg.complete && images.gameBg.naturalWidth > 0) {
            const imgNatW = images.gameBg.naturalWidth;
            const imgNatH = images.gameBg.naturalHeight;

            // 캔버스 높이에 맞춰 비율 계산
            const scale = canvas.height / imgNatH;
            const drawWidth = imgNatW * scale;

            // 스크롤 오프셋을 이미지 폭으로 나눈 나머지
            const offsetX = data.bgScrollX % drawWidth;

            // 배경을 여러 장 이어 그려서 루프 효과
            for (let x = -offsetX; x < canvas.width; x += drawWidth) {
                ctx.drawImage(images.gameBg, x, 0, drawWidth, canvas.height);
            }
        }

        // 장애물 그리기 (비율 유지하며 자르기)
        if (images.obstacle.complete) {
            const imgW = images.obstacle.width;
            const extraExtend = 50;

            for (let obstacle of data.obstacles) {
                // 위쪽 장애물
                const topHeight = obstacle.gapY + extraExtend;
                // 원본 이미지에서 가져올 높이 계산 (비율 유지)
                const srcH_Top = imgW * (topHeight / OBSTACLE_WIDTH);

                ctx.save();
                ctx.translate(obstacle.x, obstacle.gapY);
                ctx.scale(1, -1);
                ctx.drawImage(images.obstacle, 0, 0, imgW, srcH_Top, 0, 0, OBSTACLE_WIDTH, topHeight);
                ctx.restore();

                // 아래쪽 장애물
                const bottomY = obstacle.gapY + OBSTACLE_GAP;
                const bottomHeight = canvas.height - bottomY + extraExtend;
                // 원본 이미지에서 가져올 높이 계산
                const srcH_Bottom = imgW * (bottomHeight / OBSTACLE_WIDTH);

                ctx.drawImage(images.obstacle, 0, 0, imgW, srcH_Bottom,
                    obstacle.x, bottomY, OBSTACLE_WIDTH, bottomHeight);
            }
        }

        if (images.bird.complete) {
            ctx.save();
            const timeSinceHit = currentTime - data.lastHitTime;
            if (timeSinceHit < 1000) {
                const alpha = 1 - (timeSinceHit / 1000);
                ctx.shadowColor = `rgba(255, 0, 0, ${alpha * 0.8})`;
                ctx.shadowBlur = 50;
            }
            ctx.drawImage(images.bird, data.bird.x, data.bird.y, data.bird.width, data.bird.height);
            ctx.restore();
        }

        ctx.filter = 'none';
    };

    return (
        <div style={styles.overlay}>
            <div style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 1, height: 1, overflow: 'hidden' }}>
                <Image src="/images/text_game_over.png" width={380} height={200} alt="preload" priority />
            </div>

            <style jsx>{`
                @keyframes sparkle {
                    0%, 100% { opacity: 0; transform: scale(0.5); }
                    50% { opacity: 1; transform: scale(1); }
                }
                .sparkle {
                    animation: sparkle 1.5s ease-in-out infinite;
                }
                @keyframes float {
                    0%, 100% { transform: translateY(0px); }
                    50% { transform: translateY(-10px); }
                }
                .float-animation {
                    animation: float 2s ease-in-out infinite;
                }
                @keyframes glow {
                    0%, 100% { filter: drop-shadow(0 0 5px rgba(255, 215, 0, 0.6)); }
                    50% { filter: drop-shadow(0 0 20px rgba(255, 215, 0, 0.9)); }
                }
                .glow-animation {
                    animation: glow 2s ease-in-out infinite;
                }
            `}</style>



            <div style={styles.gameContainer}>
                {gameState !== GAME_STATES.START && (
                    <>
                        <div style={styles.livesContainer}>
                            <div style={styles.livesBg}>
                                {[...Array(3)].map((_, i) => (
                                    <span key={i} style={{
                                        ...styles.heart,
                                        opacity: i < lives ? 1 : 0.25,
                                        filter: (gameState === GAME_STATES.DYING || gameState === GAME_STATES.GAME_OVER) ? 'grayscale(100%)' : 'none',
                                    }}>❤️</span>
                                ))}
                            </div>
                        </div>
                        <div style={{
                            ...styles.timerContainer,
                            filter: (gameState === GAME_STATES.DYING || gameState === GAME_STATES.GAME_OVER) ? 'grayscale(100%)' : 'none',
                        }}>
                            <span style={styles.timerText}>{score}초</span>
                        </div>
                    </>
                )}

                {gameState === GAME_STATES.START && (
                    <div style={styles.startScreen}>
                        <Image
                            src="/images/start_game.png"
                            alt="Start Background"
                            fill
                            style={{ objectFit: 'cover' }}
                            priority
                        />
                        {/* 좌상단 방으로 돌아가기 아이콘 */}
                        <button onClick={onClose} style={styles.roomIconButton}>
                            <DoorClosed color="#333" size={26} />
                        </button>
                        <div style={styles.startContent}>
                            <div
                                style={styles.startButtonWrapper}
                                onClick={startGame}
                                className="float-animation"
                            >
                                <div style={{ ...styles.sparkleStar, top: '-5px', left: '10%', animationDelay: '0s' }} className="sparkle">✨</div>
                                <div style={{ ...styles.sparkleStar, top: '80%', left: '5%', animationDelay: '1s' }} className="sparkle">✨</div>
                                <div style={{ ...styles.sparkleStar, top: '-10%', right: '15%', animationDelay: '0.5s' }} className="sparkle">✨</div>
                                <div style={{ ...styles.sparkleStar, top: '90%', right: '10%', animationDelay: '0.75s' }} className="sparkle">✨</div>

                                <div className="glow-animation">
                                    <Image
                                        src="/images/text_game_start.png"
                                        alt="Start Button"
                                        width={360}
                                        height={120}
                                        style={{ cursor: 'pointer', objectFit: 'contain' }}
                                        priority
                                    />
                                </div>
                            </div>
                            <div style={styles.descriptionContainer}>
                                <div style={styles.descriptionItem}>
                                    <div style={styles.descriptionRow}>
                                        <span style={{ fontSize: '18px' }}>⭐</span>
                                        <span style={styles.descriptionText}>장애물을 피해 달려보세요!</span>
                                    </div>
                                    <div style={styles.descriptionRow}>
                                        <span style={{ fontSize: '18px' }}>✨</span>
                                        <span style={styles.descriptionText}>버틴 시간만큼 포인트를 얻을 수 있어요</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {gameState !== GAME_STATES.START && (
                    <canvas
                        ref={canvasRef}
                        width={430}
                        height={932}
                        style={styles.canvas}
                    />
                )}

                {gameState === GAME_STATES.GAME_OVER && (
                    <div style={styles.gameOverPopup}>
                        <div style={styles.gameOverContainer}>
                            <div style={styles.cloudBg}>
                                {earnedPoints !== null && (
                                    <div style={styles.earnedPointsBadge}>
                                        🎉 +{earnedPoints}P 획득!
                                    </div>
                                )}
                                <Image
                                    src="/images/text_game_over.png"
                                    alt="Game Over Cloud"
                                    width={380}
                                    height={200}
                                    style={{ objectFit: 'contain' }}
                                    priority
                                />

                                <div style={styles.gameOverContent}>
                                    <div style={styles.buttonContainer}>
                                        <button onClick={startGame} style={styles.retryButton}>
                                            한번 더
                                        </button>
                                        <button onClick={onClose} style={styles.exitButton}>
                                            나가기
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

const styles = {
    overlay: {
        position: 'fixed',
        top: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: '430px',
        height: '100vh',
        backgroundColor: '#fff',
        zIndex: 1000,
    },
    gameContainer: {
        position: 'relative',
        width: '100%',
        height: '100%',
        backgroundColor: '#fff',
        overflow: 'hidden',
    },
    startScreen: {
        position: 'relative',
        width: '100%',
        height: '100%',
        cursor: 'pointer',
    },
    roomIconButton: {
        position: 'absolute',
        top: '16px',
        left: '16px',
        zIndex: 50,
        background: 'transparent',
        border: 'none',
        padding: '8px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        filter: 'drop-shadow(0 0 2px white) drop-shadow(0 0 2px white)',
    },
    startContent: {
        position: 'absolute',
        top: '45%', // 55% -> 45% (살짝 위로 올림)
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '15px', // 5px -> 15px (이미지와 문구 거리 조금 벌림)
        width: '100%',
    },
    startButtonWrapper: {
        position: 'relative',
        cursor: 'pointer',
        marginBottom: '0px',
    },
    sparkleStar: {
        position: 'absolute',
        fontSize: '18px',
        pointerEvents: 'none',
        zIndex: 20,
    },
    descriptionContainer: {
        display: 'flex',
        flexDirection: 'column',
        gap: '6px', // 12px -> 6px (문구 사이 거리 좁힘)
        alignItems: 'center',
        width: '100%',
        marginTop: '0px', // -10px -> 0px (원복)
    },
    descriptionItem: {
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        padding: '12px 24px',
        borderRadius: '20px',
        backdropFilter: 'blur(4px)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
        border: '3px solid #FFD700',
    },
    descriptionRow: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    },
    descriptionText: {
        fontSize: '15px',
        color: '#555',
        fontWeight: '700',
        margin: 0,
        letterSpacing: '-0.5px',
    },
    canvas: {
        display: 'block',
        width: '100%',
        height: '100%',
    },
    livesContainer: {
        position: 'absolute',
        top: '16px',
        left: '16px',
        zIndex: 100,
    },
    livesBg: {
        display: 'flex',
        gap: '4px',
        backgroundColor: 'rgba(255, 255, 255, 0.7)',
        padding: '6px 12px',
        borderRadius: '20px',
        backdropFilter: 'blur(4px)',
    },
    heart: {
        fontSize: '22px',
        transition: 'opacity 0.3s',
    },
    timerContainer: {
        position: 'absolute',
        top: '16px',
        right: '16px',
        zIndex: 100,
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        padding: '6px 16px',
        borderRadius: '20px',
        backdropFilter: 'blur(4px)',
    },
    timerText: {
        fontSize: '20px',
        fontWeight: '700',
        color: '#fff',
        letterSpacing: '1px',
    },
    gameOverPopup: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
    },
    gameOverContainer: {
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
    },
    cloudBg: {
        position: 'relative',
        display: 'flex',
        justifyContent: 'center',
    },
    gameOverContent: {
        position: 'absolute',
        bottom: '22%',
        left: 0,
        right: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '10px',
    },
    buttonContainer: {
        display: 'flex',
        gap: '14px',
        justifyContent: 'center',
        marginTop: '10px',
    },
    retryButton: {
        padding: '10px 28px',
        fontSize: '16px',
        fontWeight: '800',
        backgroundColor: '#FFB6C1',
        color: '#fff',
        border: '3px solid #fff',
        borderRadius: '30px',
        cursor: 'pointer',
        boxShadow: '0 4px 6px rgba(255, 182, 193, 0.4)',
        textShadow: '1px 1px 2px rgba(0,0,0,0.1)',
        fontFamily: 'inherit',
    },
    exitButton: {
        padding: '10px 28px',
        fontSize: '16px',
        fontWeight: '800',
        backgroundColor: '#FFD700',
        color: '#fff',
        border: '3px solid #fff',
        borderRadius: '30px',
        cursor: 'pointer',
        boxShadow: '0 4px 6px rgba(255, 215, 0, 0.4)',
        textShadow: '1px 1px 2px rgba(0,0,0,0.1)',
        fontFamily: 'inherit',
    },
    earnedPointsBadge: {
        position: 'absolute',
        top: '-50px',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: 'rgba(255, 215, 0, 0.9)',
        color: '#fff',
        padding: '8px 24px',
        borderRadius: '30px',
        fontSize: '18px',
        fontWeight: '800',
        textShadow: '1px 1px 2px rgba(0,0,0,0.15)',
        boxShadow: '0 4px 12px rgba(255, 215, 0, 0.4)',
        border: '2px solid #fff',
        zIndex: 10,
    },
};
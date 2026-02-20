"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { submitGameReward } from '@/lib/api/game';

/**
 * CoinRain 컴포넌트
 * - requestAnimationFrame으로 위치를 직접 업데이트하여 클릭이 정확하게 작동
 * - 5개의 코인이 랜덤 위치에서 천천히 떨어짐
 * - 캐릭터 이미지 하단에서 사라짐
 * - 코인 클릭 시 1포인트 적립
 */
export default function CoinRain({ characterRef, onPointEarned }) {
    const [coins, setCoins] = useState([]);
    const coinRefs = useRef({});
    const coinData = useRef([]);
    const animFrameId = useRef(null);
    const isRunning = useRef(true);

    // 코인 초기화
    useEffect(() => {
        isRunning.current = true;

        // 5구간에 골고루 하나씩 배치
        const initialCoins = Array.from({ length: 5 }, (_, i) => {
            const zoneStart = i * 16 + 5;
            const zoneWidth = 14;
            return {
                id: `coin-${Date.now()}-${i}`,
                left: zoneStart + Math.random() * zoneWidth,
                speed: Math.random() * 0.6 + 1.4,  // 1.4~2.0 px/frame
                startDelay: i * 1500 + Math.random() * 1000, // 각 코인마다 최대 2.5초 차이
                startTime: null,
                currentY: -60,
                size: Math.random() * 8 + 34, // 34~42px
                emoji: '🪙',
                clicked: false,
                opacity: 1,
            };
        });

        coinData.current = initialCoins;
        setCoins(initialCoins.map(c => ({ id: c.id, left: c.left, size: c.size, emoji: c.emoji })));

        return () => {
            isRunning.current = false;
            if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // requestAnimationFrame 루프 - 직접 DOM 조작으로 클릭 가능
    useEffect(() => {
        if (coins.length === 0) return;

        const getVanishY = () => {
            if (!characterRef?.current) return window.innerHeight * 0.8;
            const rect = characterRef.current.getBoundingClientRect();
            // 캐릭터 이미지 하단 부분 (bottom 근처 10px 위)
            return rect.bottom - 10;
        };

        let startTimestamp = null;

        const animate = (timestamp) => {
            if (!isRunning.current) return;
            if (!startTimestamp) startTimestamp = timestamp;
            const elapsed = timestamp - startTimestamp;

            const vanishY = getVanishY();
            let allDone = true;

            coinData.current.forEach((coin) => {
                if (coin.clicked) return;

                const el = coinRefs.current[coin.id];
                if (!el) return;

                // 딜레이 전이면 대기
                if (elapsed < coin.startDelay) {
                    allDone = false;
                    return;
                }

                // 떨어지는 처리
                coin.currentY += coin.speed;

                // 사라지는 지점에 다가오면 페이드 아웃
                const fadeStart = vanishY - 60;
                if (coin.currentY > fadeStart) {
                    coin.opacity = Math.max(0, 1 - (coin.currentY - fadeStart) / 60);
                }

                if (coin.currentY < vanishY) {
                    allDone = false;
                }

                // DOM 직접 업데이트
                el.style.top = `${coin.currentY}px`;
                el.style.opacity = `${coin.opacity}`;

                // 사라지는 지점 도달
                if (coin.currentY >= vanishY) {
                    el.style.display = 'none';
                }
            });

            if (!allDone) {
                animFrameId.current = requestAnimationFrame(animate);
            }
        };

        animFrameId.current = requestAnimationFrame(animate);

        return () => {
            if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
        };
    }, [coins, characterRef]);

    // 코인 클릭
    const handleCoinClick = useCallback(async (coinId) => {
        const coin = coinData.current.find(c => c.id === coinId);
        if (!coin || coin.clicked) return;

        coin.clicked = true;

        // 클릭 이펙트
        const el = coinRefs.current[coinId];
        if (el) {
            el.style.transition = 'transform 0.25s ease, opacity 0.3s ease';
            el.style.transform = 'scale(1.8)';
            el.style.opacity = '0';
            el.style.pointerEvents = 'none';
        }

        try {
            await submitGameReward(1);
            if (onPointEarned) onPointEarned();
        } catch (error) {
            console.error('코인 포인트 적립 실패:', error);
        }
    }, [onPointEarned]);

    if (coins.length === 0) return null;

    return (
        <>
            <style>{`
                .coin-rain-wrapper {
                    position: absolute;
                    top: 0; left: 0; right: 0; bottom: 0;
                    pointer-events: none;
                    overflow: hidden;
                    z-index: 15;
                }

                .coin-item {
                    position: absolute;
                    pointer-events: auto;
                    cursor: pointer;
                    user-select: none;
                    -webkit-tap-highlight-color: transparent;
                    transform-origin: center;
                    transition: transform 0.1s ease;
                    top: -60px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    z-index: 20;
                }

                .coin-body {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    filter: drop-shadow(0 2px 6px rgba(255, 200, 0, 0.7));
                    animation: coinWobble 1.6s ease-in-out infinite;
                }

                .coin-item:active .coin-body {
                    transform: scale(1.3);
                }

                @keyframes coinWobble {
                    0%, 100% { transform: rotate(-8deg) scale(1); }
                    50% { transform: rotate(8deg) scale(1.08); }
                }


            `}</style>

            <div className="coin-rain-wrapper">
                {coins.map((coin) => (
                    <div
                        key={coin.id}
                        ref={el => { coinRefs.current[coin.id] = el; }}
                        className="coin-item"
                        style={{
                            left: `${coin.left}%`,
                            transform: 'translateX(-50%)',
                        }}
                        onClick={() => handleCoinClick(coin.id)}
                    >
                        <div className="coin-body" style={{ fontSize: `${coin.size}px` }}>
                            {coin.emoji}
                        </div>
                    </div>
                ))}
            </div>
        </>
    );
}

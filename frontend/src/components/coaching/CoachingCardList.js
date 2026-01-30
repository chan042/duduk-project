"use client";

import { useState, useEffect } from 'react';
import { ShoppingBag, Coffee, ChevronRight, MapPin, Droplets, Zap, ThumbsUp, ThumbsDown, Lightbulb } from 'lucide-react';
import DislikeReasonPopup from './DislikeReasonPopup';
import CoachingDetailPopup from './CoachingDetailPopup';
import { getCoachingAdvice, submitFeedback } from '@/lib/api/coaching';

export default function CoachingCardList({ cards, loading, onStartChallenge }) {
    // 부모 컴포넌트로부터 cards와 loading 상태를 props로 받습니다.
    // liked, disliked 상태는 로컬에서 관리하거나 필요시 부모로 올릴 수 있습니다.
    const [likedCards, setLikedCards] = useState(new Set());
    const [dislikedCards, setDislikedCards] = useState(new Set());
    const [showDislikePopup, setShowDislikePopup] = useState(null); // Stores card ID
    const [selectedCard, setSelectedCard] = useState(null); // For detail popup
    const [touchStart, setTouchStart] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);

    // useEffect(() => { ... }) 제거됨

    // 터치 시작 시 초기 위치 저장
    const handleTouchStart = (e) => {
        setTouchStart({
            x: e.touches[0].clientX,
            y: e.touches[0].clientY
        });
        setIsDragging(false);
    };

    // 터치 이동 시 방향 감지 및 수직 스크롤 방지
    const handleTouchMove = (e) => {
        const deltaX = Math.abs(e.touches[0].clientX - touchStart.x);
        const deltaY = Math.abs(e.touches[0].clientY - touchStart.y);

        // 가로 이동이 세로 이동보다 크면 드래그로 간주
        if (deltaX > deltaY && deltaX > 10) {
            setIsDragging(true);
            // 수직 스크롤 방지
            e.preventDefault();
        }
    };

    const getIconForSubject = (subject) => {
        switch (subject) {
            case "행동 변화 제안": return <Zap size={20} color="#2f855a" />;
            case "누수 소비": return <Droplets size={20} color="#2f855a" />;
            case "위치 기반 대안": return <MapPin size={20} color="#2f855a" />;
            case "키워드 기반 대안": return <ShoppingBag size={20} color="#2f855a" />;
            default: return <Lightbulb size={20} color="#2f855a" />;
        }
    };

    const handleLike = async (id) => {
        setLikedCards(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
                // Remove from dislikes if present
                setDislikedCards(d => {
                    const newDislikes = new Set(d);
                    newDislikes.delete(id);
                    return newDislikes;
                });
            }
            return newSet;
        });

        // Send to backend
        try {
            await submitFeedback(true);
        } catch (e) {
            console.error(e);
        }
    };

    const handleDislikeClick = (id) => {
        if (dislikedCards.has(id)) {
            // Toggle off
            setDislikedCards(prev => {
                const newSet = new Set(prev);
                newSet.delete(id);
                return newSet;
            });
        } else {
            // Open popup
            setShowDislikePopup(id);
        }
    };

    const handleDislikeSubmit = async (reason) => {
        if (showDislikePopup) {
            console.log(`Disliked card ${showDislikePopup} reason: ${reason}`);
            setDislikedCards(prev => {
                const newSet = new Set(prev);
                newSet.add(showDislikePopup);
                return newSet;
            });
            // Remove from likes if present
            setLikedCards(l => {
                const newLikes = new Set(l);
                newLikes.delete(showDislikePopup);
                return newLikes;
            });

            // Send to backend
            try {
                await submitFeedback(false, reason);
            } catch (e) {
                console.error(e);
            }

            setShowDislikePopup(null);
        }
    };

    if (loading) {
        return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading coaching...</div>;
    }

    if (cards.length === 0) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-sub)' }}>
                <p>아직 생성된 코칭 카드가 없습니다.</p>
                <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>지출 내역이 쌓이면 AI가 분석해드릴게요!</p>
            </div>
        );
    }

    return (
        <div style={{ marginBottom: '2rem' }}>
            <h3 style={{
                fontSize: '1.1rem',
                fontWeight: 'bold',
                marginBottom: '1rem',
                paddingLeft: '1.5rem',
                color: 'var(--text-main)'
            }}>
                AI 코칭 카드
            </h3>
            <div
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                style={{
                    display: 'flex',
                    overflowX: 'auto',
                    padding: '0 1.5rem',
                    gap: '1rem',
                    paddingBottom: '1rem',
                    scrollbarWidth: 'none', // Firefox
                    msOverflowStyle: 'none', // IE/Edge
                    touchAction: 'pan-x' // 가로 스크롤만 허용
                }}>
                <style jsx>{`
                    div::-webkit-scrollbar {
                        display: none;
                    }
                `}</style>
                {cards.map((card) => {
                    const isLiked = likedCards.has(card.id);
                    const isDisliked = dislikedCards.has(card.id);

                    return (
                        <div key={card.id} style={{
                            minWidth: '280px',
                            backgroundColor: 'var(--card-bg)',
                            borderRadius: 'var(--radius-lg)',
                            padding: '1.5rem',
                            boxShadow: 'var(--shadow-md)',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            height: '320px',
                            position: 'relative'
                        }}>
                            <div>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    marginBottom: '1rem'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                        {card.icon}
                                        <span style={{
                                            marginLeft: '0.5rem',
                                            backgroundColor: '#e6fffa',
                                            color: '#2f855a',
                                            padding: '0.25rem 0.75rem',
                                            borderRadius: '999px',
                                            fontSize: '0.8rem',
                                            fontWeight: '600'
                                        }}>
                                            {card.tag}
                                        </span>
                                    </div>

                                    {/* Feedback Buttons */}
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button
                                            onClick={() => handleLike(card.id)}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                cursor: 'pointer',
                                                padding: '4px',
                                                color: isLiked ? 'var(--primary)' : 'var(--text-sub)'
                                            }}
                                        >
                                            <ThumbsUp
                                                size={20}
                                                fill={isLiked ? 'currentColor' : 'none'}
                                            />
                                        </button>
                                        <button
                                            onClick={() => handleDislikeClick(card.id)}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                cursor: 'pointer',
                                                padding: '4px',
                                                color: isDisliked ? 'var(--primary)' : 'var(--text-sub)'
                                            }}
                                        >
                                            <ThumbsDown
                                                size={20}
                                                fill={isDisliked ? 'currentColor' : 'none'}
                                            />
                                        </button>
                                    </div>
                                </div>
                                <h4 style={{
                                    fontSize: '1.2rem',
                                    fontWeight: 'bold',
                                    marginBottom: '1rem',
                                    color: 'var(--text-main)',
                                    lineHeight: '1.4'
                                }}>
                                    {card.title}
                                </h4>
                                <p style={{
                                    color: 'var(--text-sub)',
                                    fontSize: '0.95rem',
                                    lineHeight: '1.5',
                                    display: '-webkit-box',
                                    WebkitLineClamp: 3,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden'
                                }}>
                                    {card.analysis}
                                </p>
                                <button
                                    onClick={() => setSelectedCard(card)}
                                    style={{
                                        position: 'absolute',
                                        bottom: '1.5rem',
                                        right: '1.5rem',
                                        background: 'none',
                                        border: 'none',
                                        color: '#2f855a',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        padding: 0,
                                        display: 'flex',
                                        alignItems: 'center',
                                        fontSize: '0.9rem'
                                    }}
                                >
                                    더보기 <ChevronRight size={16} />
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {showDislikePopup && (
                <DislikeReasonPopup
                    onClose={() => setShowDislikePopup(null)}
                    onSubmit={handleDislikeSubmit}
                />
            )}

            {selectedCard && (
                <CoachingDetailPopup
                    isOpen={!!selectedCard}
                    onClose={() => setSelectedCard(null)}
                    data={selectedCard}
                    onStartChallenge={onStartChallenge}
                />
            )}
        </div>
    );
}

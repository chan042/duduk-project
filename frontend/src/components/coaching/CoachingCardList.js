"use client";

import { useState, useEffect } from 'react';
import { ShoppingBag, Coffee, ChevronRight, MapPin, Droplets, Zap, ThumbsUp, ThumbsDown, Lightbulb, ArrowRight } from 'lucide-react';
import DislikeReasonPopup from './DislikeReasonPopup';
import CoachingDetailPopup from './CoachingDetailPopup';
import { getCoachingAdvice, submitFeedback } from '@/lib/api/coaching';
import { useAuth } from '@/contexts/AuthContext';

export default function CoachingCardList({ cards, loading, onStartChallenge }) {
    const { user } = useAuth();
    const [likedCards, setLikedCards] = useState(new Set());
    const [dislikedCards, setDislikedCards] = useState(new Set());
    const [showDislikePopup, setShowDislikePopup] = useState(null);
    const [selectedCard, setSelectedCard] = useState(null);
    const [touchStart, setTouchStart] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);

    const handleTouchStart = (e) => {
        setTouchStart({
            x: e.touches[0].clientX,
            y: e.touches[0].clientY
        });
        setIsDragging(false);
    };

    const handleTouchMove = (e) => {
        const deltaX = Math.abs(e.touches[0].clientX - touchStart.x);
        const deltaY = Math.abs(e.touches[0].clientY - touchStart.y);

        if (deltaX > deltaY && deltaX > 10) {
            setIsDragging(true);
            e.preventDefault();
        }
    };

    const handleLike = async (id, e) => {
        e.stopPropagation(); // 카드 클릭 방지
        setLikedCards(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) newSet.delete(id);
            else {
                newSet.add(id);
                setDislikedCards(d => {
                    const newDislikes = new Set(d);
                    newDislikes.delete(id);
                    return newDislikes;
                });
            }
            return newSet;
        });

        try { await submitFeedback(true); } catch (e) { console.error(e); }
    };

    const handleDislikeClick = (id, e) => {
        e.stopPropagation(); // 카드 클릭 방지
        if (dislikedCards.has(id)) {
            setDislikedCards(prev => {
                const newSet = new Set(prev);
                newSet.delete(id);
                return newSet;
            });
        } else {
            setShowDislikePopup(id);
        }
    };

    const handleDislikeSubmit = async (reason) => {
        if (showDislikePopup) {
            setDislikedCards(prev => {
                const newSet = new Set(prev);
                newSet.add(showDislikePopup);
                return newSet;
            });
            setLikedCards(l => {
                const newLikes = new Set(l);
                newLikes.delete(showDislikePopup);
                return newLikes;
            });

            try { await submitFeedback(false, reason); } catch (e) { console.error(e); }
            setShowDislikePopup(null);
        }
    };

    if (loading) return <div style={{ padding: '2rem', textAlign: 'center', color: '#8898aa', fontSize: '0.9rem' }}>AI가 소비 내역을 분석중입니다...</div>;

    if (cards.length === 0) {
        return (
            <div style={{ padding: '3rem 2rem', textAlign: 'center', color: '#8898aa', backgroundColor: '#f8f9fa', borderRadius: '20px', margin: '0 1.5rem 2rem' }}>
                <p style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '0.5rem', color: '#525f7f' }}>아직 코칭 카드가 없어요</p>
                <p style={{ fontSize: '0.85rem', opacity: 0.8 }}>지출 내역이 쌓이면 AI가 분석해드릴게요!</p>
            </div>
        );
    }

    return (
        <div style={{ marginBottom: '2.5rem' }}>
            <div style={{
                padding: '0 1.5rem',
                marginBottom: '1rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline'
            }}>
                <h3 style={{
                    fontSize: '1.25rem',
                    fontWeight: '700',
                    color: '#32325d',
                    letterSpacing: '-0.5px'
                }}>
                    AI 코칭 카드
                </h3>
            </div>

            <div
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                style={{
                    display: 'flex',
                    overflowX: 'auto',
                    padding: '0 1.5rem 2rem', // px-6 equivalent
                    gap: '1.25rem',
                    scrollSnapType: 'x mandatory',
                    scrollPaddingLeft: '1.5rem', // Snap alignment fix
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                    WebkitOverflowScrolling: 'touch'
                }}>
                <style jsx>{`
                    div::-webkit-scrollbar { display: none; }
                `}</style>

                {cards.map((card) => {
                    const isLiked = likedCards.has(card.id);
                    const isDisliked = dislikedCards.has(card.id);

                    return (
                        <div
                            key={card.id}
                            onClick={() => setSelectedCard(card)}
                            style={{
                                minWidth: '300px',
                                maxWidth: '300px',
                                backgroundColor: '#ffffff',
                                borderRadius: '24px',
                                padding: '1.75rem',
                                boxShadow: '0 15px 35px rgba(50, 50, 93, 0.1), 0 5px 15px rgba(0, 0, 0, 0.07)', // Soft, deep shadow
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                                height: '380px', // 높이 약간 증가
                                position: 'relative',
                                scrollSnapAlign: 'start',
                                transition: 'transform 0.2s',
                                border: '1px solid rgba(0,0,0,0.02)',
                                cursor: 'pointer'
                            }}>

                            {/* Header: Tag & Likes */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    backgroundColor: 'rgba(20, 184, 166, 0.1)',
                                    padding: '0.4rem 0.8rem',
                                    borderRadius: '12px',
                                }}>
                                    {card.icon}
                                    <span style={{
                                        marginLeft: '0.5rem',
                                        color: '#0d9488', // Darker Teal
                                        fontSize: '0.8rem',
                                        fontWeight: '700',
                                        letterSpacing: '0.3px'
                                    }}>
                                        {card.tag}
                                    </span>
                                </div>

                                <div style={{ display: 'flex', gap: '0.25rem', backgroundColor: '#f7fafc', borderRadius: '12px', padding: '4px' }}>
                                    <button
                                        onClick={(e) => handleLike(card.id, e)}
                                        style={{
                                            background: isLiked ? '#fff' : 'transparent',
                                            border: 'none',
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            padding: '6px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: isLiked ? '#14b8a6' : '#a0aec0',
                                            boxShadow: isLiked ? '0 2px 5px rgba(0,0,0,0.05)' : 'none',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        <ThumbsUp size={16} fill={isLiked ? 'currentColor' : 'none'} />
                                    </button>
                                    <button
                                        onClick={(e) => handleDislikeClick(card.id, e)}
                                        style={{
                                            background: isDisliked ? '#fff' : 'transparent',
                                            border: 'none',
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            padding: '6px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: isDisliked ? '#e53e3e' : '#a0aec0',
                                            boxShadow: isDisliked ? '0 2px 5px rgba(0,0,0,0.05)' : 'none',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        <ThumbsDown size={16} fill={isDisliked ? 'currentColor' : 'none'} />
                                    </button>
                                </div>
                            </div>

                            {/* Content */}
                            <div style={{ flex: 1 }}>
                                <h4 style={{
                                    fontSize: '1.35rem',
                                    fontWeight: '800',
                                    marginBottom: '0.75rem',
                                    color: '#1a202c',
                                    lineHeight: '1.3',
                                    letterSpacing: '-0.5px'
                                }}>
                                    {card.title}
                                </h4>
                                <p style={{
                                    color: '#4a5568',
                                    fontSize: '0.95rem',
                                    lineHeight: '1.6',
                                    display: '-webkit-box',
                                    WebkitLineClamp: 4,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden',
                                    fontWeight: '400'
                                }}>
                                    {card.description}
                                </p>
                            </div>

                            {/* Footer / CTA */}
                            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    color: '#14b8a6',
                                    fontSize: '0.9rem',
                                    fontWeight: '700',
                                    gap: '4px',
                                    padding: '8px 16px',
                                    backgroundColor: 'rgba(20, 184, 166, 0.05)',
                                    borderRadius: '20px',
                                    transition: 'background-color 0.2s'
                                }}>
                                    자세히 보기 <ArrowRight size={16} strokeWidth={2.5} />
                                </div>
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
                    characterType={user?.character_type}
                />
            )}
        </div>
    );
}

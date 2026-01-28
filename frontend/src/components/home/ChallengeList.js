"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import ChallengeCard from '@/components/challenge/ChallengeCard';
import { getMyChallenges } from '@/lib/api/challenge';

export default function ChallengeList() {
    const router = useRouter();
    const [challenges, setChallenges] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchChallenges = async () => {
            try {
                const data = await getMyChallenges('active');
                setChallenges(data);
            } catch (error) {
                console.error('Failed to fetch challenges:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchChallenges();
    }, []);

    const handleMoreClick = () => {
        router.push('/challenge');
    };

    const handleCardClick = (challenge) => {
        router.push('/challenge');
    };

    if (!isLoading && challenges.length === 0) {
        return (
            <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', paddingLeft: '0.5rem', paddingRight: '0.5rem' }}>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-main)' }}>도전 중인 챌린지</h2>
                    <button
                        onClick={handleMoreClick}
                        style={{
                            background: 'none',
                            border: 'none',
                            fontSize: '0.85rem',
                            color: 'var(--text-sub)',
                            fontWeight: '600',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem'
                        }}>
                        더보기 <ChevronRight size={14} />
                    </button>
                </div>
                <div style={{
                    padding: '2rem 1rem',
                    textAlign: 'center',
                    color: 'var(--text-sub)',
                    fontSize: '0.9rem',
                    backgroundColor: 'var(--background-light)',
                    borderRadius: 'var(--radius-md)',
                    margin: '0 0.5rem',
                    border: '1px dashed rgba(0,0,0,0.1)'
                }}>
                    도전 중인 챌린지가 없습니다.<br />
                    <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>새로운 챌린지에 도전해보세요!</span>
                </div>
            </div>
        );
    }

    return (
        <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', paddingLeft: '0.5rem', paddingRight: '0.5rem' }}>
                <h2 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-main)' }}>도전 중인 챌린지</h2>
                <button
                    onClick={handleMoreClick}
                    style={{
                        background: 'none',
                        border: 'none',
                        fontSize: '0.85rem',
                        color: 'var(--text-sub)',
                        fontWeight: '600',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem'
                    }}>
                    더보기 <ChevronRight size={14} />
                </button>
            </div>

            <div style={{ position: 'relative', margin: '0 -0.5rem' }}>
                {/* Left Blur */}
                <div style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: '20px',
                    background: 'linear-gradient(to right, var(--background-light) 20%, transparent)',
                    zIndex: 10,
                    pointerEvents: 'none'
                }}></div>

                {/* Right Blur */}
                <div style={{
                    position: 'absolute',
                    right: 0,
                    top: 0,
                    bottom: 0,
                    width: '20px',
                    background: 'linear-gradient(to left, var(--background-light) 20%, transparent)',
                    zIndex: 10,
                    pointerEvents: 'none'
                }}></div>

                <div style={{
                    display: 'flex',
                    gap: '0.75rem',
                    overflowX: 'auto',
                    padding: '0.25rem 1rem',
                    scrollbarWidth: 'none',
                    paddingBottom: '1rem',
                    maskImage: 'linear-gradient(to right, transparent, black 20px, black calc(100% - 20px), transparent)',
                    WebkitMaskImage: 'linear-gradient(to right, transparent, black 20px, black calc(100% - 20px), transparent)'
                }}>
                    {challenges.map(challenge => (
                        <div key={challenge.id} style={{ minWidth: '310px' }}>
                            <ChallengeCard
                                challenge={challenge}
                                onClick={handleCardClick}
                                isOngoing={true}
                            />
                        </div>
                    ))}

                    {/* Loading Skeletons if loading */}
                    {isLoading && (
                        <>
                            <div style={{ minWidth: '310px', height: '140px', backgroundColor: 'white', borderRadius: '16px', opacity: 0.5 }}></div>
                            <div style={{ minWidth: '310px', height: '140px', backgroundColor: 'white', borderRadius: '16px', opacity: 0.5 }}></div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

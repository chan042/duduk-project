"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ChallengeCard from '@/components/challenge/ChallengeCard';
import { getOngoingChallenges, getMyChallenges } from '@/lib/api/challenge';
import { useAuth } from '@/contexts/AuthContext';

export default function ChallengeList() {
    const router = useRouter();
    const { isAuthenticated } = useAuth();
    const [challenges, setChallenges] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const challengeGap = '0.75rem';
    const challengeCardWidth = 'clamp(280px, 88%, 340px)';

    useEffect(() => {
        const fetchChallenges = async () => {
            // 인증되지 않은 경우 API 호출하지 않음
            if (!isAuthenticated) {
                setIsLoading(false);
                return;
            }

            try {
                // active + ready 상태 모두 가져오기
                const [activeData, readyData] = await Promise.all([
                    getOngoingChallenges(),
                    getMyChallenges('ready'),
                ]);
                const combined = [...activeData, ...readyData];
                const unique = Array.from(new Map(combined.map(c => [c.id, c])).values());
                setChallenges(unique);
            } catch (error) {
                console.error('Failed to fetch challenges:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchChallenges();
    }, [isAuthenticated]);

    const handleCardClick = () => {
        router.push('/challenge');
    };

    // 로딩중이 아닌 상태에서 챌린지가 없는 경우
    if (!isLoading && (!isAuthenticated || challenges.length === 0)) {
        return null;
    }

    return (
        <div style={{ marginBottom: '0.75rem' }}>
            <div style={{ marginBottom: '0.75rem' }}>
                <h2 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-main)' }}>진행 중인 챌린지</h2>
            </div>

            <div>
                <div style={{
                    display: 'flex',
                    gap: challengeGap,
                    overflowX: 'auto',
                    padding: '0.25rem 0 calc(0.25rem + 2px) 0',
                    scrollbarWidth: 'none',
                    scrollSnapType: 'x proximity',
                    overscrollBehaviorX: 'contain',
                    WebkitOverflowScrolling: 'touch'
                }}>
                    {challenges.map(challenge => (
                        <div
                            key={challenge.uniqueId || challenge.id}
                            style={{
                                flex: '0 0 auto',
                                width: challenges.length === 1 ? '100%' : challengeCardWidth,
                                maxWidth: '100%',
                                height: '140px',
                                scrollSnapAlign: 'start'
                            }}
                        >
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
                            <div style={{ flex: '0 0 auto', width: challengeCardWidth, height: '140px', backgroundColor: 'white', borderRadius: '16px', opacity: 0.5, scrollSnapAlign: 'start' }}></div>
                            <div style={{ flex: '0 0 auto', width: challengeCardWidth, height: '140px', backgroundColor: 'white', borderRadius: '16px', opacity: 0.5, scrollSnapAlign: 'start' }}></div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import SavingsSummary from '@/components/coaching/SavingsSummary';
import CoachingCardList from '@/components/coaching/CoachingCardList';
import CompletedCoachingList from '@/components/coaching/CompletedCoachingList';
import AIGeneratedChallengeModal from '@/components/challenge/AIGeneratedChallengeModal';
import { getCoachingAdvice } from '@/lib/api/coaching';
import { generateChallengeFromCoaching, startChallengeFromCoaching } from '@/lib/api/challenge';
import { ShoppingBag, MapPin, Droplets, Zap, Lightbulb, Sparkles, Tag } from 'lucide-react';

export default function CoachingPage() {
    const router = useRouter();
    const [cards, setCards] = useState([]);
    const [loading, setLoading] = useState(true);
    const [totalSavingsThisMonth, setTotalSavingsThisMonth] = useState(0);

    // AI 챌린지 모달 상태
    const [showAIPreviewModal, setShowAIPreviewModal] = useState(false);
    const [aiGeneratedChallenge, setAiGeneratedChallenge] = useState(null);
    const [isSavingAI, setIsSavingAI] = useState(false);
    const [currentCoachingId, setCurrentCoachingId] = useState(null);

    const getIconForSubject = (subject) => {
        switch (subject) {
            case "행동 변화 제안": return <Sparkles size={20} color="#2f855a" />;
            case "누수 소비": return <Droplets size={20} color="#2f855a" />;
            case "위치 기반 대안": return <MapPin size={20} color="#2f855a" />;
            case "키워드 기반 대안": return <Tag size={20} color="#2f855a" />;
            default: return <Lightbulb size={20} color="#2f855a" />;
        }
    };

    useEffect(() => {
        const fetchCoaching = async () => {
            try {
                // 전체 코칭 카드 조회 (카드 목록 표시용)
                const allData = await getCoachingAdvice();

                // 현재 월 코칭 카드 조회 (예상 절약액 계산용)
                const today = new Date();
                const currentMonthData = await getCoachingAdvice(today.getFullYear(), today.getMonth() + 1);

                // Map backend data to frontend format
                const mappedCards = allData.map(item => ({
                    id: item.id,
                    tag: item.subject,
                    title: item.title,
                    analysis: item.analysis,
                    description: item.coaching_content,
                    estimated_savings: item.estimated_savings,
                    icon: getIconForSubject(item.subject),
                    created_at: item.created_at
                }));

                // 현재 월 예상 절약액 합계 계산
                const currentMonthSavings = currentMonthData.reduce(
                    (sum, item) => sum + (item.estimated_savings || 0), 0
                );

                setCards(mappedCards);
                setTotalSavingsThisMonth(currentMonthSavings);
            } catch (error) {
                console.error("Failed to fetch coaching:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchCoaching();
    }, []);

    // 코칭 기반 챌린지 생성
    const handleStartChallengeFromCoaching = async (coachingData) => {
        try {
            setCurrentCoachingId(coachingData.id);
            const generated = await generateChallengeFromCoaching(coachingData.id, 'normal');
            setAiGeneratedChallenge(generated);
            setShowAIPreviewModal(true);
        } catch (err) {
            console.error('코칭 기반 챌린지 생성 실패:', err);
            alert(err.response?.data?.error || '챌린지 생성에 실패했습니다.');
        }
    };

    // AI 챌린지 저장
    const handleSaveAIChallenge = async (editedData) => {
        setIsSavingAI(true);
        try {
            await startChallengeFromCoaching(currentCoachingId, editedData);
            setShowAIPreviewModal(false);
            setAiGeneratedChallenge(null);
            setCurrentCoachingId(null);
            alert('챌린지가 저장되었습니다!');
            router.push('/challenge');
        } catch (err) {
            console.error('챌린지 저장 실패:', err);
            alert(err.response?.data?.error || '챌린지 저장에 실패했습니다.');
        } finally {
            setIsSavingAI(false);
        }
    };

    // 최신 4개와 나머지 카드 분리 (최대 5개)
    const recentCards = cards.slice(0, 4);
    const olderCards = cards.slice(4, 9); // 5번째부터 9번째까지 (최대 5개)

    return (
        <div style={{
            minHeight: '100vh',
            backgroundColor: 'var(--background-light)',
            paddingBottom: '6rem'
        }}>

            <main>
                {/* 이번 달 예상 절약액만 전달 */}
                <SavingsSummary totalSavings={totalSavingsThisMonth} />
                {/* 최신 4개 카드만 전달 */}
                <CoachingCardList
                    cards={recentCards}
                    loading={loading}
                    onStartChallenge={handleStartChallengeFromCoaching}
                />
                {/* 나머지 카드 전달 (최대 5개) - 5개 초과일 때만 표시 */}
                {olderCards.length > 0 && (
                    <CompletedCoachingList cards={olderCards} />
                )}
            </main>

            {/* AI 생성 챌린지 미리보기 모달 */}
            <AIGeneratedChallengeModal
                isOpen={showAIPreviewModal}
                onClose={() => {
                    setShowAIPreviewModal(false);
                    setAiGeneratedChallenge(null);
                    setCurrentCoachingId(null);
                }}
                challengeData={aiGeneratedChallenge}
                onSave={handleSaveAIChallenge}
                isSaving={isSavingAI}
                source="coaching"
            />
        </div >
    );
}

"use client";

/**
 * [파일 역할]
 * - 챌린지 페이지 메인 컴포넌트
 * - 백엔드 API 연동으로 실제 데이터 표시
 * - 전체 탭에서 진행중/미참여 섹션 분리
 * - AI Insight 섹션 추가
 */
import { useState, useEffect, useCallback } from 'react';
import { Plus, Sparkles } from 'lucide-react';

// 컴포넌트
import ChallengeTabs from '@/components/challenge/ChallengeTabs';
import ChallengeCard from '@/components/challenge/ChallengeCard';
import ChallengeDetailModal from '@/components/challenge/ChallengeDetailModal';

// API
import {
    getChallengeTemplates,
    getMyChallenges,
    getUserChallenges,
    startChallenge,
    retryChallenge,
    cancelChallenge,
    getUserPoints,
    createUserChallenge,
} from '@/lib/api/challenge';


// 탭 정의
const challengeTabs = [
    { id: 'all', label: '전체' },
    { id: 'user', label: '사용자 챌린지' },
    { id: 'ongoing', label: '참여중' },
    { id: 'completed', label: '완료' },
    { id: 'failed', label: '실패' },
];

export default function ChallengePage() {
    const [activeTab, setActiveTab] = useState('all');
    const [userPoints, setUserPoints] = useState(0);
    const [selectedChallenge, setSelectedChallenge] = useState(null);
    const [challenges, setChallenges] = useState([]);
    const [ongoingChallenges, setOngoingChallenges] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);


    // 포인트 조회
    const fetchUserPoints = useCallback(async () => {
        try {
            const data = await getUserPoints();
            setUserPoints(data.points);
        } catch (err) {
            console.error('포인트 조회 실패:', err);
        }
    }, []);



    // 챌린지 데이터 로드
    const fetchChallenges = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            let data = [];
            let ongoing = [];

            switch (activeTab) {
                case 'all':
                    // 전체 탭: 모든 템플릿 + 진행중인 챌린지 분리
                    const allTemplates = await getChallengeTemplates('duduk');
                    ongoing = await getMyChallenges('active');

                    // 진행중인 챌린지의 템플릿 ID 목록
                    const ongoingTemplateIds = ongoing.map(c => c.templateId);

                    // 진행중이 아닌 템플릿만 필터링
                    data = allTemplates.filter(t => !ongoingTemplateIds.includes(t.id));
                    setOngoingChallenges(ongoing);
                    break;

                case 'user':
                    // 사용자 챌린지 탭: 사용자가 만든 챌린지, AI 맞춤 챌린지
                    data = await getUserChallenges();
                    setOngoingChallenges([]);
                    break;

                case 'ongoing':
                    // 참여중 탭
                    data = await getMyChallenges('active');
                    setOngoingChallenges([]);
                    break;

                case 'completed':
                    // 완료된 항목 탭: 성공만
                    data = await getMyChallenges('completed');
                    setOngoingChallenges([]);
                    break;

                case 'failed':
                    // 실패 탭
                    data = await getMyChallenges('failed');
                    setOngoingChallenges([]);
                    break;

                default:
                    data = await getChallengeTemplates('duduk');
                    setOngoingChallenges([]);
            }
            setChallenges(data);
        } catch (err) {
            console.error('챌린지 로드 실패:', err);
            setError('챌린지를 불러오는데 실패했습니다.');
            setChallenges([]);
            setOngoingChallenges([]);
        } finally {
            setLoading(false);
        }
    }, [activeTab]);

    // 초기 로드
    useEffect(() => {
        fetchUserPoints();
    }, [fetchUserPoints]);

    // 탭 변경 시 데이터 로드
    useEffect(() => {
        fetchChallenges();
    }, [fetchChallenges]);

    const handleCardClick = (challenge) => {
        setSelectedChallenge(challenge);
    };

    const handleCloseModal = () => {
        setSelectedChallenge(null);
    };

    const handleCancelChallenge = async (challenge) => {
        try {
            await cancelChallenge(challenge.id);
            await fetchChallenges();
            await fetchUserPoints();
            setSelectedChallenge(null);
            alert('챌린지가 중단되었습니다.');
        } catch (err) {
            console.error('챌린지 중단 실패:', err);
            alert('챌린지 중단에 실패했습니다.');
        }
    };

    const handlePhotoUpload = async (challenge) => {
        // 추후 구현 필요
        alert('사진 업로드 기능은 준비 중입니다.');
    };

    const handleStartChallenge = async (challenge, userInputs = {}) => {
        try {
            // 템플릿 기반 챌린지 시작
            await startChallenge(challenge.id, userInputs);
            // 성공 시 데이터 새로고침
            await fetchChallenges();
            await fetchUserPoints();
            setSelectedChallenge(null);
            alert('챌린지가 시작되었습니다!');
        } catch (err) {
            console.error('챌린지 시작 실패:', err);
            alert(err.response?.data?.error || err.response?.data?.detail || '챌린지 시작에 실패했습니다.');
        }
    };

    const handleRetryChallenge = async (challenge) => {
        try {
            // 재도전 API 호출 (Template 리스트에서는 userChallengeId, My Challenge 리스트에서는 id 사용)
            const challengeId = challenge.userChallengeId || challenge.id;
            await retryChallenge(challengeId);
            await fetchChallenges();
            await fetchUserPoints();
            setSelectedChallenge(null);
            alert('챌린지를 재도전합니다!');
        } catch (err) {
            console.error('재도전 실패:', err);
            alert(err.response?.data?.error || err.response?.data?.detail || '재도전에 실패했습니다.');
        }
    };

    const handleCreateChallenge = async () => {
        // 기본 챌린지 데이터로 생성 (추후 모달 추가)
        const defaultChallenge = {
            name: '나만의 챌린지',
            description: '내가 만든 챌린지입니다',
            icon: 'sparkles',
            icon_color: '#6366F1',
            duration_days: 7,
            target_amount: 0,
            target_categories: [],
        };

        try {
            await createUserChallenge(defaultChallenge);
            await fetchChallenges();
            setActiveTab('user');
            alert('사용자 챌린지가 생성되었습니다!');
        } catch (err) {
            console.error('챌린지 생성 실패:', err);
            alert(err.response?.data?.error || err.response?.data?.detail || '챌린지 생성에 실패했습니다.');
        }
    };

    return (
        <div style={styles.container}>
            {/* 탭 네비게이션 */}
            <ChallengeTabs
                tabs={challengeTabs}
                activeTab={activeTab}
                onTabChange={setActiveTab}
            />

            {/* 직접 만들기 버튼 */}
            <div style={styles.createRow}>
                <button style={styles.createButton} onClick={handleCreateChallenge}>
                    <Plus size={16} />
                    <span>직접 만들기</span>
                </button>
            </div>

            {/* 로딩 상태 */}
            {loading && (
                <div style={styles.loadingState}>
                    <p>로딩 중...</p>
                </div>
            )}

            {/* 에러 상태 */}
            {error && (
                <div style={styles.errorState}>
                    <p>{error}</p>
                    <button onClick={fetchChallenges} style={styles.retryButton}>
                        다시 시도
                    </button>
                </div>
            )}

            {/* 챌린지 목록 */}
            {!loading && !error && (
                <>
                    {/* 전체 탭: 진행중인 챌린지 섹션 */}
                    {activeTab === 'all' && ongoingChallenges.length > 0 && (
                        <div style={styles.section}>
                            <h3 style={styles.sectionTitle}>진행중인 챌린지</h3>
                            <div style={styles.cardList}>
                                {ongoingChallenges.map((challenge) => (
                                    <ChallengeCard
                                        key={`ongoing-${challenge.id}`}
                                        challenge={challenge}
                                        onClick={handleCardClick}
                                        onStart={handleStartChallenge}
                                        onRetry={handleRetryChallenge}
                                        isOngoing={true}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 전체 탭: 시작 가능한 챌린지 섹션 */}
                    {activeTab === 'all' && challenges.length > 0 && (
                        <div style={styles.section}>
                            <h3 style={styles.sectionTitle}>도전해보세요</h3>
                            <div style={styles.cardList}>
                                {challenges.map((challenge) => (
                                    <ChallengeCard
                                        key={challenge.id}
                                        challenge={challenge}
                                        onClick={handleCardClick}
                                        onStart={handleStartChallenge}
                                        onRetry={handleRetryChallenge}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 다른 탭: 일반 리스트 */}
                    {activeTab !== 'all' && challenges.length > 0 && (
                        <div style={styles.cardList}>
                            {challenges.map((challenge) => (
                                <ChallengeCard
                                    key={challenge.id}
                                    challenge={challenge}
                                    onClick={handleCardClick}
                                    onStart={handleStartChallenge}
                                    onRetry={handleRetryChallenge}
                                    isOngoing={activeTab === 'ongoing'}
                                />
                            ))}
                        </div>
                    )}

                    {/* 빈 상태 */}
                    {challenges.length === 0 && ongoingChallenges.length === 0 && (
                        <div style={styles.emptyState}>
                            <p>해당하는 챌린지가 없습니다.</p>
                        </div>
                    )}
                </>
            )}



            {/* 하단 여백 (BottomNavigation 위) */}
            <div style={{ height: '100px' }}></div>

            {/* 챌린지 상세 모달 */}
            {selectedChallenge && (
                <ChallengeDetailModal
                    challenge={selectedChallenge}
                    onClose={handleCloseModal}
                    onStart={handleStartChallenge}
                    onRetry={handleRetryChallenge}
                    onCancel={handleCancelChallenge}
                    onPhotoUpload={handlePhotoUpload}
                />
            )}
        </div>
    );
}

const styles = {
    container: {
        padding: '1rem',
        minHeight: '100vh',
        backgroundColor: 'var(--background-light)',
    },
    createRow: {
        display: 'flex',
        justifyContent: 'flex-end',
        marginBottom: '1rem',
    },
    createButton: {
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '8px 12px',
        borderRadius: '20px',
        border: 'none',
        backgroundColor: 'transparent',
        color: 'var(--primary)',
        fontSize: '0.85rem',
        fontWeight: '600',
        cursor: 'pointer',
    },
    section: {
        marginBottom: '1.5rem',
    },
    sectionTitle: {
        fontSize: '1rem',
        fontWeight: '600',
        color: 'var(--text-main)',
        marginBottom: '0.75rem',
    },
    cardList: {
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
    },
    emptyState: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '3rem',
        color: 'var(--text-sub)',
    },
    loadingState: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '3rem',
        color: 'var(--text-sub)',
    },
    errorState: {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '3rem',
        color: 'var(--error)',
        gap: '1rem',
    },
    retryButton: {
        padding: '8px 16px',
        borderRadius: '8px',
        border: 'none',
        backgroundColor: 'var(--primary)',
        color: 'white',
        cursor: 'pointer',
    },

};

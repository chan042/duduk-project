"use client";

/**
 * [파일 역할]
 * - 챌린지 페이지 메인 컴포넌트
 * - 백엔드 API 연동으로 실제 데이터 표시
 * - 전체 탭에서 진행중/미참여 섹션 분리
 * - AI Insight 섹션 추가
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Sparkles, DoorClosed } from 'lucide-react';
import { useRouter } from 'next/navigation';

// 컴포넌트
import ChallengeTabs from '@/components/challenge/ChallengeTabs';
import ChallengeCard from '@/components/challenge/ChallengeCard';
import ChallengeDetailModal from '@/components/challenge/ChallengeDetailModal';
import CustomChallengeModal from '@/components/challenge/CustomChallengeModal';
import AIGeneratedChallengeModal from '@/components/challenge/AIGeneratedChallengeModal';

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
    generateAIChallenge,
    startAIChallenge,
    deleteChallenge,
    startSavedChallenge,
    uploadPhoto,
} from '@/lib/api/challenge';
import { fileToBase64, validateImageFile } from '@/lib/utils/imageUtils';



// 탭 정의
const challengeTabs = [
    { id: 'all', label: '전체' },
    { id: 'duduk', label: '두둑' },
    { id: 'user', label: '사용자' },
    { id: 'ongoing', label: '도전중' },
    { id: 'completed', label: '완료' },
    { id: 'failed', label: '실패' },
];

export default function ChallengePage() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState('all');
    const [userPoints, setUserPoints] = useState(0);
    const [selectedChallenge, setSelectedChallenge] = useState(null);
    const [challenges, setChallenges] = useState([]);
    const [ongoingChallenges, setOngoingChallenges] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // 커스텀 챌린지 모달 상태
    const [showCustomModal, setShowCustomModal] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);

    // AI 생성 챌린지 미리보기 모달 상태
    const [showAIPreviewModal, setShowAIPreviewModal] = useState(false);
    const [aiGeneratedChallenge, setAiGeneratedChallenge] = useState(null);
    const [isSavingAI, setIsSavingAI] = useState(false);


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
                    // 전체 탭: 모든 템플릿 + 사용자 챌린지 + 실패/완료 챌린지 포함
                    // 1. 두둑 템플릿 + 이벤트 템플릿
                    const allDudukTemplates = await getChallengeTemplates('duduk');
                    let allEventTemplates = [];
                    try {
                        allEventTemplates = await getChallengeTemplates('event');
                    } catch (e) {
                        // 이벤트 템플릿이 없을 수 있음
                    }
                    const allTemplates = [...allDudukTemplates, ...allEventTemplates];

                    // 2. 사용자 챌린지 (AI, 커스텀)
                    const userChallengesAll = await getUserChallenges();

                    // 3. 진행중, 실패, 완료 챌린지
                    ongoing = await getMyChallenges('active');
                    const failedChallenges = await getMyChallenges('failed');
                    const completedChallenges = await getMyChallenges('completed');

                    // 진행중인 챌린지의 템플릿 ID/챌린지 ID 목록 (중복 방지용)
                    const ongoingTemplateIds = ongoing.map(c => c.templateId);
                    const ongoingIds = ongoing.map(c => c.id);

                    // 진행중이 아닌 템플릿만 필터링
                    const filteredTemplates = allTemplates.filter(t => !ongoingTemplateIds.includes(t.id));

                    // 사용자 챌린지: active 상태 제외
                    const filteredUserChallenges = userChallengesAll.filter(c =>
                        !ongoingIds.includes(c.id) && c.status !== 'active'
                    );

                    // 이미 포함된 템플릿 ID 수집 (중복 방지)
                    const existingTemplateIds = new Set([
                        ...filteredTemplates.map(t => t.id),
                        ...filteredUserChallenges.map(c => c.templateId || c.id)
                    ]);

                    // 실패 챌린지: 중복 제외
                    const uniqueFailedChallenges = failedChallenges.filter(c =>
                        !existingTemplateIds.has(c.templateId) && !existingTemplateIds.has(c.id)
                    );

                    // 완료 챌린지: 중복 제외 (실패 챌린지와도 중복 체크)
                    const failedIds = new Set(uniqueFailedChallenges.map(c => c.templateId || c.id));
                    const uniqueCompletedChallenges = completedChallenges.filter(c =>
                        !existingTemplateIds.has(c.templateId) &&
                        !existingTemplateIds.has(c.id) &&
                        !failedIds.has(c.templateId) &&
                        !failedIds.has(c.id)
                    );

                    data = [
                        ...filteredTemplates,
                        ...filteredUserChallenges,
                        ...uniqueFailedChallenges,
                        ...uniqueCompletedChallenges
                    ];
                    setOngoingChallenges(ongoing);
                    break;

                case 'duduk':
                    // 두둑 탭: 두둑 템플릿 + 진행중인 챌린지
                    const dudukTemplates = await getChallengeTemplates('duduk');
                    const dudukOngoing = await getMyChallenges('active');
                    // 진행중인 챌린지의 템플릿 ID 목록
                    const dudukOngoingTemplateIds = dudukOngoing
                        .filter(c => c.sourceType === 'duduk')
                        .map(c => c.templateId);
                    // 진행중이 아닌 템플릿만 필터링
                    const dudukFiltered = dudukTemplates.filter(t => !dudukOngoingTemplateIds.includes(t.id));
                    // 두둑 진행중 챌린지 + 미참여 템플릿 합치기
                    data = [
                        ...dudukOngoing.filter(c => c.sourceType === 'duduk'),
                        ...dudukFiltered
                    ];
                    setOngoingChallenges([]);
                    break;

                case 'user':
                    // 사용자 챌린지 탭: 사용자가 만든 챌린지 + AI 맞춤 챌린지
                    const userTemplates = await getUserChallenges();
                    const userOngoing = await getMyChallenges('active');
                    // 진행중인 사용자/AI 챌린지 ID 목록
                    const userOngoingIds = userOngoing
                        .filter(c => c.sourceType === 'custom' || c.sourceType === 'ai')
                        .map(c => c.id);
                    // 진행중이 아닌 템플릿만 필터링
                    const userFiltered = userTemplates.filter(t =>
                        !userOngoingIds.includes(t.id) && t.status !== 'active'
                    );
                    // 사용자 진행중 챌린지 + 미참여 템플릿 합치기
                    data = [
                        ...userOngoing.filter(c => c.sourceType === 'custom' || c.sourceType === 'ai'),
                        ...userFiltered
                    ];
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

    const handlePhotoUpload = async (challenge, file) => {
        if (!file) {
            alert('업로드할 이미지를 선택해주세요.');
            return;
        }

        const validation = validateImageFile(file, 10);
        if (!validation.valid) {
            alert(validation.error || '이미지 파일이 유효하지 않습니다.');
            return;
        }

        try {
            const challengeId = challenge.userChallengeId || challenge.id;
            const imageBase64 = await fileToBase64(file);
            const result = await uploadPhoto(challengeId, {
                image_base64: imageBase64,
                mime_type: file.type || 'image/jpeg',
                captured_at: new Date().toISOString(),
            });

            await fetchChallenges();
            setSelectedChallenge((prev) => {
                if (!prev) return prev;
                return {
                    ...prev,
                    progressData: result.progress,
                    progress: result.progress?.percentage ?? prev.progress,
                };
            });
            alert(result?.verification?.reason_message || '사진 인증이 완료되었습니다.');
        } catch (err) {
            const serverMessage =
                err?.response?.data?.verification?.reason_message ||
                err?.response?.data?.error ||
                '사진 인증에 실패했습니다. 다시 시도해주세요.';
            alert(serverMessage);
        }
    };
    // 챌린지 시작
    const handleStartChallenge = async (challenge, userInputs = {}) => {
        try {
            const normalizedInputs = Object.entries(userInputs || {}).reduce((acc, [key, value]) => {
                if (value === '' || value === null || value === undefined) {
                    return acc;
                }

                const inputMeta = (challenge.userInputs || []).find((input) => input.key === key);
                if (inputMeta?.type === 'number' || key === 'compare_week') {
                    const parsed = Number(value);
                    acc[key] = Number.isNaN(parsed) ? value : parsed;
                    return acc;
                }

                acc[key] = value;
                return acc;
            }, {});

            // 저장된 챌린지 시작
            if (challenge.status === 'ready') {
                await startSavedChallenge(challenge.id);
            } else {
                // 템플릿 기반 챌린지 시작
                await startChallenge(challenge.id, normalizedInputs);
            }

            await fetchChallenges();
            setActiveTab('ongoing');
            handleCloseModal();
            alert('챌린지가 시작되었습니다!');
        } catch (err) {
            console.error('챌린지 시작 실패:', err);
            alert(err.response?.data?.error || err.response?.data?.detail || '챌린지 시작에 실패했습니다.');
        }
    };

    const handleRetryChallenge = async (challenge) => {
        try {
            // 재도전 API 호출
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

    const handleCreateChallenge = () => {
        // 커스텀 챌린지 모달 열기
        setShowCustomModal(true);
    };

    // AI 챌린지 생성
    const handleGenerateAIChallenge = async (title, details, difficulty) => {
        setIsGenerating(true);
        try {
            const generated = await generateAIChallenge(title, details, difficulty);
            setAiGeneratedChallenge(generated);
            setShowCustomModal(false);
            setShowAIPreviewModal(true);
        } catch (err) {
            console.error('AI 챌린지 생성 실패:', err);
            alert(err.response?.data?.error || 'AI 챌린지 생성에 실패했습니다.');
        } finally {
            setIsGenerating(false);
        }
    };

    // AI 챌린지 저장
    const handleSaveAIChallenge = async (editedData) => {
        setIsSavingAI(true);
        try {
            await startAIChallenge(editedData);
            await fetchChallenges();
            setShowAIPreviewModal(false);
            setAiGeneratedChallenge(null);
            setActiveTab('user');
            alert('챌린지가 저장되었습니다!');
        } catch (err) {
            console.error('챌린지 저장 실패:', err);
            alert(err.response?.data?.error || '챌린지 저장에 실패했습니다.');
        } finally {
            setIsSavingAI(false);
        }
    };

    // 챌린지 삭제
    const handleDeleteChallenge = async (challenge) => {
        try {
            await deleteChallenge(challenge.id);
            await fetchChallenges();
            setSelectedChallenge(null);
            alert('챌린지가 삭제되었습니다.');
        } catch (err) {
            console.error('챌린지 삭제 실패:', err);
            alert(err.response?.data?.error || '챌린지 삭제에 실패했습니다.');
        }
    };

    // 스크롤 시 헤더 상단 숨김 처리를 위한 ref
    const headerTopRef = useRef(null);

    return (
        <div style={styles.container}>
            {/* 헤더 섹션 (Calendar UI 스타일 - Sticky Header) */}
            <div style={styles.headerWrapper}>
                {/* 상단 섹션 - 스크롤 시 사라짐 */}
                <div style={styles.headerTop} ref={headerTopRef}>
                    {/* 우상단: 방 버튼 */}
                    <div style={styles.headerIcons}>
                        <button style={styles.iconButton} onClick={() => router.push('/room')}>
                            <DoorClosed size={20} color="var(--primary)" />
                        </button>
                    </div>

                    {/* 중앙: 포인트 표시 */}
                    <div style={styles.pointsDisplay}>
                        <div style={styles.pointsContainer}>
                            <span style={styles.pointsLabel}>보유 포인트</span>
                            <div style={styles.pointsValueWrapper}>
                                <span style={styles.pointsText}>{userPoints.toLocaleString()}</span>
                                <span style={styles.pointsUnit}>P</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 하단 섹션 - Sticky로 고정됨 */}
                <div style={styles.headerBottom}>
                    <ChallengeTabs
                        tabs={challengeTabs}
                        activeTab={activeTab}
                        onTabChange={setActiveTab}
                    />
                </div>
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
                                        key={challenge.uniqueId || `ongoing-${challenge.id}`}
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
                                        key={challenge.uniqueId || challenge.id}
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
                        <div style={styles.section}>
                            <div style={styles.cardList}>
                                {challenges.map((challenge) => (
                                    <ChallengeCard
                                        key={challenge.uniqueId || challenge.id}
                                        challenge={challenge}
                                        onClick={handleCardClick}
                                        onStart={handleStartChallenge}
                                        onRetry={handleRetryChallenge}
                                        isOngoing={activeTab === 'ongoing'}
                                    />
                                ))}
                            </div>
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

            {/* 플로팅 직접 만들기 버튼 (Glassmorphism) */}
            <button style={styles.floatingCreateButton} onClick={handleCreateChallenge}>
                <Plus size={18} strokeWidth={2.5} />
                <span>직접 만들기</span>
            </button>

            {/* 챌린지 상세 모달 */}
            {selectedChallenge && (
                <ChallengeDetailModal
                    challenge={selectedChallenge}
                    onClose={handleCloseModal}
                    onStart={handleStartChallenge}
                    onRetry={handleRetryChallenge}
                    onCancel={handleCancelChallenge}
                    onDelete={handleDeleteChallenge}
                    onPhotoUpload={handlePhotoUpload}
                />
            )}

            {/* 커스텀 챌린지 생성 모달 */}
            <CustomChallengeModal
                isOpen={showCustomModal}
                onClose={() => setShowCustomModal(false)}
                onGenerate={handleGenerateAIChallenge}
                isLoading={isGenerating}
            />

            {/* AI 생성 챌린지 미리보기 모달 */}
            <AIGeneratedChallengeModal
                isOpen={showAIPreviewModal}
                onClose={() => {
                    setShowAIPreviewModal(false);
                    setAiGeneratedChallenge(null);
                }}
                challengeData={aiGeneratedChallenge}
                onSave={handleSaveAIChallenge}
                isSaving={isSavingAI}
            />
        </div>
    );
}

const styles = {
    container: {
        background: 'var(--background-light)',
        minHeight: '100vh',
        padding: '1rem', // Calendar UI와 비슷하게 패딩 축소
        paddingTop: '0', // 상단 회색 영역 제거
        paddingBottom: '6rem',
    },
    // Sticky Header Wrapper - 음수 top으로 headerTop이 스크롤 아웃되도록 함
    headerWrapper: {
        backgroundColor: 'white',
        borderBottomLeftRadius: '20px',
        borderBottomRightRadius: '20px',
        margin: '0 -1rem 0.5rem -1rem',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)',
        position: 'sticky',
        top: '-160px', // headerTop 높이만큼 음수 (스크롤 시 headerTop만 사라짐)
        zIndex: 50,
        overflow: 'hidden',
    },
    // 상단 섹션 - 스크롤 시 사라지는 부분 (포인트, 상점 버튼)
    headerTop: {
        padding: '1.5rem 1rem 0.5rem 1rem',
        paddingTop: '0.5rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '160px', // sticky top과 동일하게 맞춤
        boxSizing: 'border-box',
        backgroundColor: 'white',
        position: 'relative',
    },
    // 하단 섹션 - Sticky로 상단에 고정되는 부분 (탭)
    headerBottom: {
        backgroundColor: 'white',
        padding: '0.5rem 1rem 1rem 1rem',
        borderBottomLeftRadius: '20px',
        borderBottomRightRadius: '20px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
    },
    pointsDisplay: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
    },
    pointsContainer: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '4px',
        padding: '1rem',
        background: 'white',
        transition: 'all 0.3s ease',
    },
    pointsLabel: {
        fontSize: '0.9rem',
        fontWeight: '600',
        color: 'var(--text-sub)',
    },
    pointsValueWrapper: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    pointsText: {
        fontSize: '4.5rem',
        fontWeight: '800',
        color: 'var(--primary)',
        lineHeight: '1',
    },
    pointsUnit: {
        fontSize: '2rem',
        fontWeight: '700',
        color: 'var(--primary)',
        marginLeft: '4px',
        marginTop: '0.8rem',
        opacity: 0.9,
    },
    headerIcons: {
        position: 'absolute',
        top: '12px',
        right: '12px',
        display: 'flex',
        gap: '8px',
    },
    iconButton: {
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '8px',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'background-color 0.2s ease',
    },
    storeButton: {
        // Kept for backwards compatibility but not used anymore
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '8px',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'background-color 0.2s ease',
    },
    floatingCreateButton: {
        position: 'fixed',
        bottom: '85px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        padding: '12px 24px',
        borderRadius: '9999px', // 알약 형태
        // Glassmorphism 스타일
        background: 'rgba(255, 255, 255, 0.3)', // 반투명 배경
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)', // Safari 대응
        border: '1px solid rgba(255, 255, 255, 0.25)', // 얇은 반투명 테두리
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.4)', // 유리 질감 그림자
        color: 'var(--primary)',
        fontSize: '0.9rem',
        fontWeight: '600',
        cursor: 'pointer',
        zIndex: 100,
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
    },
    section: {
        marginBottom: '1.5rem',
        padding: '0',
    },
    sectionTitle: {
        fontSize: '1rem',
        fontWeight: '600',
        color: 'var(--text-main)',
        marginBottom: '0.75rem',
        paddingLeft: '0.25rem',
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

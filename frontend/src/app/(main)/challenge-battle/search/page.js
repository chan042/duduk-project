"use client";

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, User } from 'lucide-react';

const categories = [
    { id: 'alternative', label: '대안 행동 실현도' },
    { id: 'growth', label: '성장' },
    { id: 'health', label: '건강 점수' },
    { id: 'challenge', label: '챌린지' },
];

const guideSlides = [
    {
        number: '1',
        title: '진행 방식',
        desc: "• 윤택지수 대결은 1:1 대결이에요.\n• 대결을 신청하고 상대방이 수락하면 시작할 수 있어요.",
        image: '/images/characters/char_dog/face_basic.png',
    },
    {
        number: '2',
        title: '시작 가능 기간',
        desc: "• 매월 1일~15일까지만 시작할 수 있어요.\n• 기간이 지나면 다음 달에 다시 참여할 수 있어요.",
        image: '/images/characters/char_dog/face_surprise.png',
    },
    {
        number: '3',
        title: '대결 규칙',
        desc: "• 선택한 항목에 따라 3개의 미션이 주어져요.\n• 하나의 미션을 성공할 때마다 +3점을 받아요.\n• 총 대결 결과는 기존 점수 + 보너스 점수로 결정돼요.",
        image: '/images/characters/char_dog/face_happy.png',
    },
    {
        number: '4',
        title: '대결 기준',
        desc: "• 4가지 항목 중 하나를 선택해 경쟁할 수 있어요.\n• 만약 모든 사용자가 미션에 성공하지 않는다면 보너스 점수 없이 기존 항목 점수로 대결하게 돼요.",
        image: '/images/characters/char_dog/face_money.png',
    },
    {
        number: '5',
        title: '점수 반영 안내',
        desc: "• 대결 보너스 점수는 결과에만 쓰이며 실제 윤택지수 리포트 점수엔 포함되지 않아요.\n• 대결에서 최종 승리하면 500포인트를 받아요!",
        image: '/images/characters/char_dog/fly.png',
    },
];

const defaultPreviewProfile = {
    name: '김윤택',
    id: 'yuntaek123',
    image: '/images/characters/char_dog/face_basic.png',
};

export default function BattleSearchPage() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [currentGuideSlide, setCurrentGuideSlide] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchedUsers, setSearchedUsers] = useState([]);
    const [selectedUserId, setSelectedUserId] = useState(null);
    const [selectedCategory, setSelectedCategory] = useState(null);

    const currentScreen =
        searchParams.get('screen') ||
        (searchParams.get('preview') === 'received' ? 'received' : 'intro');
    const previewProfile = {
        name: searchParams.get('name') || defaultPreviewProfile.name,
        id: searchParams.get('id') || defaultPreviewProfile.id,
        image: defaultPreviewProfile.image,
    };
    const previewDisplayName = previewProfile.name.endsWith('님')
        ? previewProfile.name
        : `${previewProfile.name}님`;

    const moveToScreen = (screen, options = {}) => {
        const {
            name,
            id,
            clearPreview = false,
            resetGuide = false,
        } = options;
        const params = new URLSearchParams(searchParams.toString());

        params.set('screen', screen);
        params.delete('preview');

        if (clearPreview) {
            params.delete('name');
            params.delete('id');
        }

        if (name) {
            params.set('name', name);
        }

        if (id) {
            params.set('id', id);
        }

        if (resetGuide) {
            setCurrentGuideSlide(0);
        }

        router.replace(`/challenge-battle/search?${params.toString()}`);
    };

    const handleSearch = () => {
        if (!searchQuery.trim()) {
            return;
        }

        if (searchQuery === '김윤택') {
            setSearchedUsers([
                {
                    name: '김윤택',
                    id: 'yuntaek123',
                    age: 28,
                },
            ]);
            return;
        }

        setSearchedUsers([
            {
                name: `${searchQuery}님`,
                id: `user_${Math.floor(Math.random() * 10000)}`,
                age: Math.floor(Math.random() * 15) + 20,
            },
        ]);
    };

    const handleApplyBattle = () => {
        if (searchedUsers.length === 0 || !selectedUserId) {
            alert('먼저 대결할 친구를 검색하고 선택해주세요.');
            return;
        }

        if (!selectedCategory) {
            alert('대결할 항목을 선택해주세요.');
            return;
        }

        const selectedUser = searchedUsers.find((user) => user.id === selectedUserId);
        moveToScreen('sent', {
            name: selectedUser?.name || '친구',
            id: selectedUser?.id || 'battle_user',
        });
    };

    const animationStyles = (
        <style jsx global>{`
            @keyframes battleFloat {
                0%, 100% {
                    transform: translateY(0px);
                }
                50% {
                    transform: translateY(-10px);
                }
            }

            @keyframes fadeInUp {
                from {
                    opacity: 0;
                    transform: translateY(12px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            @keyframes fadeIn {
                from {
                    opacity: 0;
                    transform: translateY(8px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
        `}</style>
    );

    if (currentScreen === 'intro') {
        return (
            <>
                <div style={{ ...styles.container, overflow: 'hidden' }}>
                    <div style={styles.introContent}>
                        <h2 style={styles.introTitle}>
                            친구와 함께
                            <br />
                            윤택지수 대결을 하고
                            <br />
                            포인트를 얻어봐요.
                        </h2>
                    </div>
                    <div style={styles.introBottom}>
                        <button
                            type="button"
                            style={styles.introTextBtn}
                            onClick={() => moveToScreen('selection', { clearPreview: true })}
                        >
                            괜찮아요
                        </button>
                        <button
                            type="button"
                            style={styles.introPrimaryBtn}
                            onClick={() => moveToScreen('guide', { clearPreview: true, resetGuide: true })}
                        >
                            설명보기
                        </button>
                    </div>
                </div>
                {animationStyles}
            </>
        );
    }

    if (currentScreen === 'guide') {
        const slide = guideSlides[currentGuideSlide];

        return (
            <>
                <div style={{ ...styles.container, overflow: 'hidden' }}>
                    <div style={styles.segmentedProgressContainer}>
                        {guideSlides.map((_, index) => (
                            <div key={index} style={styles.segmentBackground}>
                                <div
                                    style={{
                                        ...styles.segmentFill,
                                        width: index <= currentGuideSlide ? '100%' : '0%',
                                        transition: 'width 0.3s ease',
                                    }}
                                />
                            </div>
                        ))}
                    </div>

                    <div style={styles.guideContent}>
                        <h2 style={styles.tossTitle}>{slide.title}</h2>
                        <div style={styles.tossDesc}>
                            {slide.desc.split('\n').map((line, index) => (
                                <p key={`${line}-${index}`} style={{ margin: '0.4rem 0' }}>
                                    {line}
                                </p>
                            ))}
                        </div>

                        <div style={styles.guideImageFixedContainer}>
                            <img src={slide.image} alt="Step visual" style={styles.guideImage} />
                        </div>
                    </div>

                    <div style={styles.guideFloatingBottom}>
                        <div style={styles.guideBottomControls}>
                            {currentGuideSlide > 0 ? (
                                <button
                                    type="button"
                                    style={styles.tossPrevBtn}
                                    onClick={() => setCurrentGuideSlide((prev) => prev - 1)}
                                >
                                    이전
                                </button>
                            ) : (
                                <div style={{ width: '80px' }} />
                            )}

                            {currentGuideSlide < guideSlides.length - 1 ? (
                                <button
                                    type="button"
                                    style={styles.tossNextBtn}
                                    onClick={() => setCurrentGuideSlide((prev) => prev + 1)}
                                >
                                    다음
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    style={styles.tossNextBtn}
                                    onClick={() => moveToScreen('selection', { clearPreview: true })}
                                >
                                    대결 시작
                                </button>
                            )}
                        </div>
                    </div>
                </div>
                {animationStyles}
            </>
        );
    }

    if (currentScreen === 'sent' || currentScreen === 'received') {
        const isReceivedScreen = currentScreen === 'received';

        return (
            <>
                <div style={{ ...styles.container, overflow: 'hidden' }}>
                    <div style={styles.previewContent}>
                        <div style={styles.previewTabs}>
                            {[
                                { id: 'sent', label: '신청 후 화면' },
                                { id: 'received', label: '신청 받은 화면' },
                            ].map((tab) => {
                                const isActive = currentScreen === tab.id;

                                return (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        style={{
                                            ...styles.previewTab,
                                            ...(isActive ? styles.previewTabActive : {}),
                                        }}
                                        onClick={() =>
                                            moveToScreen(tab.id, {
                                                name: previewProfile.name,
                                                id: previewProfile.id,
                                            })
                                        }
                                    >
                                        {tab.label}
                                    </button>
                                );
                            })}
                        </div>

                        <span style={styles.previewBadge}>
                            {isReceivedScreen ? '받은 신청' : '신청 완료'}
                        </span>

                        <div style={styles.previewTitleBlock}>
                            <div style={styles.previewTitleLine}>
                                <span style={styles.previewTitleName}>{previewDisplayName}</span>
                                <span style={styles.previewTitleText}>
                                    {isReceivedScreen
                                        ? '이 윤택지수 대결을 신청했어요.'
                                        : '에게 윤택지수 대결을 신청했어요.'}
                                </span>
                            </div>
                            <p style={styles.previewSubtitle}>
                                {isReceivedScreen
                                    ? '승낙해 대결을 시작해보세요.'
                                    : '친구가 승낙하면 대결이 시작돼요.'}
                            </p>
                        </div>

                        <div style={styles.previewProfileCard}>
                            <div style={styles.previewProfileImageWrap}>
                                <img
                                    src={previewProfile.image}
                                    alt={`${previewProfile.name} 프로필`}
                                    style={styles.previewProfileImage}
                                />
                            </div>
                            <div style={styles.previewProfileText}>
                                <span style={styles.previewProfileLabel}>
                                    {isReceivedScreen ? '신청한 사용자' : '대결 상대'}
                                </span>
                                <strong style={styles.previewProfileName}>{previewProfile.name}</strong>
                                <span style={styles.previewProfileId}>ID: {previewProfile.id}</span>
                            </div>
                        </div>
                    </div>

                    <div style={styles.introBottom}>
                        {isReceivedScreen && (
                            <button
                                type="button"
                                style={styles.introTextBtn}
                                onClick={() => moveToScreen('intro', { clearPreview: true, resetGuide: true })}
                            >
                                거절하기
                            </button>
                        )}
                        <button
                            type="button"
                            style={styles.introPrimaryBtn}
                            onClick={() => {
                                if (isReceivedScreen) {
                                    router.push('/challenge-battle/progress');
                                    return;
                                }

                                moveToScreen('selection', { clearPreview: true });
                            }}
                        >
                            {isReceivedScreen ? '승낙하기' : '취소하기'}
                        </button>
                    </div>
                </div>
                {animationStyles}
            </>
        );
    }

    return (
        <>
            <div style={styles.container}>
                <div style={styles.content}>
                    <h2 style={styles.mainInstructionLine}>대결 상대를 검색해 선택해주세요.</h2>

                    <div style={styles.searchSection}>
                        <div style={styles.searchBar}>
                            <Search size={20} color="var(--text-guide)" style={styles.searchIcon} />
                            <input
                                type="text"
                                placeholder="사용자명 혹은 이메일 검색"
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                                onKeyDown={(event) => event.key === 'Enter' && handleSearch()}
                                style={styles.searchInput}
                            />
                            <button type="button" onClick={handleSearch} style={styles.searchButton}>
                                검색
                            </button>
                        </div>

                        {searchedUsers.length > 0 && (
                            <div style={styles.userList}>
                                {searchedUsers.map((user) => {
                                    const isSelected = selectedUserId === user.id;

                                    return (
                                        <div
                                            key={user.id}
                                            style={{
                                                ...styles.userCard,
                                                borderColor: isSelected ? 'var(--primary)' : 'transparent',
                                                backgroundColor: isSelected ? '#f0fdfa' : 'white',
                                            }}
                                        >
                                            <div style={styles.userInfo}>
                                                <div style={styles.userIconWrapper}>
                                                    <User
                                                        size={24}
                                                        color={isSelected ? 'var(--primary)' : 'var(--text-sub)'}
                                                    />
                                                </div>
                                                <div style={styles.userDetails}>
                                                    <span style={styles.userName}>{user.name}</span>
                                                    <span style={styles.userMeta}>ID: {user.id}</span>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                style={{
                                                    ...styles.selectButton,
                                                    ...(isSelected ? styles.selectButtonActive : {}),
                                                }}
                                                onClick={() =>
                                                    setSelectedUserId((prev) => (prev === user.id ? null : user.id))
                                                }
                                            >
                                                {isSelected ? '선택됨' : '선택'}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div
                        style={{
                            ...styles.categorySection,
                            ...(!selectedUserId ? styles.blurredSection : {}),
                        }}
                    >
                        <h2 style={styles.mainInstructionLine}>대결 항목 선택해주세요.</h2>
                        <div style={styles.categoryGrid}>
                            {categories.map((category) => (
                                <button
                                    key={category.id}
                                    type="button"
                                    style={{
                                        ...styles.categoryButton,
                                        ...(selectedCategory === category.id
                                            ? styles.categoryButtonSelected
                                            : {}),
                                    }}
                                    onClick={() =>
                                        setSelectedCategory((prev) =>
                                            prev === category.id ? null : category.id
                                        )
                                    }
                                >
                                    {category.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div style={styles.bottomFixedArea}>
                    <button
                        type="button"
                        style={{
                            ...styles.applyButton,
                            background:
                                !selectedUserId || !selectedCategory ? '#cbd5e1' : 'var(--primary)',
                            boxShadow:
                                !selectedUserId || !selectedCategory
                                    ? 'none'
                                    : '0 4px 12px rgba(20, 184, 166, 0.3)',
                        }}
                        onClick={handleApplyBattle}
                        disabled={!selectedUserId || !selectedCategory}
                    >
                        대결 신청
                    </button>
                </div>
            </div>
            {animationStyles}
        </>
    );
}

const styles = {
    container: {
        background: 'var(--background-light, #f1f5f9)',
        height: '100vh',
        overflow: 'hidden',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
    },
    content: {
        flex: 1,
        overflowY: 'auto',
        paddingTop: '1.5rem',
        paddingRight: '1.5rem',
        paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))',
        paddingLeft: '1.5rem',
    },
    mainInstructionLine: {
        fontSize: '1.25rem',
        fontWeight: '700',
        color: 'var(--text-main)',
        marginBottom: '1.5rem',
        marginTop: '0.5rem',
        lineHeight: 1.4,
    },
    introContent: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'flex-start',
        paddingTop: '1.5rem',
        paddingRight: '2rem',
        paddingBottom: '1.5rem',
        paddingLeft: '2rem',
        textAlign: 'left',
    },
    introTitle: {
        fontSize: '1.8rem',
        fontWeight: '800',
        lineHeight: 1.4,
        marginTop: '1rem',
        background: 'linear-gradient(135deg, #10b981, #3b82f6)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        letterSpacing: '-1px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        filter: 'drop-shadow(0 2px 4px rgba(16, 185, 129, 0.1))',
    },
    previewContent: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'flex-start',
        paddingTop: '1.5rem',
        paddingRight: '1.5rem',
        paddingBottom: '1.5rem',
        paddingLeft: '1.5rem',
        gap: '1.1rem',
    },
    previewBadge: {
        display: 'inline-flex',
        alignItems: 'center',
        padding: '0.45rem 0.85rem',
        borderRadius: '999px',
        background: 'rgba(16, 185, 129, 0.12)',
        color: 'var(--primary)',
        fontSize: '0.8rem',
        fontWeight: '700',
        marginTop: '0.5rem',
    },
    previewTabs: {
        display: 'flex',
        gap: '0.5rem',
        width: '100%',
        marginTop: '0.5rem',
    },
    previewTab: {
        flex: 1,
        border: 'none',
        borderRadius: '999px',
        padding: '0.7rem 0.9rem',
        background: 'rgba(148, 163, 184, 0.12)',
        color: 'var(--text-sub)',
        fontSize: '0.85rem',
        fontWeight: '700',
        cursor: 'pointer',
    },
    previewTabActive: {
        background: 'rgba(16, 185, 129, 0.14)',
        color: 'var(--primary)',
    },
    previewTitleBlock: {
        display: 'flex',
        flexDirection: 'column',
        gap: '0.6rem',
    },
    previewTitleLine: {
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'flex-end',
        gap: '0.2rem',
        lineHeight: 1.25,
    },
    previewTitleName: {
        fontSize: '2.1rem',
        fontWeight: '900',
        letterSpacing: '-0.04em',
        background: 'linear-gradient(135deg, #10b981, #3b82f6)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        filter: 'drop-shadow(0 2px 4px rgba(16, 185, 129, 0.1))',
    },
    previewTitleText: {
        fontSize: '1.1rem',
        fontWeight: '700',
        background: 'linear-gradient(135deg, #10b981, #3b82f6)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        paddingBottom: '0.18rem',
    },
    previewSubtitle: {
        margin: 0,
        fontSize: '1rem',
        fontWeight: '600',
        color: 'var(--text-sub)',
        lineHeight: 1.5,
    },
    previewProfileCard: {
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        background: 'linear-gradient(145deg, #ffffff, #f8fffd)',
        borderRadius: '24px',
        padding: '1.1rem 1.2rem',
        boxShadow: '0 18px 40px rgba(15, 23, 42, 0.12)',
        animation: 'battleFloat 3.2s ease-in-out infinite',
    },
    previewProfileImageWrap: {
        width: '72px',
        height: '72px',
        borderRadius: '22px',
        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.18), rgba(59, 130, 246, 0.18))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        flexShrink: 0,
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.8)',
    },
    previewProfileImage: {
        width: '60px',
        height: '60px',
        objectFit: 'contain',
    },
    previewProfileText: {
        display: 'flex',
        flexDirection: 'column',
        gap: '0.2rem',
    },
    previewProfileLabel: {
        fontSize: '0.78rem',
        fontWeight: '700',
        color: 'var(--text-guide)',
    },
    previewProfileName: {
        fontSize: '1.15rem',
        color: 'var(--text-main)',
    },
    previewProfileId: {
        fontSize: '0.9rem',
        color: 'var(--text-sub)',
    },
    introBottom: {
        position: 'fixed',
        bottom: 'calc(100px + env(safe-area-inset-bottom, 0px))',
        left: '0',
        right: '0',
        margin: '0 auto',
        width: '100%',
        maxWidth: '340px',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        zIndex: 100,
    },
    introPrimaryBtn: {
        background: 'var(--primary)',
        color: 'white',
        border: 'none',
        padding: '1.2rem',
        borderRadius: '16px',
        fontSize: '1.05rem',
        fontWeight: '700',
        cursor: 'pointer',
        boxShadow: '0 4px 12px rgba(20, 184, 166, 0.2)',
    },
    introTextBtn: {
        background: 'transparent',
        color: 'var(--text-sub)',
        border: 'none',
        padding: '0.8rem',
        fontSize: '0.95rem',
        fontWeight: '500',
        cursor: 'pointer',
        textAlign: 'center',
    },
    segmentedProgressContainer: {
        display: 'flex',
        gap: '4px',
        padding: '0.5rem 1.5rem',
    },
    segmentBackground: {
        flex: 1,
        height: '4px',
        background: '#e2e8f0',
        borderRadius: '2px',
        overflow: 'hidden',
    },
    segmentFill: {
        height: '100%',
        background: 'var(--primary)',
        width: '0%',
    },
    guideContent: {
        flex: 1,
        paddingTop: '0',
        paddingRight: '1.5rem',
        paddingBottom: '0',
        paddingLeft: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
    },
    guideImageFixedContainer: {
        width: '220px',
        height: '220px',
        marginTop: 'auto',
        marginBottom: '25rem',
        alignSelf: 'center',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    guideImage: {
        maxWidth: '100%',
        maxHeight: '100%',
        objectFit: 'contain',
        animation: 'fadeInUp 0.5s ease-out forwards',
    },
    tossTitle: {
        fontSize: '1.8rem',
        fontWeight: '800',
        color: '#1a1a1a',
        marginTop: '1.5rem',
        marginBottom: '1.5rem',
        lineHeight: 1.4,
        wordBreak: 'keep-all',
        animation: 'fadeIn 0.3s ease-out forwards',
    },
    tossDesc: {
        fontSize: '1rem',
        color: '#1a1a1a',
        lineHeight: 1.6,
        fontWeight: '500',
        textAlign: 'left',
        width: '100%',
        animation: 'fadeIn 0.4s ease-out forwards',
    },
    guideFloatingBottom: {
        position: 'fixed',
        bottom: 'calc(110px + env(safe-area-inset-bottom, 0px))',
        left: '0',
        right: '0',
        margin: '0 auto',
        maxWidth: '480px',
        padding: '0 2.5rem',
        zIndex: 100,
    },
    guideBottomControls: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    tossPrevBtn: {
        background: 'var(--background-light, #f1f5f9)',
        color: 'var(--text-sub)',
        border: 'none',
        padding: '0.8rem 1.5rem',
        borderRadius: '8px',
        fontSize: '0.95rem',
        fontWeight: '600',
        cursor: 'pointer',
    },
    tossNextBtn: {
        background: 'var(--primary)',
        color: 'white',
        border: 'none',
        padding: '0.8rem 1.5rem',
        borderRadius: '8px',
        fontSize: '0.95rem',
        fontWeight: '600',
        cursor: 'pointer',
        boxShadow: '0 4px 12px rgba(20, 184, 166, 0.2)',
    },
    searchSection: {
        marginBottom: '2rem',
    },
    searchBar: {
        display: 'flex',
        alignItems: 'center',
        background: 'white',
        borderRadius: 'var(--radius-md)',
        padding: '0.5rem 0.5rem 0.5rem 1rem',
        boxShadow: 'var(--shadow-sm)',
        marginBottom: '1rem',
    },
    searchIcon: {
        marginRight: '0.5rem',
    },
    searchInput: {
        flex: 1,
        border: 'none',
        outline: 'none',
        fontSize: '0.95rem',
        color: 'var(--text-main)',
        background: 'transparent',
    },
    searchButton: {
        background: 'var(--primary)',
        color: 'white',
        border: 'none',
        padding: '0.5rem 1rem',
        borderRadius: '8px',
        fontWeight: '600',
        fontSize: '0.9rem',
        cursor: 'pointer',
    },
    userList: {
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
    },
    userCard: {
        background: 'white',
        borderRadius: 'var(--radius-md)',
        padding: '1rem',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        animation: 'fadeInUp 0.3s ease-out forwards',
        border: '1px solid transparent',
        transition: 'all 0.2s ease',
    },
    userInfo: {
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
    },
    userIconWrapper: {
        width: '44px',
        height: '44px',
        borderRadius: '50%',
        background: '#f1f5f9',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    userDetails: {
        display: 'flex',
        flexDirection: 'column',
    },
    userName: {
        fontSize: '1.05rem',
        fontWeight: '600',
        color: 'var(--text-main)',
    },
    userMeta: {
        fontSize: '0.85rem',
        color: 'var(--text-guide)',
    },
    selectButton: {
        background: 'white',
        color: 'var(--text-sub)',
        border: '1px solid #cbd5e1',
        padding: '6px 12px',
        borderRadius: '16px',
        fontSize: '0.85rem',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'all 0.2s',
    },
    selectButtonActive: {
        background: 'var(--primary)',
        color: 'white',
        border: '1px solid var(--primary)',
    },
    categorySection: {
        marginTop: '1.5rem',
        marginBottom: '2rem',
        transition: 'all 0.3s ease',
    },
    categoryGrid: {
        display: 'flex',
        flexDirection: 'column',
        gap: '0.8rem',
    },
    categoryButton: {
        width: '100%',
        padding: '1.25rem 1.5rem',
        borderRadius: '16px',
        border: '1px solid #f1f5f9',
        background: 'white',
        color: '#1a1a1a',
        fontSize: '1.05rem',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        textAlign: 'left',
        boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
    },
    categoryButtonSelected: {
        background: '#f0fdfa',
        border: '1px solid var(--primary)',
        boxShadow: '0 4px 12px rgba(20, 184, 166, 0.1)',
        color: 'var(--primary)',
    },
    bottomFixedArea: {
        position: 'fixed',
        bottom: 'calc(95px + env(safe-area-inset-bottom, 0px))',
        left: '0',
        right: '0',
        margin: '0 auto',
        width: '100%',
        maxWidth: '430px',
        padding: '0 1.5rem',
        zIndex: 100,
        transition: 'all 0.3s ease',
    },
    blurredSection: {
        filter: 'blur(4px)',
        opacity: 0.5,
        pointerEvents: 'none',
        userSelect: 'none',
    },
    applyButton: {
        width: '100%',
        background: 'var(--primary)',
        color: 'white',
        border: 'none',
        borderRadius: 'var(--radius-lg)',
        padding: '1.25rem',
        fontSize: '1.1rem',
        fontWeight: '700',
        cursor: 'pointer',
        boxShadow: '0 4px 12px rgba(20, 184, 166, 0.3)',
        transition: 'all 0.2s ease',
    },
};

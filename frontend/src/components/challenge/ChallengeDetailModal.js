/**
 * [파일 역할]
 * - 챌린지 상세 모달 컴포넌트
 * - 챌린지 카드 클릭 시 표시되는 팝업
 * - 새로운 UserChallenge 모델에 맞게 progress 객체 처리
 * - 난이도별 두둑 캐릭터 얼굴 아이콘 표시
 * - 히어로 섹션(난이도별 그라데이션) + 글래스 모피즘 + 카드형 레이아웃
 */
import { useState, useRef } from 'react';
import { X, Camera, Image, ChevronDown, Star, Calendar, TrendingUp, CheckCircle, Sparkles } from 'lucide-react';
import { CATEGORIES, getCategoryIcon } from '../common/CategoryIcons';
import { useAuth } from '@/contexts/AuthContext';
import {
    getCharacterFace,
} from '@/lib/challengeUtils';
import { useChallenge } from './useChallenge';
import { getDifficultyStyle } from '@/lib/challengeUtils';



export default function ChallengeDetailModal({
    challenge,
    onClose,
    onStart,
    onRetry,
    onCancel,
    onDelete,
    onPhotoUpload,
    // Edit specific props
    isEditing = false,
    onTitleChange,
    onDescriptionChange,
    customFooter
}) {
    const { user } = useAuth();
    const characterType = user?.character_type || 'ham';

    const [inputValues, setInputValues] = useState({});
    const [openCategorySelect, setOpenCategorySelect] = useState(null);
    const fileInputRef = useRef(null);

    // 공통 훅 사용
    const {
        isActive,
        isFailed,
        isCompleted,
        progressData,
    } = useChallenge(challenge);

    if (!challenge) return null;

    const handleFileSelect = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            alert(`선택된 파일: ${file.name}\n(실제 업로드 기능은 준비 중입니다)`);
            onPhotoUpload?.(challenge, file);
        }
        e.target.value = '';
    };

    const handleCameraClick = () => {
        if (fileInputRef.current) {
            fileInputRef.current.setAttribute('capture', 'environment');
            fileInputRef.current.click();
        }
    };

    const handleGalleryClick = () => {
        if (fileInputRef.current) {
            fileInputRef.current.removeAttribute('capture');
            fileInputRef.current.click();
        }
    };

    const handleOverlayClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    // 남은 일수 계산
    const getDaysLeft = () => {
        if (challenge.daysLeft !== undefined) return challenge.daysLeft;
        if (challenge.remainingDays !== undefined) return challenge.remainingDays;
        return challenge.durationDays || challenge.duration || 7;
    };

    // 진행률 퍼센트
    const getProgressPercent = () => {
        if (progressData.percentage !== undefined) return Math.round(progressData.percentage);
        return 0;
    };

    return (
        <div
            style={styles.overlay}
            onClick={handleOverlayClick}
            onTouchMove={(e) => e.target === e.currentTarget && e.preventDefault()}
        >
            <div style={styles.modal}>
                {/* 닫기 버튼 (우측 상단 고정) */}
                <button style={styles.closeButton} onClick={onClose}>
                    <X size={24} color="#374151" />
                </button>

                {/* 히어로 섹션 - 배경 고정 */}
                <div style={{
                    ...styles.heroSection,
                    backgroundColor: getDifficultyStyle(challenge.difficulty)?.backgroundColor || '#F3F4F6',
                }}>
                    {/* 캐릭터 - 글래스 모피즘 원형 */}
                    <div style={styles.characterCircle}>
                        <div style={styles.characterInner}>
                            <img
                                src={getCharacterFace(challenge.difficulty, characterType)}
                                alt="character"
                                style={styles.characterImage}
                            />
                        </div>
                    </div>
                </div>

                {/* 스크롤 가능한 콘텐츠 영역 */}
                <div style={styles.scrollContent}>
                    {/* 흰색 콘텐츠 카드 */}
                    <div style={styles.contentCard}>

                        {/* 타이틀 */}
                        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                            {isEditing ? (
                                <input
                                    type="text"
                                    style={styles.editingTitleInput}
                                    value={challenge.title}
                                    onChange={(e) => onTitleChange && onTitleChange(e.target.value)}
                                    placeholder="챌린지 제목"
                                />
                            ) : (
                                <h1 style={styles.title}>{challenge.title}</h1>
                            )}
                        </div>

                        {/* 보상 & 기한 - 원형 아이콘 디자인 */}
                        <div style={styles.infoCirclesRow}>
                            {/* 포인트 */}
                            <div style={styles.infoCircleItem}>
                                <div style={{ ...styles.infoCircle, ...styles.infoCirclePoints }}>
                                    <Star size={20} color="#3B82F6" />
                                </div>
                                <span style={{ ...styles.infoCircleText, ...styles.infoCircleTextPoints }}>
                                    {(challenge.progressType === 'random_budget' ||
                                        challenge.displayConfig?.progress_type === 'random_budget' ||
                                        challenge.successConditions?.type === 'random_budget') &&
                                        (challenge.points === 0 || challenge.points === undefined || challenge.points === null)
                                        ? '???P'
                                        : `${challenge.points || challenge.basePoints || 0}P`}
                                </span>
                            </div>

                            {/* 기간 */}
                            <div style={styles.infoCircleItem}>
                                <div style={{ ...styles.infoCircle, ...styles.infoCirclePeriod }}>
                                    <Calendar size={20} color="#F43F5E" />
                                </div>
                                <span style={{ ...styles.infoCircleText, ...styles.infoCircleTextPeriod }}>
                                    D-{getDaysLeft()}
                                </span>
                            </div>
                        </div>

                        {/* 진행 상황 섹션 (진행중인 챌린지만) */}
                        {isActive && progressData.percentage !== undefined && (
                            <div style={styles.progressCard}>
                                <div style={styles.progressHeader}>
                                    <div style={styles.progressLabel}>
                                        <TrendingUp size={16} color="var(--primary)" />
                                        <span>진행 상황</span>
                                    </div>
                                    <span style={styles.progressPercent}>{getProgressPercent()}%</span>
                                </div>
                                <div style={styles.progressBar}>
                                    <div style={{
                                        ...styles.progressFill,
                                        width: `${Math.min(100, getProgressPercent())}%`,
                                    }} />
                                </div>
                            </div>
                        )}

                        {/* 설명 섹션 */}
                        <div style={styles.sectionBlock}>
                            <div style={styles.sectionHeader}>
                                <span style={styles.sectionHeaderBar} />
                                <span style={styles.sectionHeaderText}>설명</span>
                            </div>
                            {isEditing ? (
                                <textarea
                                    style={styles.editingDescriptionInput}
                                    value={challenge.description || ''}
                                    onChange={(e) => onDescriptionChange && onDescriptionChange(e.target.value)}
                                    placeholder="챌린지 설명"
                                    rows={3}
                                />
                            ) : (
                                <p style={styles.sectionText}>
                                    {challenge.description || challenge.successDescription || '이 챌린지에 대한 상세 설명이 없습니다.'}
                                </p>
                            )}
                        </div>

                        {/* 성공 조건 섹션 */}
                        {(() => {
                            const conditions =
                                (Array.isArray(challenge.successDescription) && challenge.successDescription.length > 0)
                                    ? challenge.successDescription
                                    : challenge.displayConfig?.success_conditions_display || challenge.display_config?.success_conditions_display;
                            const hasConditions = conditions && conditions.length > 0;
                            const showCard = hasConditions || (challenge.requiresPhoto && challenge.photoDescription);

                            if (!showCard) return null;

                            return (
                                <div style={styles.sectionBlock}>
                                    <div style={styles.sectionHeader}>
                                        <span style={styles.sectionHeaderBar} />
                                        <span style={styles.sectionHeaderText}>성공 조건</span>
                                    </div>
                                    {hasConditions ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                            {conditions.map((cond, idx) => (
                                                <div
                                                    key={idx}
                                                    style={{
                                                        ...styles.goalCardOther,
                                                        backgroundColor: 'transparent',
                                                        padding: '4px 0',
                                                        border: 'none',
                                                        gap: '12px'
                                                    }}
                                                >
                                                    <div style={{
                                                        width: '24px',
                                                        height: '24px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        flexShrink: 0
                                                    }}>
                                                        <svg
                                                            width="24"
                                                            height="24"
                                                            viewBox="0 0 24 24"
                                                            fill="none"
                                                            xmlns="http://www.w3.org/2000/svg"
                                                        >
                                                            <path
                                                                d="M12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3C7.02944 3 3 7.02944 3 12C3 16.9706 7.02944 21 12 21Z"
                                                                stroke="#FF5F1F"
                                                                strokeWidth="2.5"
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                            />
                                                            <path
                                                                d="M8.5 12.5L11 15L16 9"
                                                                stroke="#FF5F1F"
                                                                strokeWidth="2.5"
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                            />
                                                        </svg>
                                                    </div>
                                                    <div style={{ flex: 1 }}>
                                                        <span style={styles.sectionText}>{cond}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : null}
                                    {challenge.requiresPhoto && challenge.photoDescription && (
                                        <p style={{
                                            ...styles.sectionText,
                                            marginTop: (hasConditions || challenge.successDescription) ? '8px' : '0',
                                            color: 'var(--primary)',
                                            fontWeight: '500'
                                        }}>
                                            📷 {challenge.photoDescription}
                                        </p>
                                    )}
                                </div>
                            );
                        })()}

                        {/* 무00의 날 챌린지: 요일별 금지 카테고리 선택 UI */}
                        {!isActive && !isFailed && !isCompleted && challenge.userInputs && challenge.userInputs.some(i => i.key === 'mon_forbidden') && (
                            (() => {
                                const days = [
                                    { key: 'mon_forbidden', label: '월' },
                                    { key: 'tue_forbidden', label: '화' },
                                    { key: 'wed_forbidden', label: '수' },
                                    { key: 'thu_forbidden', label: '목' },
                                    { key: 'ai_1', label: '?' },
                                    { key: 'ai_2', label: '?' },
                                    { key: 'ai_3', label: '?' },
                                ];

                                const [selectedDayTab, setSelectedDayTab] = useState('mon_forbidden');

                                return (
                                    <div style={styles.inputSection}>
                                        <label style={{ ...styles.inputLabel, marginBottom: '12px' }}>
                                            요일별 금지 카테고리 <span style={styles.requiredMark}>*</span>
                                        </label>

                                        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', justifyContent: 'space-between' }}>
                                            {days.map((day) => {
                                                const isSelected = selectedDayTab === day.key;
                                                const isAI = day.label === '?';
                                                const hasValue = !isAI && inputValues[day.key];

                                                return (
                                                    <button
                                                        key={day.key}
                                                        type="button"
                                                        disabled={isAI}
                                                        onClick={() => !isAI && setSelectedDayTab(day.key)}
                                                        style={{
                                                            width: '40px',
                                                            height: '40px',
                                                            borderRadius: '12px',
                                                            border: 'none',
                                                            backgroundColor: isSelected
                                                                ? 'var(--primary)'
                                                                : (hasValue ? '#D1FAE5' : (isAI ? '#E5E7EB' : '#F3F4F6')),
                                                            color: isSelected
                                                                ? 'white'
                                                                : (hasValue ? 'var(--primary)' : (isAI ? '#9CA3AF' : '#4B5563')),
                                                            fontSize: '0.9rem',
                                                            fontWeight: '600',
                                                            cursor: isAI ? 'default' : 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            transition: 'all 0.2s ease',
                                                            boxShadow: isSelected ? '0 4px 6px rgba(16, 185, 129, 0.2)' : 'none',
                                                            transform: isSelected ? 'translateY(-2px)' : 'none',
                                                        }}
                                                    >
                                                        {day.label}
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        <div style={{ animation: 'fadeIn 0.3s ease' }}>
                                            <div style={{
                                                fontSize: '0.9rem',
                                                fontWeight: '600',
                                                marginBottom: '8px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px'
                                            }}>
                                                <span style={{ color: 'var(--primary)' }}>
                                                    {days.find(d => d.key === selectedDayTab)?.label}요일
                                                </span>
                                                <span style={{ color: '#6B7280', fontWeight: '400' }}>금지 카테고리 선택</span>
                                            </div>

                                            <div style={styles.categorySelectContainer}>
                                                <button
                                                    type="button"
                                                    style={styles.categorySelectButton}
                                                    onClick={() => setOpenCategorySelect(openCategorySelect === selectedDayTab ? null : selectedDayTab)}
                                                >
                                                    <span style={inputValues[selectedDayTab] ? styles.categorySelectedText : styles.categoryPlaceholder}>
                                                        {inputValues[selectedDayTab] ? (
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                {getCategoryIcon(inputValues[selectedDayTab], 16)}
                                                                <span>{inputValues[selectedDayTab]}</span>
                                                            </div>
                                                        ) : '카테고리 선택'}
                                                    </span>
                                                    <ChevronDown size={16} style={{ transform: openCategorySelect === selectedDayTab ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
                                                </button>

                                                {openCategorySelect === selectedDayTab && (
                                                    <div style={styles.categoryDropdown}>
                                                        {CATEGORIES.map((cat) => (
                                                            <button
                                                                key={cat}
                                                                type="button"
                                                                style={{
                                                                    ...styles.categoryOption,
                                                                    backgroundColor: inputValues[selectedDayTab] === cat ? '#F0FDF4' : 'transparent',
                                                                }}
                                                                onClick={() => {
                                                                    setInputValues({ ...inputValues, [selectedDayTab]: cat });
                                                                    setOpenCategorySelect(null);
                                                                }}
                                                            >
                                                                {getCategoryIcon(cat, 16)}
                                                                <span>{cat}</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            <div style={{
                                                fontSize: '0.8rem',
                                                color: '#9CA3AF',
                                                marginTop: '8px',
                                                textAlign: 'center'
                                            }}>
                                                나머지 3일은 AI가 랜덤으로 지정해요!
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()
                        )}

                        {/* 사용자 입력 필드 (미시작 챌린지) */}
                        {!isActive && !isFailed && !isCompleted && challenge.userInputs &&
                            challenge.userInputs.filter(input => !['mon_forbidden', 'tue_forbidden', 'wed_forbidden', 'thu_forbidden'].includes(input.key)).length > 0 && (
                                <div style={styles.inputSection}>
                                    {challenge.userInputs
                                        .filter(input => !['mon_forbidden', 'tue_forbidden', 'wed_forbidden', 'thu_forbidden'].includes(input.key))
                                        .map((input) => (
                                            <div key={input.key} style={styles.inputGroup}>
                                                <label style={styles.inputLabel}>
                                                    {input.label}
                                                    {input.required && <span style={styles.requiredMark}>*</span>}
                                                </label>
                                                {input.type === 'select' ? (
                                                    <select
                                                        style={styles.inputField}
                                                        value={inputValues[input.key] || ''}
                                                        onChange={(e) => setInputValues({ ...inputValues, [input.key]: e.target.value })}
                                                    >
                                                        <option value="">선택해주세요</option>
                                                        {input.options.map((opt) => (
                                                            <option key={opt} value={opt}>{opt}주차</option>
                                                        ))}
                                                    </select>
                                                ) : input.type === 'category_select' ? (
                                                    <div style={styles.categorySelectContainer}>
                                                        <button
                                                            type="button"
                                                            style={styles.categorySelectButton}
                                                            onClick={() => setOpenCategorySelect(openCategorySelect === input.key ? null : input.key)}
                                                        >
                                                            <span style={inputValues[input.key] ? styles.categorySelectedText : styles.categoryPlaceholder}>
                                                                {inputValues[input.key] || '카테고리 선택'}
                                                            </span>
                                                            <ChevronDown size={16} style={{ transform: openCategorySelect === input.key ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
                                                        </button>
                                                        {openCategorySelect === input.key && (
                                                            <div style={styles.categoryDropdown}>
                                                                {CATEGORIES.map((cat) => (
                                                                    <button
                                                                        key={cat}
                                                                        type="button"
                                                                        style={{
                                                                            ...styles.categoryOption,
                                                                            backgroundColor: inputValues[input.key] === cat ? '#F0FDF4' : 'transparent',
                                                                        }}
                                                                        onClick={() => {
                                                                            setInputValues({ ...inputValues, [input.key]: cat });
                                                                            setOpenCategorySelect(null);
                                                                        }}
                                                                    >
                                                                        {getCategoryIcon(cat, 16)}
                                                                        <span>{cat}</span>
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <input
                                                        type={input.type === 'number' ? 'number' : 'text'}
                                                        className={input.type === 'number' ? 'no-spinner' : ''}
                                                        style={styles.inputField}
                                                        placeholder={input.description}
                                                        value={inputValues[input.key] || ''}
                                                        onChange={(e) => setInputValues({ ...inputValues, [input.key]: e.target.value })}
                                                    />
                                                )}
                                            </div>
                                        ))}
                                </div>
                            )}

                        {/* 완료 정보 */}
                        {isCompleted && (
                            <div style={styles.completedInfo}>
                                🎉 챌린지 완료! +{challenge.earnedPoints || 0}P 획득
                                {challenge.bonusEarned && ' (보너스 포함)'}
                            </div>
                        )}
                    </div>
                </div>

                {/* 하단 버튼 영역 */}
                <div style={styles.buttonSection}>
                    {customFooter ? (
                        customFooter
                    ) : (
                        <>
                            {/* 미시작 첼린지 */}
                            {!isActive && !isFailed && !isCompleted && (
                                <div style={styles.buttonRow}>
                                    {(challenge.sourceType === 'custom' || challenge.sourceType === 'ai') && (
                                        <button
                                            style={styles.deleteButton}
                                            onClick={() => {
                                                if (window.confirm('정말로 이 챌린지를 삭제하시겠습니까?')) {
                                                    onDelete?.(challenge);
                                                    onClose();
                                                }
                                            }}
                                        >
                                            삭제
                                        </button>
                                    )}
                                    <button
                                        style={{
                                            ...styles.startButton,
                                            flex: (challenge.sourceType === 'custom' || challenge.sourceType === 'ai') ? 2 : 1,
                                        }}
                                        onClick={() => {
                                            if (challenge.userInputs) {
                                                for (const input of challenge.userInputs) {
                                                    if (input.required && !inputValues[input.key]) {
                                                        alert(`${input.label}을(를) 입력해주세요.`);
                                                        return;
                                                    }
                                                }
                                            }
                                            onStart?.(challenge, inputValues);
                                            onClose();
                                        }}
                                    >
                                        도전
                                    </button>
                                </div>
                            )}

                            {/* 실패 챌린지 */}
                            {isFailed && (
                                <button
                                    style={styles.retryButton}
                                    onClick={() => {
                                        onRetry?.(challenge);
                                        onClose();
                                    }}
                                >
                                    다시 도전하기
                                </button>
                            )}

                            {/* 진행중 챌린지 */}
                            {isActive && (
                                <>
                                    <button
                                        style={styles.cancelButton}
                                        onClick={() => {
                                            if (window.confirm('정말로 챌린지를 중단하시겠습니까?')) {
                                                onCancel?.(challenge);
                                                onClose();
                                            }
                                        }}
                                    >
                                        중단하기
                                    </button>
                                    {challenge.requiresPhoto && (
                                        <>
                                            <input
                                                type="file"
                                                ref={fileInputRef}
                                                style={{ display: 'none' }}
                                                accept="image/*"
                                                onChange={handleFileSelect}
                                            />
                                            <div style={styles.photoButtonRow}>
                                                <button style={styles.cameraButton} onClick={handleCameraClick}>
                                                    <Camera size={18} />
                                                    <span>카메라</span>
                                                </button>
                                                <button style={styles.galleryButton} onClick={handleGalleryClick}>
                                                    <Image size={18} />
                                                    <span>갤러리</span>
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </>
                            )}

                            {/* 완료 챌린지 */}
                            {isCompleted && (
                                <button style={styles.completedButton} disabled>
                                    완료됨
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

const styles = {
    overlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem',
        overflowY: 'auto',
        overscrollBehavior: 'contain',
    },
    modal: {
        background: '#FFFFFF',
        borderRadius: '24px',
        width: '100%',
        maxWidth: '390px',
        maxHeight: '85vh',
        overflow: 'hidden',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
    },
    scrollContent: {
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden',
        padding: 0,
        paddingTop: '200px',
        position: 'relative',
        zIndex: 1,
    },

    // ── 히어로 섹션 ──
    heroSection: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '240px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 0,
        paddingBottom: '40px',
    },
    closeButton: {
        position: 'absolute',
        top: '16px',
        right: '16px',
        background: 'rgba(255, 255, 255, 0.5)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        border: 'none',
        borderRadius: '50%',
        width: '36px',
        height: '36px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        zIndex: 50,
        transition: 'background 0.2s',
    },
    characterCircle: {
        width: '130px',
        height: '130px',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(255, 255, 255, 0.4)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.3)',
        boxShadow: '0 0 30px rgba(255, 255, 255, 0.6)',
        padding: '8px',
        transform: 'translateY(-10px)',
    },
    characterInner: {
        width: '100%',
        height: '100%',
        borderRadius: '50%',
        overflow: 'hidden',
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    characterImage: {
        width: '85%',
        height: '85%',
        objectFit: 'contain',
    },

    // ── 콘텐츠 카드 ──
    contentCard: {
        position: 'relative',
        backgroundColor: '#FFFFFF',
        borderRadius: '32px 32px 0 0',
        padding: '32px 24px 24px 24px',
        minHeight: '100%',
        boxShadow: '0 -4px 20px rgba(0,0,0,0.05)',
    },

    // ── 타이틀 ──
    title: {
        fontSize: '1.4rem',
        fontWeight: '700',
        color: 'var(--text-main)',
        textAlign: 'center',
        letterSpacing: '-0.025em',
        margin: 0,
    },
    editingTitleInput: {
        width: '100%',
        fontSize: '1.4rem',
        fontWeight: '700',
        color: 'var(--text-main)',
        textAlign: 'center',
        letterSpacing: '-0.025em',
        padding: '8px',
        border: '1px solid #EF4444',
        borderRadius: '8px',
        outline: 'none',
        backgroundColor: '#FFF',
    },
    editingDescriptionInput: {
        width: '100%',
        fontSize: '0.9rem',
        lineHeight: '1.5',
        color: 'var(--text-sub)',
        padding: '8px',
        border: '1px solid #EF4444',
        borderRadius: '8px',
        outline: 'none',
        backgroundColor: '#FFF',
        resize: 'none',
        minHeight: '80px',
        fontFamily: 'inherit',
    },

    // ── 정보 원형 (포인트/기간) ──
    infoCirclesRow: {
        display: 'flex',
        justifyContent: 'center',
        gap: '20px',
        marginBottom: '24px',
    },
    infoCircleItem: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '6px',
    },
    infoCircle: {
        width: '52px',
        height: '52px',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1px solid rgba(255, 255, 255, 0.5)',
        boxShadow: '0 4px 10px -2px rgba(0, 0, 0, 0.05), inset 0 -2px 4px rgba(0, 0, 0, 0.05)',
    },
    infoCirclePoints: {
        backgroundColor: 'rgba(239, 246, 255, 0.5)',
    },
    infoCirclePeriod: {
        backgroundColor: 'rgba(255, 241, 242, 0.5)',
    },
    infoCircleText: {
        fontSize: '11px',
        fontWeight: '700',
        letterSpacing: '-0.025em',
    },
    infoCircleTextPoints: {
        color: 'rgba(37, 99, 235, 0.7)',
    },
    infoCircleTextPeriod: {
        color: 'rgba(244, 63, 94, 0.7)',
    },

    // ── 진행 상황 ──
    progressCard: {
        backgroundColor: '#F9FAFB',
        borderRadius: '24px',
        padding: '20px',
        marginBottom: '24px',
    },
    progressHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '12px',
    },
    progressLabel: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '0.9rem',
        fontWeight: '600',
        color: 'var(--text-main)',
    },
    progressPercent: {
        fontSize: '1.1rem',
        fontWeight: '700',
        color: 'var(--primary)',
    },
    progressBar: {
        width: '100%',
        height: '10px',
        backgroundColor: '#E2E8F0',
        borderRadius: '5px',
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: 'var(--primary)',
        borderRadius: '5px',
        transition: 'width 0.3s ease',
    },

    // ── 섹션 헤더 ──
    sectionBlock: {
        marginBottom: '32px',
    },
    sectionHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '16px',
    },
    sectionHeaderBar: {
        width: '24px',
        height: '4px',
        backgroundColor: '#FF5F1F',
        borderRadius: '9999px',
    },
    sectionHeaderText: {
        fontSize: '12px',
        fontWeight: '700',
        color: '#FF5F1F',
        letterSpacing: '0.2em',
    },
    sectionText: {
        fontSize: '15px',
        lineHeight: '1.6',
        color: 'var(--text-sub)',
        fontWeight: '400',
        margin: 0,
    },

    // ── 성공 조건 Step 카드 ──
    goalCardFirst: {
        position: 'relative',
        padding: '20px',
        borderRadius: '32px',
        display: 'flex',
        alignItems: 'center',
        gap: '20px',
        overflow: 'hidden',
    },
    goalCardOther: {
        position: 'relative',
        padding: '20px',
        borderRadius: '32px',
        backgroundColor: '#FAFAFA',
        display: 'flex',
        alignItems: 'center',
        gap: '20px',
    },
    sparkleIcon: {
        position: 'absolute',
        top: '12px',
        right: '16px',
        opacity: 0.6,
    },
    checkCircle: {
        width: '48px',
        height: '48px',
        backgroundColor: '#7fd1c1ff',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        boxShadow: '0 2px 8px rgba(127, 209, 193, 0.3)',
    },
    goalTitle: {
        fontWeight: '600',
        color: '#27272A',
        fontSize: '14px',
    },

    // ── 입력 섹션 ──
    inputSection: {
        backgroundColor: '#FAFAFA',
        borderRadius: '24px',
        padding: '20px',
        marginBottom: '16px',
    },
    inputGroup: {
        marginBottom: '12px',
    },
    inputLabel: {
        display: 'block',
        fontSize: '12px',
        fontWeight: '700',
        color: '#A1A1AA',
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        marginBottom: '8px',
        marginLeft: '4px',
    },
    requiredMark: {
        color: '#FF5F1F',
        marginLeft: '2px',
    },
    inputField: {
        width: '100%',
        padding: '16px 20px',
        borderRadius: '16px',
        border: 'none',
        fontSize: '0.9rem',
        backgroundColor: '#F3F4F6',
    },
    categorySelectContainer: {
        position: 'relative',
    },
    categorySelectButton: {
        width: '100%',
        padding: '16px 20px',
        borderRadius: '16px',
        border: 'none',
        fontSize: '0.9rem',
        backgroundColor: '#F3F4F6',
        cursor: 'pointer',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    categoryPlaceholder: {
        color: '#9CA3AF',
    },
    categorySelectedText: {
        color: 'var(--text-main)',
    },
    categoryDropdown: {
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        maxHeight: '180px',
        overflowY: 'auto',
        backgroundColor: 'white',
        border: '1px solid #E5E7EB',
        borderRadius: '16px',
        marginTop: '4px',
        zIndex: 100,
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    },
    categoryOption: {
        width: '100%',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        border: 'none',
        cursor: 'pointer',
        fontSize: '0.85rem',
        transition: 'background-color 0.2s',
    },

    // ── 상태 정보 ──
    failedInfo: {
        fontSize: '0.9rem',
        color: '#EF4444',
        backgroundColor: '#FEE2E2',
        padding: '12px 16px',
        borderRadius: '16px',
        marginBottom: '12px',
        textAlign: 'center',
    },
    completedInfo: {
        fontSize: '0.9rem',
        color: 'var(--primary)',
        backgroundColor: 'rgba(47, 133, 90, 0.1)',
        padding: '12px 16px',
        borderRadius: '16px',
        marginBottom: '12px',
        textAlign: 'center',
    },

    // ── 하단 버튼 영역 (현재 유지) ──
    buttonSection: {
        padding: '1rem 1.5rem',
        paddingTop: '0.5rem',
        backgroundColor: 'transparent',
    },
    buttonRow: {
        display: 'flex',
        gap: '10px',
    },
    startButton: {
        flex: 2,
        padding: '14px',
        borderRadius: '12px',
        backgroundColor: 'var(--primary)',
        color: 'white',
        border: 'none',
        fontSize: '1rem',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
    },
    deleteButton: {
        flex: 1,
        padding: '14px',
        borderRadius: '12px',
        backgroundColor: '#FEE2E2',
        color: '#DC2626',
        border: 'none',
        fontSize: '1rem',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
    },
    retryButton: {
        width: '100%',
        padding: '14px',
        borderRadius: '12px',
        backgroundColor: '#EF4444',
        color: 'white',
        border: 'none',
        fontSize: '1rem',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
    },
    cancelButton: {
        width: '100%',
        padding: '14px',
        borderRadius: '12px',
        backgroundColor: '#FEE2E2',
        color: '#DC2626',
        border: 'none',
        fontSize: '1rem',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        marginBottom: '10px',
    },
    photoButtonRow: {
        display: 'flex',
        gap: '8px',
    },
    cameraButton: {
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        padding: '12px',
        borderRadius: '12px',
        backgroundColor: '#7fd1c1ff',
        color: 'white',
        border: 'none',
        fontSize: '0.9rem',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
    },
    galleryButton: {
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        padding: '12px',
        borderRadius: '12px',
        backgroundColor: '#7fd1c1ff',
        color: 'white',
        border: 'none',
        fontSize: '0.9rem',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
    },
    completedButton: {
        width: '100%',
        padding: '14px',
        borderRadius: '12px',
        backgroundColor: '#9CA3AF',
        color: 'white',
        border: 'none',
        fontSize: '1rem',
        fontWeight: '600',
        cursor: 'not-allowed',
    },
};

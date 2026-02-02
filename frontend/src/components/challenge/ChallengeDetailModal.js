/**
 * [파일 역할]
 * - 챌린지 상세 모달 컴포넌트
 * - 챌린지 카드 클릭 시 표시되는 팝업
 * - 새로운 UserChallenge 모델에 맞게 progress 객체 처리
 * - 난이도별 두둑 캐릭터 얼굴 아이콘 표시
 * - 참고 UI 기반 재설계: 그라데이션 배경, 비스듬한 난이도 배지, 카드형 레이아웃
 */
import { useState, useRef } from 'react';
import { X, Clock, Camera, Image, ChevronDown, Trophy, TrendingUp, FileText, Target, CheckCircle } from 'lucide-react';
import { CATEGORIES, getCategoryIcon } from '../common/CategoryIcons';
import { useAuth } from '@/contexts/AuthContext';
import {
    getDifficultyLabel,
    getDifficultyStyle,
    getCharacterFace,
} from '@/lib/challengeUtils';
import { useChallenge } from './useChallenge';

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
            // 실제 구현 시 파일 업로드 로직 추가
            alert(`선택된 파일: ${file.name}\n(실제 업로드 기능은 준비 중입니다)`);
            onPhotoUpload?.(challenge, file);
        }
        // 같은 파일 다시 선택 가능하도록 초기화
        e.target.value = '';
    };

    const handleCameraClick = () => {
        // 카메라 캡처 모드로 파일 입력 열기
        if (fileInputRef.current) {
            fileInputRef.current.setAttribute('capture', 'environment');
            fileInputRef.current.click();
        }
    };

    const handleGalleryClick = () => {
        // 갤러리 모드로 파일 입력 열기
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

    // 난이도별 배지 배경색
    const getDifficultyBadgeColor = (difficulty) => {
        const d = (difficulty || '').toLowerCase();
        switch (d) {
            case 'easy': return { bg: '#10B981', text: '#FFFFFF' };
            case 'normal':
            case 'medium': return { bg: '#F59E0B', text: '#FFFFFF' };
            case 'hard': return { bg: '#EF4444', text: '#FFFFFF' };
            default: return { bg: '#6B7280', text: '#FFFFFF' };
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

    const badgeColors = getDifficultyBadgeColor(challenge.difficultyRaw || challenge.difficulty);

    return (
        <div
            style={styles.overlay}
            onClick={handleOverlayClick}
            onTouchMove={(e) => e.target === e.currentTarget && e.preventDefault()}
        >
            <div style={styles.modal}>
                {/* 닫기 버튼 */}
                <button style={styles.closeButton} onClick={onClose}>
                    <X size={20} color="#6B7280" />
                </button>

                {/* 스크롤 가능한 콘텐츠 영역 */}
                <div style={styles.scrollContent}>
                    {/* 캐릭터 + 난이도 배지 영역 */}
                    <div style={styles.characterSection}>
                        <div style={styles.characterWrapper}>
                            {/* 캐릭터 배경 */}
                            <div style={styles.characterBackground}>
                                <img
                                    src={getCharacterFace(challenge.difficulty, characterType)}
                                    alt="character"
                                    style={styles.characterImage}
                                />
                            </div>
                            {/* 비스듬한 난이도 배지 */}
                            <div style={{
                                ...styles.diagonalBadge,
                                backgroundColor: badgeColors.bg,
                                color: badgeColors.text,
                            }}>
                                {getDifficultyLabel(challenge.difficulty)}
                            </div>
                        </div>
                    </div>

                    {/* 타이틀 */}
                    {isEditing ? (
                        <input
                            type="text"
                            style={styles.editingTitleInput}
                            value={challenge.title}
                            onChange={(e) => onTitleChange && onTitleChange(e.target.value)}
                            placeholder="챌린지 제목"
                        />
                    ) : (
                        <h2 style={styles.title}>{challenge.title}</h2>
                    )}


                    {/* 보상 & 기한 카드 */}
                    <div style={styles.infoCardsRow}>
                        {/* 보상 카드 */}
                        <div style={styles.infoCard}>
                            <div style={styles.infoCardLeft}>
                                <Trophy size={18} color="var(--primary)" />
                                <span style={styles.infoCardLabel}>보상</span>
                            </div>
                            <span style={styles.infoCardValue}>
                                {(challenge.progressType === 'random_budget' ||
                                    challenge.displayConfig?.progress_type === 'random_budget' ||
                                    challenge.successConditions?.type === 'random_budget') &&
                                    (challenge.points === 0 || challenge.points === undefined || challenge.points === null)
                                    ? '???'
                                    : (challenge.points || challenge.basePoints || 0)}P
                            </span>
                        </div>

                        {/* 기한 카드 */}
                        <div style={styles.infoCard}>
                            <div style={styles.infoCardLeft}>
                                <Clock size={18} color="#F59E0B" />
                                <span style={styles.infoCardLabel}>기한</span>
                            </div>
                            <span style={styles.infoCardValue}>D-{getDaysLeft()}</span>
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

                    {/* 설명 카드 */}
                    <div style={styles.descriptionCard}>
                        <div style={styles.cardAccent} />
                        <div style={styles.cardContent}>
                            <div style={styles.cardHeader}>
                                <FileText size={16} color="var(--primary)" />
                                <span>설명</span>
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
                                <p style={styles.cardText}>
                                    {challenge.description || challenge.successDescription || '이 챌린지에 대한 상세 설명이 없습니다.'}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* 달성 조건 카드 */}
                    {(() => {
                        const conditions = challenge.displayConfig?.success_conditions_display || challenge.display_config?.success_conditions_display;
                        const hasConditions = conditions && conditions.length > 0;
                        const showCard = hasConditions || challenge.successDescription || (challenge.requiresPhoto && challenge.photoDescription);

                        if (!showCard) return null;

                        return (
                            <div style={styles.descriptionCard}>
                                <div style={styles.cardAccent} />
                                <div style={styles.cardContent}>
                                    <div style={styles.cardHeader}>
                                        <Target size={16} color="var(--primary)" />
                                        <span>달성 조건</span>
                                    </div>
                                    {hasConditions ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                                            {conditions.map((cond, idx) => (
                                                <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                                                    <CheckCircle size={16} color="var(--primary)" style={{ marginTop: '2px', flexShrink: 0 }} />
                                                    <span style={{ ...styles.cardText, margin: 0 }}>{cond}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        challenge.successDescription && (
                                            <p style={styles.cardText}>{challenge.successDescription}</p>
                                        )
                                    )}
                                    {challenge.requiresPhoto && challenge.photoDescription && (
                                        <p style={{
                                            ...styles.cardText,
                                            marginTop: (hasConditions || challenge.successDescription) ? '8px' : '0',
                                            color: 'var(--primary)',
                                            fontWeight: '500'
                                        }}>
                                            📷 {challenge.photoDescription}
                                        </p>
                                    )}
                                </div>
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

                            // 현재 선택된 요일 탭 (기본값: 월요일)
                            const [selectedDayTab, setSelectedDayTab] = useState('mon_forbidden');

                            return (
                                <div style={styles.inputSection}>
                                    <label style={{ ...styles.inputLabel, marginBottom: '12px' }}>
                                        요일별 금지 카테고리 <span style={styles.requiredMark}>*</span>
                                    </label>

                                    {/* 요일 선택 탭 */}
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

                                    {/* 선택된 요일의 카테고리 선택 */}
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
                                            {/* 숨겨진 파일 입력 */}
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
        background: 'linear-gradient(180deg, #FFFFFF 0%, #E6F5EE 100%)',
        borderRadius: '24px',
        width: '100%',
        maxWidth: '360px',
        maxHeight: '90vh',
        overflow: 'hidden',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
    },
    closeButton: {
        position: 'absolute',
        top: '12px',
        right: '12px',
        background: 'rgba(255,255,255,0.9)',
        border: 'none',
        borderRadius: '50%',
        width: '32px',
        height: '32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        zIndex: 10,
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    },
    scrollContent: {
        flex: 1,
        overflowY: 'auto',
        padding: '1.5rem',
        paddingBottom: '0.5rem',
    },
    characterSection: {
        display: 'flex',
        justifyContent: 'center',
        marginBottom: '16px',
    },
    characterWrapper: {
        position: 'relative',
        display: 'inline-block',
    },
    characterBackground: {
        width: '100px',
        height: '100px',
        borderRadius: '20px',
        backgroundColor: '#FEF3C7',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    },
    characterImage: {
        width: '80%',
        height: '80%',
        objectFit: 'contain',
    },
    diagonalBadge: {
        position: 'absolute',
        top: '-8px',
        right: '-12px',
        padding: '4px 12px',
        borderRadius: '8px',
        fontSize: '0.7rem',
        fontWeight: '700',
        transform: 'rotate(15deg)',
        boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
    },
    title: {
        fontSize: '1.4rem',
        fontWeight: '700',
        color: 'var(--text-main)',
        textAlign: 'center',
        marginBottom: '20px',
    },
    editingTitleInput: {
        width: '100%',
        fontSize: '1.4rem',
        fontWeight: '700',
        color: 'var(--text-main)',
        textAlign: 'center',
        marginBottom: '20px',
        padding: '8px',
        border: '1px solid #EF4444',
        borderRadius: '8px',
        outline: 'none',
        backgroundColor: '#FFF',
    },
    editingDescriptionInput: {
        width: '100%',
        fontSize: '0.85rem',
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
    infoCardsRow: {
        display: 'flex',
        gap: '12px',
        marginBottom: '16px',
    },
    infoCard: {
        flex: 1,
        backgroundColor: 'white',
        borderRadius: '16px',
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        border: '1px solid #E5E7EB',
    },
    infoCardLeft: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    },
    infoCardLabel: {
        fontSize: '0.85rem',
        color: 'var(--text-sub)',
        fontWeight: '500',
    },
    infoCardValue: {
        fontSize: '1.2rem',
        fontWeight: '700',
        color: 'var(--primary)',
    },
    progressCard: {
        backgroundColor: 'white',
        borderRadius: '16px',
        padding: '16px',
        marginBottom: '16px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
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
    descriptionCard: {
        display: 'flex',
        backgroundColor: 'white',
        borderRadius: '16px',
        overflow: 'hidden',
        marginBottom: '12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
    },
    cardAccent: {
        width: '4px',
        backgroundColor: 'var(--primary)',
        flexShrink: 0,
    },
    cardContent: {
        flex: 1,
        padding: '14px 16px',
    },
    cardHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '0.9rem',
        fontWeight: '600',
        color: 'var(--text-main)',
        marginBottom: '8px',
    },
    cardText: {
        fontSize: '0.85rem',
        lineHeight: '1.5',
        color: 'var(--text-sub)',
        margin: 0,
    },
    conditionCard: {
        backgroundColor: 'white',
        borderRadius: '16px',
        padding: '14px 16px',
        marginBottom: '12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
    },
    inputSection: {
        backgroundColor: 'white',
        borderRadius: '16px',
        padding: '16px',
        marginBottom: '12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
    },
    inputGroup: {
        marginBottom: '12px',
    },
    inputLabel: {
        display: 'block',
        fontSize: '0.85rem',
        fontWeight: '600',
        color: 'var(--text-main)',
        marginBottom: '6px',
    },
    requiredMark: {
        color: '#EF4444',
        marginLeft: '2px',
    },
    inputField: {
        width: '100%',
        padding: '10px 12px',
        borderRadius: '8px',
        border: '1px solid #E5E7EB',
        fontSize: '0.9rem',
        backgroundColor: '#F9FAFB',
    },
    categorySelectContainer: {
        position: 'relative',
    },
    categorySelectButton: {
        width: '100%',
        padding: '10px 12px',
        borderRadius: '8px',
        border: '1px solid #E5E7EB',
        fontSize: '0.9rem',
        backgroundColor: '#F9FAFB',
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
        borderRadius: '8px',
        marginTop: '4px',
        zIndex: 100,
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    },
    categoryOption: {
        width: '100%',
        padding: '10px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        border: 'none',
        cursor: 'pointer',
        fontSize: '0.85rem',
        transition: 'background-color 0.2s',
    },
    failedInfo: {
        fontSize: '0.9rem',
        color: '#EF4444',
        backgroundColor: '#FEE2E2',
        padding: '12px 16px',
        borderRadius: '12px',
        marginBottom: '12px',
        textAlign: 'center',
    },
    completedInfo: {
        fontSize: '0.9rem',
        color: 'var(--primary)',
        backgroundColor: 'rgba(47, 133, 90, 0.1)',
        padding: '12px 16px',
        borderRadius: '12px',
        marginBottom: '12px',
        textAlign: 'center',
    },
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

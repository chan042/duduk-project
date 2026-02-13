/**
 * [파일 역할]
 * - 챌린지 상세 모달 컴포넌트
 * - 챌린지 카드 클릭 시 표시되는 팝업
 * - UserChallenge 모델에 맞게 progress 객체 처리
 */
import { useState, useRef, useEffect } from 'react';
import { X, Camera, Image, ChevronDown, Star, Calendar, TrendingUp, CheckCircle, Sparkles, AlertCircle } from 'lucide-react';
import { CATEGORIES, getCategoryIcon, CATEGORY_COLORS } from '../common/CategoryIcons'; // 카테고리별 아이콘 가져오기
import { getDifficultyLabel, getDifficultyStyle } from '@/lib/challengeUtils';
import { useAuth } from '@/contexts/AuthContext';
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
    const modalRef = useRef(null);

    // 공통 훅 사용
    const {
        isActive,
        isFailed,
        isCompleted,
        progressData,
    } = useChallenge(challenge);


    // 모달 외부 클릭 시 닫기
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (modalRef.current && !modalRef.current.contains(event.target)) {
                onClose();
            }
        };

        // Prevent background scrolling
        document.body.style.overflow = 'hidden';

        // 마운트 시 리스너 추가
        document.addEventListener('mousedown', handleClickOutside);

        return () => {
            // Restore background scrolling
            document.body.style.overflow = 'unset';
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [onClose]);

    if (!challenge) return null;

    const handleFileSelect = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            // alert(`선택된 파일: ${file.name}\n(실제 업로드 기능은 준비 중입니다)`);
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

    const uiColor = 'var(--primary)';

    return (
        <div style={styles.overlay}>
            <div style={styles.modal} ref={modalRef} className="animate-fade-in-up">

                <button style={styles.closeButton} onClick={onClose}>
                    <X size={24} color="#374151" />
                </button>

                {/* 2. Scrollable Content */}
                <div style={styles.scrollContent}>
                    <div style={styles.contentBody}>

                        {/* Title Area */}
                        <div style={styles.titleSection}>
                            {/* Difficulty Label */}
                            <div style={styles.difficultyContainer}>
                                <span style={{
                                    ...styles.difficultyBadge,
                                    ...getDifficultyStyle(challenge.difficulty)
                                }}>
                                    {getDifficultyLabel(challenge.difficulty)}
                                </span>
                            </div>

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

                        {/* Stats Row */}
                        <div style={styles.statsRow}>
                            <div style={styles.statItem}>
                                <div style={{ ...styles.statIconBox, backgroundColor: 'rgba(20, 184, 166, 0.1)' }}>
                                    <Star size={20} color="var(--primary)" fill="var(--primary)" />
                                </div>
                                <div style={styles.statTextBox}>
                                    <span style={styles.statLabel}>보상</span>
                                    <span style={{ ...styles.statValue, color: 'var(--primary)' }}>
                                        {(challenge.progressType === 'random_budget' ||
                                            challenge.displayConfig?.progress_type === 'random_budget' ||
                                            challenge.successConditions?.type === 'random_budget') &&
                                            (challenge.points === 0 || challenge.points === undefined || challenge.points === null)
                                            ? '???P'
                                            : `${challenge.points || challenge.basePoints || 0}P`}
                                    </span>
                                </div>
                            </div>
                            <div style={styles.statDivider} />
                            <div style={styles.statItem}>
                                <div style={{ ...styles.statIconBox, backgroundColor: 'rgba(20, 184, 166, 0.1)' }}>
                                    <Calendar size={20} color="var(--primary)" />
                                </div>
                                <div style={styles.statTextBox}>
                                    <span style={styles.statLabel}>기간</span>
                                    <span style={{ ...styles.statValue, color: 'var(--primary)' }}>
                                        {isActive ? `D-${getDaysLeft()}` : `${String(challenge.duration || 7).replace('일', '')}일`}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Progress Section (Active Only) */}
                        {isActive && progressData.percentage !== undefined && (
                            <div style={styles.progressSection}>
                                <div style={styles.progressHeader}>
                                    <span style={styles.sectionTitle}>현재 진행 상황</span>
                                    <span style={{ ...styles.progressPercent, color: uiColor }}>
                                        {getProgressPercent()}%
                                    </span>
                                </div>
                                <div style={styles.progressBarContainer}>
                                    <div style={{
                                        ...styles.progressBarFill,
                                        width: `${Math.min(100, getProgressPercent())}%`,
                                        background: uiColor
                                    }} />
                                </div>
                                <p style={styles.progressMessage}>
                                    목표 달성까지 조금만 더 힘내세요! 🔥
                                </p>
                            </div>
                        )}

                        {/* Description */}
                        <div style={styles.sectionContainer}>
                            <h3 style={styles.sectionTitle}>챌린지 설명</h3>
                            {isEditing ? (
                                <textarea
                                    style={styles.editingDescriptionInput}
                                    value={challenge.description || ''}
                                    onChange={(e) => onDescriptionChange && onDescriptionChange(e.target.value)}
                                    placeholder="챌린지 설명"
                                    rows={3}
                                />
                            ) : (
                                <p style={styles.descriptionText}>
                                    {challenge.description || challenge.successDescription || '이 챌린지에 대한 상세 설명이 없습니다.'}
                                </p>
                            )}
                        </div>

                        {/* Success Conditions */}
                        {(() => {
                            const conditions =
                                (Array.isArray(challenge.successDescription) && challenge.successDescription.length > 0)
                                    ? challenge.successDescription
                                    : challenge.displayConfig?.success_conditions_display || challenge.display_config?.success_conditions_display;
                            const hasConditions = conditions && conditions.length > 0;
                            const showCard = hasConditions || (challenge.requiresPhoto && challenge.photoDescription);

                            if (!showCard) return null;

                            return (
                                <div style={styles.sectionContainer}>
                                    <h3 style={styles.sectionTitle}>성공 조건</h3>
                                    <div style={styles.conditionBox}>
                                        {hasConditions && (
                                            <ul style={styles.conditionList}>
                                                {conditions.map((cond, idx) => (
                                                    <li key={idx} style={styles.conditionItem}>
                                                        <CheckCircle size={16} color={uiColor} style={{ flexShrink: 0, marginTop: '2px' }} />
                                                        <span>{cond}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                        {challenge.requiresPhoto && challenge.photoDescription && (
                                            <div style={styles.photoCondition}>
                                                <Camera size={16} color={uiColor} />
                                                <span style={{ color: uiColor, fontWeight: 500 }}>인증샷: {challenge.photoDescription}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        })()}

                        {/* User Inputs (Not Started) */}
                        {!isActive && !isFailed && !isCompleted && challenge.userInputs && challenge.userInputs.some(i => i.key === 'mon_forbidden') && (
                            <div style={styles.sectionContainer}>
                                <h3 style={styles.sectionTitle}>
                                    요일별 금지 카테고리 설정 <span style={styles.requiredMark}>*</span>
                                </h3>
                                {/* ... (Original implementation improved slightly with styles) ... */}
                                {/* Keeping existing logic but wrapping in new layout style */}
                                {(() => {
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
                                        <div style={styles.inputWrapper}>
                                            <div style={styles.dayTabs}>
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
                                                                    ? uiColor
                                                                    : (hasValue ? '#D1FAE5' : (isAI ? '#F3F4F6' : '#F9FAFB')),
                                                                color: isSelected
                                                                    ? 'white'
                                                                    : (hasValue ? uiColor : (isAI ? '#9CA3AF' : '#4B5563')),
                                                                fontSize: '0.9rem',
                                                                fontWeight: '600',
                                                                cursor: isAI ? 'default' : 'pointer',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                transition: 'all 0.2s ease',
                                                                boxShadow: isSelected ? '0 4px 6px -1px rgba(0,0,0,0.1)' : 'none',
                                                                transform: isSelected ? 'scale(1.05)' : 'scale(1)',
                                                            }}
                                                        >
                                                            {day.label}
                                                        </button>
                                                    );
                                                })}
                                            </div>

                                            <div style={styles.dayInputDetail}>
                                                <div style={styles.dayInputLabel}>
                                                    <span style={{ color: uiColor, fontWeight: '700' }}>
                                                        {days.find(d => d.key === selectedDayTab)?.label}요일
                                                    </span>
                                                    <span style={{ color: '#6B7280' }}>금지할 카테고리를 선택해주세요</span>
                                                </div>

                                                <div style={styles.categorySelectContainer}>
                                                    <button
                                                        type="button"
                                                        style={{ ...styles.categorySelectButton, borderColor: inputValues[selectedDayTab] ? uiColor : '#E5E7EB' }}
                                                        onClick={() => setOpenCategorySelect(openCategorySelect === selectedDayTab ? null : selectedDayTab)}
                                                    >
                                                        <span style={inputValues[selectedDayTab] ? styles.categorySelectedText : styles.categoryPlaceholder}>
                                                            {inputValues[selectedDayTab] ? (
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                    {getCategoryIcon(inputValues[selectedDayTab], 18)}
                                                                    <span>{inputValues[selectedDayTab]}</span>
                                                                </div>
                                                            ) : '카테고리 선택'}
                                                        </span>
                                                        <ChevronDown size={18} style={{ transform: openCategorySelect === selectedDayTab ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
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
                                                <div style={styles.aiHint}>
                                                    <Sparkles size={14} /> 나머지 3일은 AI가 랜덤으로 지정해요!
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })()}
                            </div>
                        )}

                        {/* Other User Inputs */}
                        {!isActive && !isFailed && !isCompleted && challenge.userInputs &&
                            challenge.userInputs.filter(input => !['mon_forbidden', 'tue_forbidden', 'wed_forbidden', 'thu_forbidden'].includes(input.key)).length > 0 && (
                                <div style={styles.sectionContainer}>
                                    <h3 style={styles.sectionTitle}>추가 설정</h3>
                                    <div style={styles.inputWrapper}>
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
                                </div>
                            )}

                        {/* Completed Info */}
                        {isCompleted && (
                            <div style={styles.completedBanner}>
                                <div style={styles.completedIcon}>🎉</div>
                                <div style={styles.completedText}>
                                    <div>챌린지 완주 성공!</div>
                                    <div style={styles.completedPoints}>+{challenge.earnedPoints || 0}P 획득</div>
                                </div>
                            </div>
                        )}

                    </div>
                    {/* Padding for Scroll */}
                    <div style={{ height: '100px' }}></div>
                </div>

                {/* 3. Button / Footer Section */}
                <div style={styles.footerStyles}>
                    {customFooter ? (
                        customFooter
                    ) : (
                        <>
                            {/* Not Started */}
                            {!isActive && !isFailed && !isCompleted && (
                                <div style={styles.buttonRow}>
                                    {(challenge.sourceType === 'custom' || challenge.sourceType === 'ai') && (
                                        <button
                                            style={styles.secondaryButton}
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
                                        style={{ ...styles.primaryButton, background: 'var(--primary)' }}
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
                                        도전하기
                                    </button>
                                </div>
                            )}

                            {/* Failed */}
                            {isFailed && (
                                <button
                                    style={{ ...styles.primaryButton, background: '#EF4444' }}
                                    onClick={() => {
                                        onRetry?.(challenge);
                                        onClose();
                                    }}
                                >
                                    다시 도전하기
                                </button>
                            )}

                            {/* Active */}
                            {isActive && (
                                <div style={styles.activeButtonContainer}>
                                    {challenge.requiresPhoto && (
                                        <>
                                            <input
                                                type="file"
                                                ref={fileInputRef}
                                                style={{ display: 'none' }}
                                                accept="image/*"
                                                onChange={handleFileSelect}
                                            />
                                            <div style={styles.photoActions}>
                                                <button style={styles.actionButton} onClick={handleCameraClick}>
                                                    <Camera size={20} color={uiColor} />
                                                    <span>촬영</span>
                                                </button>
                                                <button style={styles.actionButton} onClick={handleGalleryClick}>
                                                    <Image size={20} color={uiColor} />
                                                    <span>앨범</span>
                                                </button>
                                            </div>
                                        </>
                                    )}
                                    <button
                                        style={styles.textButton}
                                        onClick={() => {
                                            if (window.confirm('정말로 챌린지를 중단하시겠습니까?')) {
                                                onCancel?.(challenge);
                                                onClose();
                                            }
                                        }}
                                    >
                                        중단하기
                                    </button>
                                </div>
                            )}

                            {/* Completed */}
                            {isCompleted && (
                                <button style={styles.disabledButton} disabled>
                                    이미 완료된 챌린지입니다
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
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px',
        animation: 'fadeIn 0.2s ease-out',
    },
    modal: {
        backgroundColor: '#FFFFFF',
        width: '100%',
        maxWidth: '380px',
        height: '680px', // Fixed height for consistency
        maxHeight: '90vh',
        borderRadius: '28px',
        overflow: 'hidden',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    },

    // Header
    heroSection: {
        height: '140px',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    closeButton: {
        position: 'absolute',
        top: '16px',
        right: '16px',
        width: '32px',
        height: '32px',
        borderRadius: '50%',
        backgroundColor: '#F3F4F6',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 'none',
        cursor: 'pointer',
        zIndex: 10,
        transition: 'background-color 0.2s',
    },

    // Content
    scrollContent: {
        flex: 1,
        overflowY: 'auto',
        position: 'relative',
        backgroundColor: '#FFFFFF',
    },
    contentBody: {
        backgroundColor: '#FFFFFF',
        padding: '60px 24px 24px 24px',
        minHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '28px',
    },

    // Sections
    titleSection: {
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center', // Center align flex items
    },
    difficultyContainer: {
        marginBottom: '8px',
    },
    difficultyBadge: {
        padding: '4px 12px',
        borderRadius: '20px',
        fontSize: '0.85rem',
        fontWeight: '700',
        display: 'inline-block',
    },
    title: {
        fontSize: '1.6rem',
        fontWeight: '800',
        color: '#1F2937',
        lineHeight: '1.3',
        letterSpacing: '-0.02em',
        wordBreak: 'keep-all',
        margin: 0,
    },
    editingTitleInput: {
        width: '100%',
        fontSize: '1.5rem',
        fontWeight: '700',
        textAlign: 'center',
        padding: '8px',
        border: '1px solid #E5E7EB',
        borderRadius: '12px',
    },

    // Stats
    statsRow: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 20px',
        backgroundColor: '#F9FAFB',
        borderRadius: '20px',
        border: '1px solid #F3F4F6',
    },
    statItem: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        flex: 1,
        justifyContent: 'center',
    },
    statDivider: {
        width: '1px',
        height: '24px',
        backgroundColor: '#E5E7EB',
        margin: '0 8px',
    },
    statIconBox: {
        width: '36px',
        height: '36px',
        borderRadius: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    statTextBox: {
        display: 'flex',
        flexDirection: 'column',
    },
    statLabel: {
        fontSize: '0.8rem',
        color: '#6B7280',
        fontWeight: '500',
    },
    statValue: {
        fontSize: '1rem',
        fontWeight: '700',
    },

    // Progress
    progressSection: {
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
    },
    progressHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    progressPercent: {
        fontSize: '1.2rem',
        fontWeight: '800',
    },
    progressBarContainer: {
        height: '10px',
        backgroundColor: '#F3F4F6',
        borderRadius: '10px',
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        borderRadius: '10px',
        transition: 'width 0.5s ease-out',
    },
    progressMessage: {
        fontSize: '0.9rem',
        color: '#6B7280',
        textAlign: 'right',
        margin: 0,
    },

    // Generic Section
    sectionContainer: {
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
    },
    sectionTitle: {
        fontSize: '1rem',
        fontWeight: '700',
        color: '#374151',
        margin: 0,
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
    },
    descriptionText: {
        fontSize: '0.95rem',
        color: '#4B5563',
        lineHeight: '1.6',
        whiteSpace: 'pre-wrap',
        backgroundColor: '#F9FAFB',
        padding: '16px',
        borderRadius: '16px',
        margin: 0,
    },
    editingDescriptionInput: {
        width: '100%',
        padding: '12px',
        border: '1px solid #E5E7EB',
        borderRadius: '12px',
        fontSize: '0.95rem',
        resize: 'none',
    },

    // Conditions
    conditionBox: {
        backgroundColor: '#FFF',
        border: '1px solid #E5E7EB',
        borderRadius: '16px',
        padding: '16px',
    },
    conditionList: {
        listStyle: 'none',
        padding: 0,
        margin: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
    },
    conditionItem: {
        display: 'flex',
        gap: '10px',
        fontSize: '0.9rem',
        color: '#4B5563',
        lineHeight: '1.5',
    },
    photoCondition: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginTop: '12px',
        paddingTop: '12px',
        borderTop: '1px dashed #E5E7EB',
        fontSize: '0.9rem',
    },

    // Inputs
    inputWrapper: {
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
    },
    dayTabs: {
        display: 'flex',
        justifyContent: 'space-between',
        gap: '4px',
    },
    dayInputDetail: {
        backgroundColor: '#F8FAFC',
        borderRadius: '16px',
        padding: '16px',
        border: '1px solid #F1F5F9',
    },
    dayInputLabel: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '0.9rem',
        marginBottom: '12px',
    },
    categorySelectContainer: {
        position: 'relative',
    },
    categorySelectButton: {
        width: '100%',
        height: '48px',
        backgroundColor: '#FFFFFF',
        borderWidth: '1px',
        borderStyle: 'solid',
        borderRadius: '12px',
        padding: '0 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        cursor: 'pointer',
    },
    categoryPlaceholder: {
        color: '#9CA3AF',
    },
    categorySelectedText: {
        color: '#1F2937',
        fontWeight: '500',
    },
    categoryDropdown: {
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        backgroundColor: '#FFFFFF',
        borderRadius: '12px',
        boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
        marginTop: '4px',
        zIndex: 50,
        maxHeight: '200px',
        overflowY: 'auto',
        border: '1px solid #E5E7EB',
        padding: '4px',
    },
    categoryOption: {
        width: '100%',
        padding: '10px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '0.9rem',
        color: '#4B5563',
        transition: 'background-color 0.1s',
    },
    aiHint: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '4px',
        fontSize: '0.8rem',
        color: '#9CA3AF',
        marginTop: '12px',
    },
    inputGroup: {
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
    },
    inputLabel: {
        fontSize: '0.9rem',
        fontWeight: '600',
        color: '#374151',
    },
    requiredMark: {
        color: '#EF4444',
        marginLeft: '4px',
    },
    inputField: {
        width: '100%',
        height: '46px',
        borderRadius: '12px',
        border: '1px solid #E5E7EB',
        padding: '0 14px',
        fontSize: '0.95rem',
        outline: 'none',
    },

    // Completed
    completedBanner: {
        backgroundColor: '#ECFDF5',
        borderRadius: '16px',
        padding: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        border: '1px solid #10B981',
    },
    completedIcon: {
        fontSize: '2rem',
    },
    completedText: {
        display: 'flex',
        flexDirection: 'column',
    },
    completedPoints: {
        fontSize: '1.1rem',
        fontWeight: '800',
        color: '#059669',
    },

    // Footer
    footerStyles: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '20px',
        backgroundColor: '#FFFFFF',
        borderTop: '1px solid #F3F4F6',
        zIndex: 20,
    },
    buttonRow: {
        display: 'flex',
        gap: '12px',
    },
    primaryButton: {
        flex: 1,
        height: '56px',
        borderRadius: '16px',
        border: 'none',
        color: '#FFFFFF',
        fontSize: '1.1rem',
        fontWeight: '700',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        transition: 'transform 0.1s',
    },
    secondaryButton: {
        width: '80px',
        height: '56px',
        borderRadius: '16px',
        border: '1px solid #E5E7EB',
        backgroundColor: '#FFFFFF',
        color: '#6B7280',
        fontSize: '1rem',
        fontWeight: '600',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    activeButtonContainer: {
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
    },
    photoActions: {
        display: 'flex',
        gap: '12px',
    },
    actionButton: {
        flex: 1,
        height: '52px',
        borderRadius: '16px',
        border: '1px solid #E5E7EB',
        backgroundColor: '#FFFFFF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        fontSize: '1rem',
        fontWeight: '600',
        color: '#374151',
        cursor: 'pointer',
        boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    },
    textButton: {
        width: '100%',
        padding: '8px',
        backgroundColor: 'transparent',
        border: 'none',
        color: '#9CA3AF',
        fontSize: '0.9rem',
        textDecoration: 'underline',
        cursor: 'pointer',
    },
    disabledButton: {
        width: '100%',
        height: '56px',
        borderRadius: '16px',
        backgroundColor: '#F3F4F6',
        border: 'none',
        color: '#9CA3AF',
        fontSize: '1rem',
        fontWeight: '600',
        cursor: 'not-allowed',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
};

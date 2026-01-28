/**
 * [파일 역할]
 * - 챌린지 상세 모달 컴포넌트
 * - 챌린지 카드 클릭 시 표시되는 팝업
 * - 새로운 UserChallenge 모델에 맞게 progress 객체 처리
 */
import { useState, useRef } from 'react';
import { X, Sparkles, ShoppingCart, Utensils, Wallet, Coffee, MapPin, FileText, Target, Dumbbell, Zap, Clock, Camera, Image, ChevronDown } from 'lucide-react';
import { CATEGORIES, getCategoryIcon } from '../common/CategoryIcons';

// 아이콘 컴포넌트 매핑
const getIcon = (iconName, color) => {
    const iconProps = { size: 48, color };
    switch (iconName) {
        case 'shopping': return <ShoppingCart {...iconProps} />;
        case 'food': return <Utensils {...iconProps} />;
        case 'wallet': return <Wallet {...iconProps} />;
        case 'coffee': return <Coffee {...iconProps} />;
        case 'walk': return <MapPin {...iconProps} />;
        case 'document': return <FileText {...iconProps} />;
        case 'target': return <Target {...iconProps} />;
        case 'snack': return <Dumbbell {...iconProps} />;
        case 'sparkles': return <Sparkles {...iconProps} />;
        default: return <Zap {...iconProps} />;
    }
};

// 난이도 라벨 매핑
const getDifficultyLabel = (difficulty) => {
    const diffLower = difficulty?.toLowerCase();
    switch (diffLower) {
        case '쉬움':
        case 'easy':
            return 'EASY';
        case '보통':
        case 'medium':
            return 'MEDIUM';
        case '어려움':
        case 'hard':
            return 'HARD';
        default:
            return 'MEDIUM';
    }
};

// 난이도 배지 스타일
const getDifficultyStyle = (difficulty) => {
    const diffLower = difficulty?.toLowerCase();
    switch (diffLower) {
        case '쉬움':
        case 'easy':
            return { backgroundColor: '#DCFCE7', color: '#16A34A' };
        case '보통':
        case 'medium':
            return { backgroundColor: '#FEF3C7', color: '#EAB308' };
        case '어려움':
        case 'hard':
            return { backgroundColor: '#FEE2E2', color: '#DC2626' };
        default:
            return { backgroundColor: '#F3F4F6', color: '#6B7280' };
    }
};

// progress 객체에서 데이터 추출
const getProgressData = (progress) => {
    if (!progress) return { percentage: 0, type: null };
    if (typeof progress === 'number') return { percentage: progress, type: 'amount' };
    if (typeof progress === 'object') {
        return {
            percentage: progress.percentage || 0,
            type: progress.type || 'amount',
            current: progress.current,
            target: progress.target,
            checkedDays: progress.checked_days,
            totalDays: progress.total_days,
            isOnTrack: progress.is_on_track,
        };
    }
    return { percentage: 0, type: null };
};

export default function ChallengeDetailModal({ challenge, onClose, onStart, onRetry, onCancel, onPhotoUpload }) {
    const [inputValues, setInputValues] = useState({});
    const [openCategorySelect, setOpenCategorySelect] = useState(null);
    const fileInputRef = useRef(null);

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

    const progressData = getProgressData(challenge.progress || challenge.progressData);
    const isActive = challenge.status === 'active';
    const isFailed = challenge.status === 'failed' || challenge.failedDate;
    const isCompleted = challenge.status === 'completed';

    // 진행률 표시 텍스트
    const getProgressText = () => {
        if (progressData.type === 'amount' && progressData.current !== undefined) {
            return `${progressData.current?.toLocaleString() || 0}원 / ${progressData.target?.toLocaleString() || 0}원`;
        }
        if (progressData.type === 'daily_check') {
            return `${progressData.checkedDays || 0}일 / ${progressData.totalDays || 0}일 체크`;
        }
        return `${progressData.percentage?.toFixed(0) || 0}%`;
    };

    return (
        <div style={styles.overlay} onClick={handleOverlayClick}>
            <div style={styles.modal}>
                {/* 닫기 버튼 */}
                <button style={styles.closeButton} onClick={onClose}>
                    <X size={24} />
                </button>

                {/* 상단 아이콘 영역 */}
                <div style={{
                    ...styles.iconArea,
                    backgroundColor: challenge.color,
                }}>
                    <div style={styles.iconContainer}>
                        {getIcon(challenge.icon, challenge.iconColor)}
                    </div>
                </div>

                {/* 콘텐츠 영역 */}
                <div style={styles.content}>
                    {/* 난이도 배지 */}
                    <div style={{
                        ...styles.difficultyBadge,
                        ...getDifficultyStyle(challenge.difficulty),
                    }}>
                        {getDifficultyLabel(challenge.difficulty)}
                    </div>

                    {/* 타이틀 */}
                    <h2 style={styles.title}>{challenge.title}</h2>

                    {/* 포인트 & 기간 */}
                    <div style={styles.infoRow}>
                        <div style={styles.points}>
                            <span style={styles.pointsValue}>{challenge.points || challenge.basePoints || 0}</span>
                            <span style={styles.pointsLabel}>P</span>
                        </div>
                        {(challenge.duration || challenge.durationDays) && (
                            <div style={styles.duration}>
                                <Clock size={14} color="var(--text-sub)" />
                                <span>{challenge.duration || `${challenge.durationDays}일`}</span>
                            </div>
                        )}
                    </div>

                    {/* AI 추천 이유 */}
                    {challenge.aiReason && (
                        <div style={styles.aiReason}>
                            <Sparkles size={14} color="var(--primary)" />
                            <span>{challenge.aiReason}</span>
                        </div>
                    )}

                    {/* 설명 */}
                    <p style={styles.description}>
                        {challenge.description || challenge.successDescription || '이 챌린지에 대한 상세 설명이 없습니다.'}
                    </p>

                    {/* 사용자 입력 필드 (필수 입력값이 있는 경우) */}
                    {!isActive && !isFailed && !isCompleted && challenge.userInputs && challenge.userInputs.length > 0 && (
                        <div style={styles.inputSection}>
                            {challenge.userInputs.map((input) => (
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

                    {/* 성공 조건 설명 */}
                    {challenge.successDescription && challenge.description && (
                        <div style={styles.successCondition}>
                            <strong>성공 조건:</strong> {challenge.successDescription}
                        </div>
                    )}

                    {/* 진행률 (도전 중인 경우) */}
                    {isActive && progressData.percentage !== undefined && (
                        <div style={styles.progressSection}>
                            <div style={styles.progressHeader}>
                                <span>진행률</span>
                                <span>{getProgressText()}</span>
                            </div>
                            <div style={styles.progressBar}>
                                <div style={{
                                    ...styles.progressFill,
                                    width: `${Math.min(100, progressData.percentage)}%`,
                                }} />
                            </div>
                            {challenge.daysLeft !== undefined && (
                                <span style={styles.daysLeft}>{challenge.daysLeft}일 남음</span>
                            )}
                            {progressData.isOnTrack !== undefined && (
                                <span style={{
                                    ...styles.trackStatus,
                                    color: progressData.isOnTrack ? '#10B981' : '#EF4444'
                                }}>
                                    {progressData.isOnTrack ? '순조롭게 진행 중' : '목표 달성이 어려울 수 있어요'}
                                </span>
                            )}
                        </div>
                    )}

                    {/* 실패 날짜 */}
                    {isFailed && (
                        <div style={styles.failedInfo}>
                            {challenge.failedDate || '이전 시도'} 실패
                            {challenge.attemptNumber > 1 && ` (${challenge.attemptNumber - 1}회차)`}
                        </div>
                    )}

                    {/* 완료 정보 */}
                    {isCompleted && (
                        <div style={styles.completedInfo}>
                            🎉 챌린지 완료! +{challenge.earnedPoints || 0}P 획득
                            {challenge.bonusEarned && ' (보너스 포함)'}
                        </div>
                    )}

                    {/* 버튼 */}
                    <div style={styles.buttonContainer}>
                        {!isActive && !isFailed && !isCompleted && (
                            <button
                                style={styles.startButton}
                                onClick={() => {
                                    // 필수 입력값 검증
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
                                챌린지 도전하기
                            </button>
                        )}
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
                        {isActive && (
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
                        )}
                        {isActive && challenge.requiresPhoto && (
                            <>
                                {/* 숨겨진 파일 입력 */}
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    style={{ display: 'none' }}
                                    accept="image/*"
                                    onChange={handleFileSelect}
                                />
                                {/* 사진 인증 설명 */}
                                {challenge.photoDescription && (
                                    <p style={styles.photoDescription}>
                                        📷 {challenge.photoDescription}
                                    </p>
                                )}
                                {/* 카메라/갤러리 버튼 */}
                                <div style={styles.photoButtonRow}>
                                    <button
                                        style={styles.cameraButton}
                                        onClick={handleCameraClick}
                                    >
                                        <Camera size={18} />
                                        <span>카메라</span>
                                    </button>
                                    <button
                                        style={styles.galleryButton}
                                        onClick={handleGalleryClick}
                                    >
                                        <Image size={18} />
                                        <span>갤러리</span>
                                    </button>
                                </div>
                            </>
                        )}
                        {isCompleted && (
                            <button style={styles.completedButton} disabled>
                                완료됨
                            </button>
                        )}
                    </div>
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
    },
    modal: {
        backgroundColor: 'white',
        borderRadius: '20px',
        width: '100%',
        maxWidth: '360px',
        maxHeight: '90vh',
        overflow: 'hidden',
        position: 'relative',
    },
    closeButton: {
        position: 'absolute',
        top: '12px',
        right: '12px',
        background: 'rgba(255,255,255,0.9)',
        border: 'none',
        borderRadius: '50%',
        width: '36px',
        height: '36px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        zIndex: 10,
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    },
    iconArea: {
        padding: '2rem',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
    },
    iconContainer: {
        width: '80px',
        height: '80px',
        borderRadius: '50%',
        backgroundColor: 'rgba(255,255,255,0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    content: {
        padding: '1.5rem',
        overflowY: 'auto',
        maxHeight: 'calc(90vh - 180px)',
    },
    difficultyBadge: {
        display: 'inline-block',
        padding: '4px 12px',
        borderRadius: '12px',
        fontSize: '0.75rem',
        fontWeight: '600',
        marginBottom: '8px',
    },
    title: {
        fontSize: '1.25rem',
        fontWeight: '700',
        color: 'var(--text-main)',
        marginBottom: '12px',
    },
    infoRow: {
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        marginBottom: '12px',
    },
    points: {
        display: 'flex',
        alignItems: 'baseline',
    },
    pointsValue: {
        fontSize: '1.5rem',
        fontWeight: '700',
        color: 'var(--primary)',
    },
    pointsLabel: {
        fontSize: '1rem',
        fontWeight: '600',
        color: 'var(--primary)',
        marginLeft: '2px',
    },
    duration: {
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        fontSize: '0.875rem',
        color: 'var(--text-sub)',
    },
    aiReason: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '0.85rem',
        color: 'var(--primary)',
        backgroundColor: 'rgba(47, 133, 90, 0.1)',
        padding: '6px 12px',
        borderRadius: '8px',
        marginBottom: '16px',
    },
    description: {
        fontSize: '0.95rem',
        lineHeight: '1.6',
        color: 'var(--text-sub)',
        marginBottom: '12px',
    },
    successCondition: {
        fontSize: '0.85rem',
        lineHeight: '1.5',
        color: 'var(--text-main)',
        backgroundColor: '#F3F4F6',
        padding: '10px 12px',
        borderRadius: '8px',
        marginBottom: '16px',
    },
    progressSection: {
        marginBottom: '16px',
    },
    progressHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '0.85rem',
        color: 'var(--text-main)',
        marginBottom: '8px',
    },
    progressBar: {
        width: '100%',
        height: '8px',
        backgroundColor: '#E2E8F0',
        borderRadius: '4px',
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: 'var(--primary)',
        borderRadius: '4px',
        transition: 'width 0.3s ease',
    },
    daysLeft: {
        fontSize: '0.8rem',
        color: 'var(--text-sub)',
        marginTop: '4px',
        display: 'block',
    },
    trackStatus: {
        fontSize: '0.8rem',
        marginTop: '4px',
        display: 'block',
    },
    failedInfo: {
        fontSize: '0.9rem',
        color: '#EF4444',
        backgroundColor: '#FEE2E2',
        padding: '8px 12px',
        borderRadius: '8px',
        marginBottom: '16px',
        textAlign: 'center',
    },
    completedInfo: {
        fontSize: '0.9rem',
        color: '#10B981',
        backgroundColor: '#D1FAE5',
        padding: '8px 12px',
        borderRadius: '8px',
        marginBottom: '16px',
        textAlign: 'center',
    },
    buttonContainer: {
        marginTop: '8px',
    },
    startButton: {
        width: '100%',
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
    continueButton: {
        width: '100%',
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
    cancelButton: {
        width: '100%',
        padding: '14px',
        borderRadius: '12px',
        backgroundColor: '#EF4444', // 빨강
        color: 'white',
        border: 'none',
        fontSize: '1rem',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        marginBottom: '8px',
    },
    photoDescription: {
        fontSize: '0.85rem',
        color: 'var(--text-sub)',
        backgroundColor: '#F0F9FF',
        padding: '10px 12px',
        borderRadius: '8px',
        marginBottom: '12px',
    },
    photoButtonRow: {
        display: 'flex',
        gap: '8px',
        marginBottom: '8px',
    },
    cameraButton: {
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        padding: '12px',
        borderRadius: '12px',
        backgroundColor: '#3B82F6',
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
        backgroundColor: '#8B5CF6',
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
    inputSection: {
        marginBottom: '16px',
        padding: '12px',
        backgroundColor: '#F9FAFB',
        borderRadius: '8px',
        border: '1px solid #E5E7EB',
    },
    inputGroup: {
        marginBottom: '12px',
    },
    inputLabel: {
        display: 'block',
        fontSize: '0.85rem',
        fontWeight: '600',
        color: 'var(--text-main)',
        marginBottom: '4px',
    },
    requiredMark: {
        color: '#EF4444',
        marginLeft: '2px',
    },
    inputField: {
        width: '100%',
        padding: '8px 12px',
        borderRadius: '6px',
        border: '1px solid #D1D5DB',
        fontSize: '0.9rem',
    },
    categorySelectContainer: {
        position: 'relative',
    },
    categorySelectButton: {
        width: '100%',
        padding: '8px 12px',
        borderRadius: '6px',
        border: '1px solid #D1D5DB',
        fontSize: '0.9rem',
        backgroundColor: 'white',
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
        maxHeight: '200px',
        overflowY: 'auto',
        backgroundColor: 'white',
        border: '1px solid #D1D5DB',
        borderRadius: '6px',
        marginTop: '4px',
        zIndex: 100,
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    },
    categoryOption: {
        width: '100%',
        padding: '8px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        border: 'none',
        cursor: 'pointer',
        fontSize: '0.85rem',
        transition: 'background-color 0.2s',
    },
};

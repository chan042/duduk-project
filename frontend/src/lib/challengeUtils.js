/**
 * 챌린지 공통 유틸리티 함수
 * - 난이도 라벨 및 스타일
 * - 캐릭터 얼굴 이미지 경로
 * - 진행률 계산
 */

export const WEEK_DAYS = [
    { key: 'sun', label: 'SUN', index: 0, shortLabel: '일' },
    { key: 'mon', label: 'MON', index: 1, shortLabel: '월' },
    { key: 'tue', label: 'TUE', index: 2, shortLabel: '화' },
    { key: 'wed', label: 'WED', index: 3, shortLabel: '수' },
    { key: 'thu', label: 'THU', index: 4, shortLabel: '목' },
    { key: 'fri', label: 'FRI', index: 5, shortLabel: '금' },
    { key: 'sat', label: 'SAT', index: 6, shortLabel: '토' },
];

export const normalizeWeekdayKey = (rawKey) => {
    const key = String(rawKey || '').trim().toLowerCase();

    if (key.includes('sun') || key === '일') return 'sun';
    if (key.includes('mon') || key === '월') return 'mon';
    if (key.includes('tue') || key === '화') return 'tue';
    if (key.includes('wed') || key === '수') return 'wed';
    if (key.includes('thu') || key === '목') return 'thu';
    if (key.includes('fri') || key === '금') return 'fri';
    if (key.includes('sat') || key === '토') return 'sat';

    return null;
};

export const normalizeDailyRules = (dailyRules) => {
    const normalized = {};

    Object.entries(dailyRules || {}).forEach(([day, category]) => {
        const dayKey = normalizeWeekdayKey(day);
        if (dayKey) {
            normalized[dayKey] = category;
        }
    });

    return normalized;
};

export const getChallengeStartDayIndex = (challenge, fallbackDayIndex = 1) => {
    const startedAt = challenge?.startedAt;
    if (!startedAt) return fallbackDayIndex;

    const parsed = new Date(startedAt);
    if (Number.isNaN(parsed.getTime())) return fallbackDayIndex;
    return parsed.getDay();
};

export const getOrderedWeekDays = (startDayIndex) => {
    const startIndex = WEEK_DAYS.findIndex((day) => day.index === startDayIndex);
    if (startIndex < 0) return WEEK_DAYS;
    return [...WEEK_DAYS.slice(startIndex), ...WEEK_DAYS.slice(0, startIndex)];
};

export const isTodayByOffset = (startedAt, dayOffset, todayDateString) => {
    if (!startedAt || !todayDateString) return false;
    const start = new Date(startedAt);
    if (Number.isNaN(start.getTime())) return false;
    const shifted = new Date(start);
    shifted.setDate(shifted.getDate() + dayOffset);
    return shifted.toDateString() === todayDateString;
};

export const getChallengeDaysLeft = (challenge) => {
    if (challenge?.daysLeft !== undefined) return challenge.daysLeft;
    if (challenge?.remainingDays !== undefined) return challenge.remainingDays;
    return challenge?.durationDays || challenge?.duration || 0;
};

export const getChallengeDdayLabel = (challenge) => {
    const daysLeft = getChallengeDaysLeft(challenge);
    if (daysLeft > 0) {
        return `D-${daysLeft}`;
    }
    if (challenge?.status === 'active') {
        return '결과 반영 중';
    }
    return null;
};


/**
 * 난이도 라벨 반환 (EASY/NORMAL/HARD)
 */
export const getDifficultyLabel = (difficulty) => {
    const diffLower = difficulty?.toLowerCase();
    switch (diffLower) {
        case '쉬움':
        case 'easy':
            return 'EASY';
        case '보통':
        case 'normal':
        case 'medium':
            return 'NORMAL';
        case '어려움':
        case 'hard':
            return 'HARD';
        default:
            return 'NORMAL';
    }
};

/**
 * 난이도별 스타일 반환
 */
export const getDifficultyStyle = (difficulty) => {
    const diffLower = difficulty?.toLowerCase();
    switch (diffLower) {
        case '쉬움':
        case 'easy':
            return { backgroundColor: '#DCFCE7', color: '#16A34A' };
        case '보통':
        case 'normal':
        case 'medium':
            return { backgroundColor: '#FEF3C7', color: '#CA8A04' };
        case '어려움':
        case 'hard':
            return { backgroundColor: '#FEE2E2', color: '#DC2626' };
        default:
            return { backgroundColor: '#F3F4F6', color: '#6B7280' };
    }
};

/**
 * 난이도 선택 버튼용 스타일 반환
 * @param {string} difficulty - 버튼의 난이도 (easy, normal, hard)
 * @param {string} selectedDifficulty - 현재 선택된 난이도
 * @param {object} baseStyle - 기본 버튼 스타일
 */
export const getDifficultyButtonStyle = (difficulty, selectedDifficulty, baseStyle = {}) => {
    const isSelected = selectedDifficulty === difficulty;
    const defaultBaseStyle = {
        flex: 1,
        padding: '12px 16px',
        borderRadius: '12px',
        border: 'none',
        fontSize: '0.9rem',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        ...baseStyle,
    };

    const diffLower = difficulty?.toLowerCase();
    switch (diffLower) {
        case 'easy':
            return {
                ...defaultBaseStyle,
                backgroundColor: isSelected ? '#DCFCE7' : '#F3F4F6',
                color: isSelected ? '#16A34A' : 'var(--text-sub)',
            };
        case 'normal':
            return {
                ...defaultBaseStyle,
                backgroundColor: isSelected ? '#FEF3C7' : '#F3F4F6',
                color: isSelected ? '#CA8A04' : 'var(--text-sub)',
            };
        case 'hard':
            return {
                ...defaultBaseStyle,
                backgroundColor: isSelected ? '#FEE2E2' : '#F3F4F6',
                color: isSelected ? '#DC2626' : 'var(--text-sub)',
            };
        default:
            return defaultBaseStyle;
    }
};

/**
 * 난이도별 캐릭터 얼굴 이미지 경로 반환
 * @param {string} difficulty
 * @param {string} characterType
 */
export const getCharacterFace = (difficulty, characterType) => {
    const charType = characterType?.startsWith('char_') ? characterType : `char_${characterType || 'ham'}`;
    const diffLower = difficulty?.toLowerCase();

    let faceName = 'face_happy';
    switch (diffLower) {
        case '쉬움':
        case 'easy':
            faceName = 'face_basic';
            break;
        case '보통':
        case 'normal':
        case 'medium':
            faceName = 'face_happy';
            break;
        case '어려움':
        case 'hard':
            faceName = 'face_money';
            break;
        default:
            faceName = 'face_happy';
    }

    return `/images/characters/${charType}/${faceName}.png`;
};



/**
 * 난이도별 원형 배경색 반환 (챌린지 상세 모달용)
 */
export const getDifficultyBackgroundColor = (difficulty) => {
    const diffLower = difficulty?.toLowerCase();
    switch (diffLower) {
        case '쉬움':
        case 'easy':
            return '#D1FAE5'; // 연한 초록색
        case '보통':
        case 'normal':
        case 'medium':
            return '#FEF3C7'; // 연한 노란색
        case '어려움':
        case 'hard':
            return '#FED7AA'; // 연한 주황색
        default:
            return '#F3F4F6'; // 회색
    }
};

/**
 * progress 객체에서 percentage 추출
 */
export const getProgressPercent = (progress) => {
    if (!progress) return 0;
    if (typeof progress === 'number') return progress;
    if (typeof progress === 'object') {
        if (progress.percentage !== undefined && progress.percentage !== null) {
            return Number(progress.percentage) || 0;
        }
        if (progress.current !== undefined && progress.target > 0) {
            return (progress.current / progress.target) * 100;
        }
        return 0;
    }
    return 0;
};

/**
 * progress 객체에서 실제 수치 텍스트 추출
 */
export const getProgressText = (progress, durationDays) => {
    if (!progress || typeof progress !== 'object') return null;

    const type = progress.type;

    if (type === 'random_budget') {
        const current = progress.current || 0;
        if (progress.mask_target) {
            return `${current.toLocaleString()}원 / ?원`;
        }
        const target = progress.target || 0;
        return `${current.toLocaleString()}원 / ${target.toLocaleString()}원`;
    }

    if (type === 'amount') {
        const current = progress.current || 0;
        const target = progress.target || 0;
        return `${current.toLocaleString()}원 / ${target.toLocaleString()}원`;
    } else if (type === 'compare') {
        if (progress.phase === 'next_month') {
            const nextSpent = progress.next_month_spent || progress.current || 0;
            const base = progress.compare_base || progress.this_month_spent || progress.target || 0;
            return `${nextSpent.toLocaleString()}원 / ${base.toLocaleString()}원`;
        }
        if (progress.phase === 'this_month' && progress.this_month_spent !== undefined) {
            return `기준 수집 중 · ${(progress.this_month_spent || 0).toLocaleString()}원`;
        }
        const current = progress.current || 0;
        const target = progress.target || 0;
        return `${current.toLocaleString()}원 / ${target.toLocaleString()}원`;
    } else if (type === 'daily_check') {
        const checkedDays = progress.checked_days || progress.checkedDays || 0;
        const totalDays = progress.total_days || progress.totalDays || durationDays || 0;
        return `${checkedDays}일 / ${totalDays}일`;
    } else if (type === 'photo') {
        const photoCount = progress.photo_count || progress.photoCount || 0;
        if ((progress.mode || '').toLowerCase() === 'on_purchase') {
            return `${photoCount}회 인증`;
        }
        const requiredCount = progress.required_count || progress.requiredCount || 1;
        return `${photoCount}회 / ${requiredCount}회`;
    } else if (type === 'zero_spend') {
        const current = progress.current || 0;
        return current === 0 ? '무지출 유지 중!' : `${current.toLocaleString()}원 지출`;
    } else if (type === 'daily_rule') {
        const successDays = progress.passed_days || progress.success_days || progress.successDays || 0;
        const totalDays = progress.total_days || progress.totalDays || durationDays || 7;
        return `${successDays}일 / ${totalDays}일 성공`;
    }

    return null;
};

/**
 * progress 객체에서 데이터 추출 (상세 모달용)
 * 백엔드 snake_case와 프론트엔드 camelCase 모두 지원
 */
export const getProgressData = (progress) => {
    if (!progress) return { percentage: 0, type: null };
    if (typeof progress === 'number') return { percentage: progress, type: 'amount' };
    if (typeof progress === 'object') {
        return {
            percentage: progress.percentage || 0,
            type: progress.type || 'amount',
            // amount, compare, random_budget
            current: progress.current,
            target: progress.target,
            remaining: progress.remaining,
            // daily_check
            checkedDays: progress.checked_days || progress.checkedDays || 0,
            totalDays: progress.total_days || progress.totalDays || 0,
            elapsedDays: progress.elapsed_days || progress.elapsedDays || 0,
            // daily_rule
            successDays: progress.passed_days || progress.success_days || progress.successDays || 0,
            dailyStatus: progress.daily_status || progress.dailyStatus || [],
            // photo
            photoCount: progress.photo_count || progress.photoCount || 0,
            requiredCount: progress.required_count || progress.requiredCount || 0,
            photos: progress.photos || [],
            // compare
            compareBase: progress.compare_base || progress.compareBase,
            compareLabel: progress.compare_label || progress.compareLabel,
            difference: progress.difference,
            phase: progress.phase,
            thisMonthSpent: progress.this_month_spent,
            nextMonthSpent: progress.next_month_spent,
            ratioPercent: progress.ratio_percent,
            dailyRules: progress.daily_rules || {},
            mode: progress.mode,
            lowerLimit: progress.lower_limit ?? progress.lowerLimit,
            upperLimit: progress.upper_limit ?? progress.upperLimit,
            // common
            isOnTrack: progress.is_on_track || progress.isOnTrack,
            potentialPoints: progress.potential_points ?? progress.potentialPoints,
            jackpotEligible: progress.jackpot_eligible ?? progress.jackpotEligible,
            differencePercent: progress.difference_percent ?? progress.differencePercent,
            maskTarget: progress.mask_target ?? progress.maskTarget,
        };
    }
    return { percentage: 0, type: null };
};

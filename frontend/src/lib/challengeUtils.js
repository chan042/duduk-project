/**
 * 챌린지 공통 유틸리티 함수
 * - 난이도 라벨 및 스타일
 * - 캐릭터 얼굴 이미지 경로
 * - 진행률 계산
 */



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
        if (progress.current !== undefined && progress.target > 0) {
            return (progress.current / progress.target) * 100;
        }
        return progress.percentage || 0;
    }
    return 0;
};

/**
 * progress 객체에서 실제 수치 텍스트 추출
 */
export const getProgressText = (progress, durationDays) => {
    if (!progress || typeof progress !== 'object') return null;

    const type = progress.type;

    if (type === 'amount' || type === 'compare' || type === 'random_budget') {
        const current = progress.current || 0;
        const target = progress.target || 0;
        return `${current.toLocaleString()}원 / ${target.toLocaleString()}원`;
    } else if (type === 'daily_check') {
        const checkedDays = progress.checked_days || progress.checkedDays || 0;
        const totalDays = progress.total_days || progress.totalDays || durationDays || 0;
        return `${checkedDays}일 / ${totalDays}일`;
    } else if (type === 'photo') {
        const photoCount = progress.photo_count || progress.photoCount || 0;
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
            // daily_check
            checkedDays: progress.checked_days || progress.checkedDays || 0,
            totalDays: progress.total_days || progress.totalDays || 0,
            // daily_rule
            successDays: progress.passed_days || progress.success_days || progress.successDays || 0,
            // photo
            photoCount: progress.photo_count || progress.photoCount || 0,
            requiredCount: progress.required_count || progress.requiredCount || 0,
            // compare
            compareBase: progress.compare_base || progress.compareBase,
            difference: progress.difference,
            // common
            isOnTrack: progress.is_on_track || progress.isOnTrack,
        };
    }
    return { percentage: 0, type: null };
};

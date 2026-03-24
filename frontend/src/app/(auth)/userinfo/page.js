"use client";

/**
 * [파일 역할]
 * - 최초 회원가입 사용자를 위한 정보 수집 온보딩 페이지입니다.
 * - 질문-답변 형식으로 정보를 순차적으로 수집합니다.
 * - 캐릭터를 선택한 후 이름을 입력합니다.
 * - 완료 후 메인 페이지로 이동합니다.
 */
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { updateProfile } from '@/lib/api/auth';
import { useAuth } from '@/contexts/AuthContext';

const CHARACTERS = [
    { id: 'char_cat', name: '고양이', image: '/images/characters/char_cat/body.png' },
    { id: 'char_dog', name: '강아지', image: '/images/characters/char_dog/body.png' },
    { id: 'char_ham', name: '햄스터', image: '/images/characters/char_ham/body.png' },
    { id: 'char_sheep', name: '양', image: '/images/characters/char_sheep/body.png' },
];

// 질문 목록
const questions = [
    {
        id: 'age',
        question: '나이가 어떻게 되시나요?',
        placeholder: '예: 28',
        type: 'number'
    },
    {
        id: 'job',
        question: '어떤 일을 하고 계신가요?',
        placeholder: '예: 프리랜서 개발자',
        type: 'text'
    },
    {
        id: 'hobbies',
        question: '취미가 무엇인가요?',
        placeholder: '예: 독서, 영화 감상, 요리',
        type: 'text'
    },
    {
        id: 'marital_status',
        question: '결혼 여부를 알려주세요.',
        options: [
            { value: 'SINGLE', label: '미혼' },
            { value: 'MARRIED', label: '기혼' }
        ],
        type: 'select'
    },
    {
        id: 'monthly_budget',
        question: '한 달 예산은 얼마인가요?',
        placeholder: '예: 500,000',
        suffix: '원',
        type: 'number'
    },
    {
        id: 'spending_to_improve',
        question: '개선하고 싶은 소비 습관이 있나요?',
        placeholder: '예: 외식비, 배달 음식, 충동구매',
        type: 'text'
    }
];

export default function UserInfoPage() {
    // 0: 안내 단계
    // 1 ~ questions.length: 질문 단계
    // questions.length + 1: 캐릭터 선택
    // questions.length + 2: 캐릭터 이름 입력
    const INTRO_STEP = 0;
    const FIRST_QUESTION_STEP = 1;
    const CHARACTER_SELECTION_STEP = questions.length + 1;
    const CHARACTER_NAMING_STEP = questions.length + 2;

    const [currentStep, setCurrentStep] = useState(0);
    const [answers, setAnswers] = useState({});
    const [draftAnswers, setDraftAnswers] = useState({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const stepTransitionLockRef = useRef(false);

    // 캐릭터 관련 상태
    const [selectedCharacter, setSelectedCharacter] = useState('');
    const [characterName, setCharacterName] = useState('');

    const router = useRouter();
    const { refreshUser } = useAuth();

    const totalSteps = questions.length + 3;

    // 현재 단계가 질문 단계인지 확인
    const isIntroStep = currentStep === INTRO_STEP;
    const isQuestionStep = currentStep >= FIRST_QUESTION_STEP && currentStep <= questions.length;
    const currentQuestion = isQuestionStep ? questions[currentStep - FIRST_QUESTION_STEP] : null;

    const isBudgetQuestion = (question) => question?.id === 'monthly_budget';
    const isMaritalStatusQuestion = (question) => question?.id === 'marital_status';

    const formatBudgetInput = (value) => {
        const digits = String(value ?? '').replace(/\D/g, '');

        if (!digits) {
            return '';
        }

        return Number(digits).toLocaleString('ko-KR');
    };

    const parseQuestionValue = (question, value) => {
        if (question.type !== 'number') {
            return value;
        }

        if (isBudgetQuestion(question)) {
            const digits = String(value ?? '').replace(/\D/g, '');
            return digits ? Number(digits) : 0;
        }

        return Number(value);
    };

    const getQuestionValue = (question) => {
        const draftValue = draftAnswers[question.id];
        if (draftValue !== undefined && draftValue !== null) {
            return draftValue;
        }

        const savedValue = answers[question.id];
        if (savedValue === undefined || savedValue === null) {
            return '';
        }

        if (isBudgetQuestion(question)) {
            return formatBudgetInput(savedValue);
        }

        return String(savedValue);
    };

    const currentInputValue = isQuestionStep && currentQuestion?.type !== 'select'
        ? getQuestionValue(currentQuestion)
        : '';
    const currentSelectValue = isQuestionStep && currentQuestion?.type === 'select'
        ? (answers[currentQuestion.id] ?? draftAnswers[currentQuestion.id] ?? '')
        : '';

    useEffect(() => {
        stepTransitionLockRef.current = false;
    }, [currentStep]);

    const goToNextStep = () => {
        if (stepTransitionLockRef.current) {
            return;
        }

        stepTransitionLockRef.current = true;
        setCurrentStep(prev => prev + 1);
    };

    const handleInputChange = (value) => {
        const nextValue = isBudgetQuestion(currentQuestion)
            ? formatBudgetInput(value)
            : value;

        setDraftAnswers(prev => ({
            ...prev,
            [currentQuestion.id]: nextValue
        }));
    };

    // 캐릭터 선택 처리 (두 번 누르면 선택 해제)
    const handleCharacterSelect = (characterId) => {
        if (selectedCharacter === characterId) {
            setSelectedCharacter(''); // 같은 캐릭터 두 번 클릭 시 선택 해제
        } else {
            setSelectedCharacter(characterId); // 다른 캐릭터 선택 시 변경
        }
    };

    // 캐릭터 선택 다음 단계로 (이름 입력으로 이동)
    const handleCharacterNext = () => {
        if (!selectedCharacter) {
            setError('캐릭터를 선택해주세요.');
            return;
        }
        setError('');
        goToNextStep();
    };

    // 캐릭터 이름 입력 후 완료 (최종 제출)
    const handleCharacterNameSubmit = async () => {
        if (!characterName.trim()) {
            setError('캐릭터 이름을 입력해주세요.');
            return;
        }
        setError('');

        setLoading(true);
        try {
            await updateProfile({
                ...answers,
                character_type: selectedCharacter,
                character_name: characterName,
                is_profile_complete: true
            });
            await refreshUser();
            router.push('/');
        } catch (err) {
            console.error('프로필 저장 실패:', err);
            setError('저장에 실패했습니다. 다시 시도해주세요.');
            setLoading(false);
        }
    };

    // 질문 답변 제출 처리 (다음 단계로 이동)
    const handleQuestionSubmit = () => {
        const currentValue = currentInputValue;

        if (!currentValue.trim()) {
            return;
        }

        // 현재 답변 저장
        const newAnswers = {
            ...answers,
            [currentQuestion.id]: parseQuestionValue(currentQuestion, currentValue)
        };
        setAnswers(newAnswers);
        setError('');

        // 다음 질문 또는 캐릭터 선택 단계로 이동
        goToNextStep();
    };

    // 선택형 답변 처리
    const handleSelect = (value) => {
        const newAnswers = {
            ...answers,
            [currentQuestion.id]: value
        };
        setAnswers(newAnswers);
        setDraftAnswers(prev => ({
            ...prev,
            [currentQuestion.id]: value
        }));
        setError('');
    };

    const handleOptionClick = (value) => {
        handleSelect(value);

        if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
        }
    };

    const handleBack = () => {
        setError('');

        if (currentStep === INTRO_STEP) {
            router.back();
            return;
        }

        stepTransitionLockRef.current = false;
        setCurrentStep(prev => prev - 1);
    };

    const handlePrimaryAction = () => {
        if (isIntroStep) {
            goToNextStep();
            return;
        }

        if (isQuestionStep) {
            if (currentQuestion.type === 'select') {
                if (!currentSelectValue) {
                    return;
                }

                goToNextStep();
                return;
            }

            handleQuestionSubmit();
            return;
        }

        if (currentStep === CHARACTER_SELECTION_STEP) {
            handleCharacterNext();
            return;
        }

        if (currentStep === CHARACTER_NAMING_STEP) {
            handleCharacterNameSubmit();
        }
    };

    const primaryButtonDisabled = (() => {
        if (loading) {
            return true;
        }

        if (isIntroStep) {
            return false;
        }

        if (isQuestionStep) {
            return currentQuestion.type === 'select'
                ? !currentSelectValue
                : !currentInputValue.trim();
        }

        if (currentStep === CHARACTER_SELECTION_STEP) {
            return !selectedCharacter;
        }

        if (currentStep === CHARACTER_NAMING_STEP) {
            return !characterName.trim();
        }

        return false;
    })();

    const primaryButtonLabel = currentStep === CHARACTER_NAMING_STEP && loading ? '저장 중...' : currentStep === CHARACTER_NAMING_STEP ? '완료' : '다음';

    // Enter 키 처리
    const handleKeyDown = (e) => {
        if (e.key !== 'Enter' || e.nativeEvent.isComposing || e.repeat) {
            return;
        }

        e.preventDefault();
        e.stopPropagation();

        if (isQuestionStep && currentQuestion.type !== 'select' && currentInputValue.trim()) {
            handlePrimaryAction();
        } else if (currentStep === CHARACTER_NAMING_STEP && characterName.trim()) {
            handlePrimaryAction();
        }
    };

    const renderStepActions = () => (
        <div style={styles.actionRow}>
            <button
                type="button"
                onClick={handlePrimaryAction}
                disabled={primaryButtonDisabled}
                style={{
                    ...styles.nextButton,
                    ...(primaryButtonDisabled ? styles.nextButtonDisabled : {})
                }}
            >
                {primaryButtonLabel}
            </button>

            <button
                type="button"
                onClick={handleBack}
                style={{
                    ...styles.prevButton,
                    ...(loading ? styles.prevButtonDisabled : {})
                }}
                disabled={loading}
            >
                이전
            </button>
        </div>
    );

    const renderIntro = () => (
        <div style={styles.introStepLayout}>
            <div style={styles.introContent}>
                <h2 style={styles.question}>두둑 AI의 맞춤형 소비코칭을 위해<br />기본 정보가 필요해요!</h2>
            </div>

            {renderStepActions()}
        </div>
    );

    // 캐릭터 선택 단계 렌더링
    const renderCharacterSelection = () => (
        <div style={styles.stepLayout}>
            <div style={styles.stepBody}>
                <h2 style={styles.question}>나만의 두둑이를 선택하세요!</h2>

                {error && <div style={styles.errorBox}>{error}</div>}

                <div style={styles.characterGrid}>
                    {CHARACTERS.map((char) => (
                        <div
                            key={char.id}
                            onClick={() => handleCharacterSelect(char.id)}
                            style={{
                                ...styles.characterCard,
                                ...(selectedCharacter === char.id ? styles.characterCardSelected : {})
                            }}
                        >
                            <div style={styles.characterImageWrapper}>
                                <Image
                                    src={char.image}
                                    alt={char.name}
                                    width={160}
                                    height={160}
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'contain'
                                    }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {renderStepActions()}
        </div>
    );

    // 캐릭터 이름 입력 단계 렌더링
    const renderCharacterNaming = () => (
        <div style={styles.stepLayout}>
            <div style={styles.stepBody}>
                <h2 style={styles.question}>두둑이의 이름을 지어주세요!</h2>

                {error && <div style={styles.errorBox}>{error}</div>}

                <div style={styles.selectedCharacterPreview}>
                    <Image
                        src={CHARACTERS.find(c => c.id === selectedCharacter)?.image || ''}
                        alt="선택된 캐릭터"
                        width={120}
                        height={120}
                        style={{ objectFit: 'contain' }}
                    />
                </div>

                <div style={styles.inputContainer}>
                    <input
                        type="text"
                        value={characterName}
                        onChange={(e) => setCharacterName(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="예: 두둑이"
                        style={styles.input}
                        maxLength={20}
                        autoFocus
                        disabled={loading}
                    />
                </div>
            </div>

            {renderStepActions()}
        </div>
    );

    // 질문 단계 렌더링
    const renderQuestion = () => (
        <div style={styles.stepLayout}>
            <div style={styles.stepBody}>
                <h2 style={styles.question}>{currentQuestion.question}</h2>

                {error && <div style={styles.errorBox}>{error}</div>}

                {currentQuestion.type === 'select' ? (
                    <div
                        style={{
                            ...styles.optionsContainer,
                            ...(isMaritalStatusQuestion(currentQuestion) ? styles.optionsRowContainer : {})
                        }}
                    >
                        {currentQuestion.options.map((option) => (
                            <button
                                type="button"
                                key={option.value}
                                className="userinfo-option-button"
                                onClick={() => handleOptionClick(option.value)}
                                style={{
                                    ...styles.optionButton,
                                    ...(isMaritalStatusQuestion(currentQuestion) ? styles.optionButtonHalf : {}),
                                    ...(answers[currentQuestion.id] === option.value ? styles.optionButtonSelected : styles.optionButtonDefault)
                                }}
                                disabled={loading}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                ) : (
                    <div style={styles.inputContainer}>
                        <input
                            type={isBudgetQuestion(currentQuestion) ? 'text' : currentQuestion.type}
                            value={currentInputValue}
                            onChange={(e) => handleInputChange(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={currentQuestion.placeholder}
                            inputMode={isBudgetQuestion(currentQuestion) ? 'numeric' : undefined}
                            style={{
                                ...styles.input,
                                ...(currentQuestion.suffix ? styles.inputWithSuffix : {})
                            }}
                            autoFocus
                            disabled={loading}
                        />
                        {currentQuestion.suffix && (
                            <span style={styles.suffix}>{currentQuestion.suffix}</span>
                        )}
                    </div>
                )}
            </div>

            {renderStepActions()}
        </div>
    );

    return (
        <div style={styles.container}>
            {/* 상단 타이틀 */}
            <h1 style={styles.title}>Duduk</h1>

            {/* 진행 상태 */}
            <div style={styles.progress}>
                <div style={styles.progressBar}>
                    <div
                        style={{
                            ...styles.progressFill,
                            width: `${((currentStep + 1) / totalSteps) * 100}%`
                        }}
                    />
                </div>
                <span style={styles.progressText}>
                    {currentStep + 1} / {totalSteps}
                </span>
            </div>

            {/* 단계별 컨텐츠 */}
            <div style={styles.questionContainer}>
                {isIntroStep && renderIntro()}
                {isQuestionStep && renderQuestion()}
                {currentStep === CHARACTER_SELECTION_STEP && renderCharacterSelection()}
                {currentStep === CHARACTER_NAMING_STEP && renderCharacterNaming()}
            </div>
        </div>
    );
}

const styles = {
    container: {
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '2rem',
        maxWidth: '400px',
        margin: '0 auto',
    },
    title: {
        fontSize: '2rem',
        fontWeight: '700',
        color: 'var(--text-main)',
        marginBottom: '2rem',
        textAlign: 'left',
        width: '100%',
    },
    prevButton: {
        padding: 0,
        border: 'none',
        backgroundColor: 'transparent',
        color: 'var(--text-sub)',
        fontSize: '0.95rem',
        fontWeight: '500',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        lineHeight: 1.2,
    },
    prevButtonDisabled: {
        opacity: 0.5,
        cursor: 'not-allowed',
    },
    progress: {
        width: '100%',
        marginBottom: '2rem',
    },
    progressBar: {
        width: '100%',
        height: '4px',
        backgroundColor: '#E2E8F0',
        borderRadius: '2px',
        overflow: 'hidden',
        marginBottom: '0.5rem',
    },
    progressFill: {
        height: '100%',
        backgroundColor: 'var(--primary)',
        transition: 'width 0.3s ease',
    },
    progressText: {
        fontSize: '0.875rem',
        color: 'var(--text-sub)',
    },
    questionContainer: {
        width: '100%',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
    },
    stepLayout: {
        width: '100%',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        paddingTop: '3rem',
    },
    introStepLayout: {
        width: '100%',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
    },
    stepBody: {
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
    },
    introContent: {
        width: '100%',
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionRow: {
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.875rem',
        marginTop: '2rem',
        paddingTop: '1rem',
        paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))',
    },
    question: {
        fontSize: '1.4rem',
        fontWeight: '600',
        color: 'var(--text-main)',
        textAlign: 'center',
        marginBottom: '2rem',
        lineHeight: '1.4',
    },
    errorBox: {
        backgroundColor: '#FEE2E2',
        color: '#DC2626',
        padding: '0.75rem 1rem',
        borderRadius: 'var(--radius-md)',
        fontSize: '0.875rem',
        textAlign: 'center',
        marginBottom: '1rem',
        width: '100%',
    },
    characterGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '1rem',
        marginBottom: '1.5rem',
        width: '100%',
    },
    characterCard: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0.75rem',
        aspectRatio: '1 / 1',
        borderRadius: '16px',
        borderWidth: '2px',
        borderStyle: 'solid',
        borderColor: '#E2E8F0',
        backgroundColor: '#FFFFFF',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        outline: 'none',
    },
    characterCardSelected: {
        borderColor: 'var(--primary)',
        backgroundColor: 'rgba(72, 187, 120, 0.1)',
        boxShadow: '0 4px 12px rgba(47, 133, 90, 0.2)',
        transform: 'scale(1.04)',
    },
    characterImageWrapper: {
        width: '88%',
        height: '88%',
        backgroundColor: 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    selectedCharacterPreview: {
        width: '140px',
        height: '140px',
        borderRadius: '50%',
        backgroundColor: 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '1.5rem',
    },
    inputContainer: {
        width: '100%',
        position: 'relative',
    },
    input: {
        width: '100%',
        padding: '1rem',
        fontSize: '1.25rem',
        border: 'none',
        borderBottom: '2px solid var(--primary)',
        backgroundColor: 'transparent',
        textAlign: 'center',
        outline: 'none',
    },
    inputWithSuffix: {
        paddingLeft: '3rem',
        paddingRight: '3rem',
    },
    suffix: {
        position: 'absolute',
        right: '1rem',
        top: '50%',
        transform: 'translateY(-50%)',
        fontSize: '1.25rem',
        color: 'var(--text-sub)',
    },
    optionsContainer: {
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
    },
    optionsRowContainer: {
        flexDirection: 'row',
    },
    optionButton: {
        width: '100%',
        padding: '1.25rem',
        fontSize: '1.1rem',
        fontWeight: '500',
        color: 'var(--text-main)',
        backgroundColor: '#FFFFFF',
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: '#E2E8F0',
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        outline: 'none',
        outlineColor: 'transparent',
        appearance: 'none',
        WebkitAppearance: 'none',
        WebkitTapHighlightColor: 'transparent',
    },
    optionButtonHalf: {
        flex: 1,
    },
    optionButtonDefault: {
        borderColor: '#E2E8F0',
        backgroundColor: '#FFFFFF',
        boxShadow: 'none',
    },
    optionButtonSelected: {
        borderColor: 'var(--primary)',
        backgroundColor: 'rgba(72, 187, 120, 0.1)',
        boxShadow: '0 4px 12px rgba(47, 133, 90, 0.12)',
    },
    nextButton: {
        width: '100%',
        minHeight: '3.5rem',
        padding: '1rem 1.25rem',
        fontSize: '1rem',
        fontWeight: '600',
        color: '#FFFFFF',
        background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%)',
        border: 'none',
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
    },
    nextButtonDisabled: {
        opacity: 0.5,
        cursor: 'not-allowed',
    },
};

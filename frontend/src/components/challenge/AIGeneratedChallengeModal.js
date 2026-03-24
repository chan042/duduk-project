/**
 * [파일 역할]
 * - AI가 생성한 챌린지 미리보기 모달
 * - 커스텀 챌린지: 재생성/저장 버튼
 * - AI 챌린지: 저장 버튼
 */
import { useState, useEffect } from 'react';
import ChallengeDetailModal from './ChallengeDetailModal';

export default function AIGeneratedChallengeModal({
    isOpen,
    onClose,
    challengeData,
    onSave,
    isSaving,
    onRegenerate,
    source = 'custom'
}) {
    const [editedData, setEditedData] = useState(null);

    // 초기 데이터 로드
    useEffect(() => {
        if (challengeData) {
            setEditedData({ ...challengeData });
        }
    }, [challengeData]);

    if (!isOpen || !challengeData || !editedData) return null;

    // AI 생성 데이터를 ChallengeDetailModal에서 사용하는 형식으로 변환
    const formattedChallenge = {
        id: 'ai-preview',
        title: editedData.name || editedData.title,
        description: editedData.description,
        difficulty: editedData.difficulty,
        successDescription: editedData.success_conditions || [],
        points: editedData.base_points,
        durationDays: editedData.duration_days,
        duration: editedData.duration_days ? `${editedData.duration_days}일` : undefined,
        sourceType: source === 'coaching' ? 'coaching' : 'custom',
        // 이미지 등은 기본값 사용됨
        ...editedData
    };

    const handleSaveClick = () => {
        onSave(editedData); // 저장 호출
    };

    const shouldShowRegenerate = (source === 'custom' || source === 'coaching') && typeof onRegenerate === 'function';

    // 커스텀 푸터 버튼 (재생성/저장 또는 저장만)
    const customFooter = (
        <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
            {shouldShowRegenerate && (
                <button
                    style={{
                        flex: 1,
                        padding: '14px',
                        borderRadius: '12px',
                        backgroundColor: '#F3F4F6',
                        color: '#4B5563',
                        border: 'none',
                        fontSize: '1rem',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                    }}
                    onClick={onRegenerate}
                >
                    재생성
                </button>
            )}

            {/* 저장 버튼 */}
            <button
                style={{
                    flex: 1,
                    padding: '14px',
                    borderRadius: '12px',
                    backgroundColor: 'var(--primary)',
                    color: 'white',
                    border: 'none',
                    fontSize: '1rem',
                    fontWeight: '600',
                    cursor: isSaving ? 'not-allowed' : 'pointer',
                    opacity: isSaving ? 0.7 : 1,
                    transition: 'all 0.2s ease',
                }}
                onClick={handleSaveClick}
                disabled={isSaving}
            >
                {isSaving ? '저장 중...' : '저장'}
            </button>
        </div>
    );

    return (
        <ChallengeDetailModal
            challenge={formattedChallenge}
            onClose={onClose}
            customFooter={customFooter}
        />
    );
}

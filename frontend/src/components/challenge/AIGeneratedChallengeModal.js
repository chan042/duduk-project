/**
 * [파일 역할]
 * - AI가 생성한 챌린지 미리보기 모달
 * - ChallengeDetailModal을 재사용하여 일관된 UI 제공
 * - 수정/저장 기능 (커스텀 버튼 및 입력 모드)
 */
import { useState, useEffect } from 'react';
import ChallengeDetailModal from './ChallengeDetailModal';

export default function AIGeneratedChallengeModal({
    isOpen,
    onClose,
    challengeData,
    onSave,
    isSaving,
    source = 'custom'
}) {
    const [isEditing, setIsEditing] = useState(false);
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
        sourceType: 'ai',
        // 이미지 등은 기본값 사용됨
        ...editedData
    };

    const handleTitleChange = (newTitle) => {
        setEditedData(prev => ({ ...prev, name: newTitle, title: newTitle }));
    };

    const handleDescriptionChange = (newDesc) => {
        setEditedData(prev => ({ ...prev, description: newDesc }));
    };

    const handleEditClick = () => {
        setIsEditing(true);
    };

    const handleSaveClick = () => {
        setIsEditing(false);
        onSave(editedData); // 저장 호출
    };

    // 커스텀 푸터 버튼 (수정 / 저장)
    const customFooter = (
        <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
            {/* 수정 버튼: 편집 모드가 아닐 때만 활성화 (또는 항상 보여주고 편집모드 진입) */}
            <button
                style={{
                    flex: 1,
                    padding: '14px',
                    borderRadius: '12px',
                    backgroundColor: isEditing ? '#E5E7EB' : '#F3F4F6',
                    color: isEditing ? '#9CA3AF' : '#4B5563',
                    border: 'none',
                    fontSize: '1rem',
                    fontWeight: '600',
                    cursor: isEditing ? 'default' : 'pointer',
                    transition: 'all 0.2s ease',
                }}
                onClick={handleEditClick}
                disabled={isEditing}
            >
                수정
            </button>

            {/* 저장 버튼 */}
            <button
                style={{
                    flex: 2,
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
            // Edit Control
            isEditing={isEditing}
            onTitleChange={handleTitleChange}
            onDescriptionChange={handleDescriptionChange}
            customFooter={customFooter}
        />
    );
}

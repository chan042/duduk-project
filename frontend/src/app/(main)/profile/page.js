"use client";

/**
 * [파일 역할]
 * - 사용자 프로필 페이지 UI를 구현합니다.
 * - 사용자 정보 표시, 로그아웃, 회원탈퇴 기능을 제공합니다.
 */
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Trash2, User, Mail, ChevronLeft, ChevronRight, Edit2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { deleteAccount, updateProfile, updateProfileImage } from '@/lib/api/auth';

export default function ProfilePage() {
    const { user, logout, loading, refreshUser } = useAuth();
    const router = useRouter();
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showInfoModal, setShowInfoModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const [editData, setEditData] = useState({});
    const fileInputRef = useRef(null);

    // 프로필 이미지 변경 처리
    const handleProfileImageChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            await updateProfileImage(file);
            await refreshUser();
        } catch (err) {
            console.error('프로필 이미지 수정 실패:', err);
            alert('이미지 업로드에 실패했습니다.');
        }
    };

    // 프로필 이미지 영역 클릭 시
    const handleAvatarClick = () => {
        fileInputRef.current?.click();
    };

    // 나의 정보 모달 열기
    const openInfoModal = () => {
        setEditData({
            age: user?.age || '',
            job: user?.job || '',
            hobbies: user?.hobbies || '',
            marital_status: user?.marital_status || 'SINGLE',
            monthly_budget: user?.monthly_budget || '',
            spending_to_improve: user?.spending_to_improve || ''
        });
        setShowInfoModal(true);
        setIsEditing(false);
        setError('');
    };

    // 나의 정보 모달 닫기
    const closeInfoModal = () => {
        setShowInfoModal(false);
        setIsEditing(false);
        setError('');
    };

    // 정보 수정 처리
    const handleSaveInfo = async () => {
        setIsSaving(true);
        setError('');
        try {
            await updateProfile({
                ...editData,
                age: editData.age ? Number(editData.age) : null,
                monthly_budget: editData.monthly_budget ? Number(editData.monthly_budget) : null
            });
            await refreshUser();
            setIsEditing(false);
        } catch (err) {
            console.error('정보 수정 실패:', err);
            setError('저장에 실패했습니다. 다시 시도해주세요.');
        } finally {
            setIsSaving(false);
        }
    };

    // 로그아웃 처리
    const handleLogout = () => {
        logout();
    };

    // 회원탈퇴 확인 모달 열기
    const openDeleteModal = () => {
        setShowDeleteModal(true);
        setError('');
    };

    // 회원탈퇴 확인 모달 닫기
    const closeDeleteModal = () => {
        setShowDeleteModal(false);
        setError('');
    };

    // 회원탈퇴 처리
    const handleDeleteAccount = async () => {
        setIsDeleting(true);
        setError('');

        try {
            await deleteAccount();
            // 로컬 스토리지 클리어
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            // 로그인 페이지로 이동
            router.push('/login');
        } catch (err) {
            console.error('회원탈퇴 실패:', err);
            setError('회원탈퇴에 실패했습니다. 다시 시도해주세요.');
        } finally {
            setIsDeleting(false);
        }
    };

    if (loading) {
        return (
            <div style={styles.loadingContainer}>
                <p>로딩 중...</p>
            </div>
        );
    }

    return (
        <div style={styles.container}>
            {/* 헤더 */}


            {/* 프로필 정보 카드 */}
            <div style={styles.profileCard}>
                <div style={styles.avatarContainer}>
                    <div style={{ ...styles.avatar, cursor: 'pointer', overflow: 'hidden' }} onClick={handleAvatarClick}>
                        {user?.profile_image ? (
                            <img
                                src={user.profile_image}
                                alt="Profile"
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                        ) : (
                            <Edit2 size={32} color="white" />
                        )}
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleProfileImageChange}
                            style={{ display: 'none' }}
                            accept="image/*"
                        />
                    </div>
                </div>
                <div style={styles.userInfo}>
                    <div style={styles.infoRow}>
                        <User size={18} color="var(--text-sub)" />
                        <span style={styles.infoLabel}>이름</span>
                        <span style={styles.infoValue}>{user?.username || '사용자'}</span>
                    </div>
                    <div style={styles.divider}></div>
                    <div style={styles.infoRow}>
                        <Mail size={18} color="var(--text-sub)" />
                        <span style={styles.infoLabel}>이메일</span>
                        <span style={styles.infoValue}>{user?.email || '-'}</span>
                    </div>
                </div>
            </div>

            {/* 나의 정보 블록 */}
            <div style={styles.infoBlock} onClick={openInfoModal}>
                <div style={styles.infoBlockContent}>
                    <span style={styles.infoBlockTitle}>나의 정보</span>
                    <span style={styles.infoBlockDesc}>나이, 직업, 취미, 예산 등</span>
                </div>
                <ChevronRight size={20} color="var(--text-sub)" />
            </div>

            {/* 버튼 영역 */}
            <div style={styles.buttonContainer}>
                {/* 로그아웃 버튼 */}
                <button onClick={handleLogout} style={styles.logoutButton}>
                    <LogOut size={20} />
                    <span>로그아웃</span>
                </button>

                {/* 회원탈퇴 버튼 */}
                <button onClick={openDeleteModal} style={styles.deleteButton}>
                    <Trash2 size={20} />
                    <span>회원탈퇴</span>
                </button>
            </div>

            {/* 회원탈퇴 확인 모달 */}
            {showDeleteModal && (
                <div style={styles.modalOverlay}>
                    <div style={styles.modal}>
                        <h2 style={styles.modalTitle}>정말 탈퇴하시겠습니까?</h2>
                        <p style={styles.modalText}>
                            탈퇴 시 모든 지출 내역, AI 코칭 기록 등<br />
                            모든 데이터가 영구적으로 삭제됩니다.
                        </p>

                        {error && (
                            <div style={styles.errorBox}>{error}</div>
                        )}

                        <div style={styles.modalButtons}>
                            <button
                                onClick={closeDeleteModal}
                                style={styles.cancelButton}
                                disabled={isDeleting}
                            >
                                취소
                            </button>
                            <button
                                onClick={handleDeleteAccount}
                                style={styles.confirmDeleteButton}
                                disabled={isDeleting}
                            >
                                {isDeleting ? '탈퇴 처리 중...' : '탈퇴하기'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 나의 정보 모달 */}
            {showInfoModal && (
                <div style={styles.modalOverlay}>
                    <div style={{ ...styles.modal, maxWidth: '420px' }}>
                        <div style={styles.infoModalHeader}>
                            <h2 style={styles.modalTitle}>나의 정보</h2>
                            {!isEditing && (
                                <button onClick={() => setIsEditing(true)} style={styles.editButton}>
                                    <Edit2 size={18} />
                                </button>
                            )}
                        </div>

                        {error && (
                            <div style={styles.errorBox}>{error}</div>
                        )}

                        <div style={styles.infoList}>
                            <div style={styles.infoItem}>
                                <span style={styles.infoItemLabel}>나이</span>
                                {isEditing ? (
                                    <input
                                        type="number"
                                        value={editData.age}
                                        onChange={(e) => setEditData({ ...editData, age: e.target.value })}
                                        style={styles.infoInput}
                                    />
                                ) : (
                                    <span style={styles.infoItemValue}>{user?.age ? `${user.age}세` : '-'}</span>
                                )}
                            </div>
                            <div style={styles.infoItem}>
                                <span style={styles.infoItemLabel}>직업</span>
                                {isEditing ? (
                                    <input
                                        type="text"
                                        value={editData.job}
                                        onChange={(e) => setEditData({ ...editData, job: e.target.value })}
                                        style={styles.infoInput}
                                    />
                                ) : (
                                    <span style={styles.infoItemValue}>{user?.job || '-'}</span>
                                )}
                            </div>
                            <div style={styles.infoItem}>
                                <span style={styles.infoItemLabel}>취미</span>
                                {isEditing ? (
                                    <input
                                        type="text"
                                        value={editData.hobbies}
                                        onChange={(e) => setEditData({ ...editData, hobbies: e.target.value })}
                                        style={styles.infoInput}
                                    />
                                ) : (
                                    <span style={styles.infoItemValue}>{user?.hobbies || '-'}</span>
                                )}
                            </div>
                            <div style={styles.infoItem}>
                                <span style={styles.infoItemLabel}>결혼 유무</span>
                                {isEditing ? (
                                    <select
                                        value={editData.marital_status}
                                        onChange={(e) => setEditData({ ...editData, marital_status: e.target.value })}
                                        style={styles.infoInput}
                                    >
                                        <option value="SINGLE">미혼</option>
                                        <option value="MARRIED">기혼</option>
                                    </select>
                                ) : (
                                    <span style={styles.infoItemValue}>{user?.marital_status === 'MARRIED' ? '기혼' : '미혼'}</span>
                                )}
                            </div>
                            <div style={styles.infoItem}>
                                <span style={styles.infoItemLabel}>월 예산</span>
                                {isEditing ? (
                                    <input
                                        type="number"
                                        value={editData.monthly_budget}
                                        onChange={(e) => setEditData({ ...editData, monthly_budget: e.target.value })}
                                        style={styles.infoInput}
                                    />
                                ) : (
                                    <span style={styles.infoItemValue}>
                                        {user?.monthly_budget ? `${Number(user.monthly_budget).toLocaleString()}원` : '-'}
                                    </span>
                                )}
                            </div>
                            <div style={styles.infoItem}>
                                <span style={styles.infoItemLabel}>개선하고 싶은 소비</span>
                                {isEditing ? (
                                    <input
                                        type="text"
                                        value={editData.spending_to_improve}
                                        onChange={(e) => setEditData({ ...editData, spending_to_improve: e.target.value })}
                                        style={styles.infoInput}
                                    />
                                ) : (
                                    <span style={styles.infoItemValue}>{user?.spending_to_improve || '-'}</span>
                                )}
                            </div>
                        </div>

                        <div style={styles.modalButtons}>
                            {isEditing ? (
                                <>
                                    <button
                                        onClick={() => setIsEditing(false)}
                                        style={styles.cancelButton}
                                        disabled={isSaving}
                                    >
                                        취소
                                    </button>
                                    <button
                                        onClick={handleSaveInfo}
                                        style={styles.saveButton}
                                        disabled={isSaving}
                                    >
                                        {isSaving ? '저장 중...' : '저장'}
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={closeInfoModal}
                                    style={styles.closeButton}
                                >
                                    닫기
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const styles = {
    container: {
        padding: '1rem',
        minHeight: '100vh',
        backgroundColor: 'var(--background-light)',
    },
    loadingContainer: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '1.5rem',
        paddingTop: '0.5rem',
    },
    backButton: {
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        color: 'var(--text-main)',
        padding: '0.25rem',
    },
    title: {
        fontSize: '1.25rem',
        fontWeight: '600',
        color: 'var(--text-main)',
    },
    profileCard: {
        backgroundColor: 'white',
        borderRadius: 'var(--radius-lg)',
        padding: '1.5rem',
        boxShadow: 'var(--shadow-md)',
        marginBottom: '2rem',
    },
    avatarContainer: {
        display: 'flex',
        justifyContent: 'center',
        marginBottom: '1.5rem',
    },
    avatar: {
        width: '80px',
        height: '80px',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 8px 24px rgba(47, 133, 90, 0.3)',
    },
    userInfo: {
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
    },
    infoRow: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.5rem 0',
    },
    infoLabel: {
        fontSize: '0.875rem',
        color: 'var(--text-sub)',
        width: '50px',
    },
    infoValue: {
        fontSize: '1rem',
        fontWeight: '500',
        color: 'var(--text-main)',
        flex: 1,
    },
    divider: {
        height: '1px',
        backgroundColor: '#E2E8F0',
    },
    buttonContainer: {
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
    },
    logoutButton: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
        width: '100%',
        padding: '1rem',
        fontSize: '1rem',
        fontWeight: '600',
        color: 'var(--text-main)',
        backgroundColor: 'white',
        border: '1px solid #E2E8F0',
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
    },
    deleteButton: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
        width: '100%',
        padding: '1rem',
        fontSize: '1rem',
        fontWeight: '600',
        color: '#DC2626',
        backgroundColor: 'white',
        border: '1px solid #FCA5A5',
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
    },
    modalOverlay: {
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
        borderRadius: 'var(--radius-lg)',
        padding: '2rem',
        width: '100%',
        maxWidth: '360px',
        textAlign: 'center',
    },
    modalTitle: {
        fontSize: '1.25rem',
        fontWeight: '700',
        color: 'var(--text-main)',
        marginBottom: '1rem',
    },
    modalText: {
        fontSize: '0.95rem',
        color: 'var(--text-sub)',
        lineHeight: '1.5',
        marginBottom: '1.5rem',
    },
    errorBox: {
        backgroundColor: '#FEE2E2',
        color: '#DC2626',
        padding: '0.75rem 1rem',
        borderRadius: 'var(--radius-md)',
        fontSize: '0.875rem',
        marginBottom: '1rem',
    },
    modalButtons: {
        display: 'flex',
        gap: '1rem',
    },
    cancelButton: {
        flex: 1,
        padding: '0.875rem',
        fontSize: '1rem',
        fontWeight: '600',
        color: 'var(--text-main)',
        backgroundColor: '#F3F4F6',
        border: 'none',
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
    },
    confirmDeleteButton: {
        flex: 1,
        padding: '0.875rem',
        fontSize: '1rem',
        fontWeight: '600',
        color: 'white',
        backgroundColor: '#DC2626',
        border: 'none',
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
    },
    // 나의 정보 블록 스타일
    infoBlock: {
        backgroundColor: 'white',
        borderRadius: 'var(--radius-lg)',
        padding: '1rem 1.25rem',
        boxShadow: 'var(--shadow-md)',
        marginBottom: '1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
    },
    infoBlockContent: {
        display: 'flex',
        flexDirection: 'column',
        gap: '0.25rem',
    },
    infoBlockTitle: {
        fontSize: '1rem',
        fontWeight: '600',
        color: 'var(--text-main)',
    },
    infoBlockDesc: {
        fontSize: '0.875rem',
        color: 'var(--text-sub)',
    },
    // 나의 정보 모달 스타일
    infoModalHeader: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '1rem',
    },
    editButton: {
        background: 'none',
        border: 'none',
        color: 'var(--primary)',
        cursor: 'pointer',
        padding: '0.25rem',
    },
    infoList: {
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        marginBottom: '1.5rem',
        textAlign: 'left',
    },
    infoItem: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0.5rem 0',
        borderBottom: '1px solid #E2E8F0',
    },
    infoItemLabel: {
        fontSize: '0.875rem',
        color: 'var(--text-sub)',
        flexShrink: 0,
    },
    infoItemValue: {
        fontSize: '0.95rem',
        fontWeight: '500',
        color: 'var(--text-main)',
        textAlign: 'right',
    },
    infoInput: {
        width: '60%',
        padding: '0.5rem',
        fontSize: '0.95rem',
        border: '1px solid #E2E8F0',
        borderRadius: 'var(--radius-sm)',
        textAlign: 'right',
        outline: 'none',
    },
    saveButton: {
        flex: 1,
        padding: '0.875rem',
        fontSize: '1rem',
        fontWeight: '600',
        color: 'white',
        background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%)',
        border: 'none',
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
    },
    closeButton: {
        width: '100%',
        padding: '0.875rem',
        fontSize: '1rem',
        fontWeight: '600',
        color: 'var(--text-main)',
        backgroundColor: '#F3F4F6',
        border: 'none',
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
    },
};

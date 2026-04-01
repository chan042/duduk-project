"use client";

import { Loader2 } from 'lucide-react';

export default function ImageMatchStoreConfirm({
    previewUrl,
    storeName,
    manualStoreName,
    showManualStoreInput,
    onConfirm,
    onReject,
    onManualStoreNameChange,
    onSubmitManualStore,
    disabled = false,
    isResolving = false,
}) {
    const canSubmitManualStore = Boolean(manualStoreName.trim()) && !disabled;

    return (
        <div style={styles.container}>
            <div style={styles.previewShell}>
                {previewUrl ? (
                    <img
                        src={previewUrl}
                        alt="분석한 가게 이미지 미리보기"
                        style={styles.previewImage}
                    />
                ) : (
                    <div style={styles.previewFallback} />
                )}
            </div>

            {storeName ? (
                <>
                    <p style={styles.helperText}>이 가게가 맞나요?</p>
                    <h3 style={styles.storeTitle}>{storeName}</h3>
                </>
            ) : (
                <>
                    <p style={styles.helperText}>이미지에서 가게명을 특정하지 못했어요</p>
                    <h3 style={styles.storeTitle}>가게명을 직접 입력해주세요</h3>
                </>
            )}

            {!showManualStoreInput && storeName && (
                <div style={styles.buttonRow}>
                    <button
                        type="button"
                        onClick={onReject}
                        disabled={disabled || isResolving}
                        style={{
                            ...styles.secondaryButton,
                            opacity: disabled || isResolving ? 0.6 : 1,
                            cursor: disabled || isResolving ? 'not-allowed' : 'pointer',
                        }}
                    >
                        아니요
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={disabled || isResolving}
                        style={{
                            ...styles.primaryButton,
                            opacity: disabled || isResolving ? 0.6 : 1,
                            cursor: disabled || isResolving ? 'not-allowed' : 'pointer',
                        }}
                    >
                        {isResolving ? (
                            <>
                                <Loader2 size={18} className="animate-spin" />
                                분석 중...
                            </>
                        ) : (
                            '네'
                        )}
                    </button>
                </div>
            )}

            {showManualStoreInput && (
                <div style={styles.manualBlock}>
                    <input
                        type="text"
                        value={manualStoreName}
                        onChange={(event) => onManualStoreNameChange(event.target.value)}
                        placeholder="직접 가게명 입력하여 분석하기"
                        style={styles.manualInput}
                        disabled={disabled}
                    />
                    <button
                        type="button"
                        onClick={onSubmitManualStore}
                        disabled={!canSubmitManualStore || isResolving}
                        style={{
                            ...styles.singlePrimaryButton,
                            opacity: !canSubmitManualStore || isResolving ? 0.55 : 1,
                            cursor: !canSubmitManualStore || isResolving ? 'not-allowed' : 'pointer',
                        }}
                    >
                        {isResolving ? (
                            <>
                                <Loader2 size={18} className="animate-spin" />
                                분석 중...
                            </>
                        ) : (
                            '분석하기'
                        )}
                    </button>
                </div>
            )}
        </div>
    );
}

const styles = {
    container: {
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        paddingBottom: '0.5rem',
    },
    previewShell: {
        width: '100%',
        padding: '0.75rem',
        borderRadius: '28px',
        backgroundColor: '#ffffff',
    },
    previewImage: {
        width: '100%',
        height: '260px',
        objectFit: 'cover',
        borderRadius: '22px',
        display: 'block',
    },
    previewFallback: {
        height: '260px',
        borderRadius: '22px',
        backgroundColor: '#f8fafc',
    },
    helperText: {
        textAlign: 'center',
        fontSize: '0.92rem',
        color: 'var(--text-sub)',
        lineHeight: 1.5,
        wordBreak: 'keep-all',
    },
    storeTitle: {
        textAlign: 'center',
        fontSize: '1.55rem',
        lineHeight: 1.3,
        fontWeight: '900',
        color: 'var(--text-main)',
        letterSpacing: '-0.03em',
        wordBreak: 'keep-all',
    },
    buttonRow: {
        display: 'flex',
        gap: '0.75rem',
        marginTop: '0.5rem',
    },
    primaryButton: {
        flex: 1,
        height: '56px',
        border: 'none',
        borderRadius: '18px',
        backgroundColor: 'var(--primary)',
        color: '#ffffff',
        fontSize: '1.05rem',
        fontWeight: '800',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.45rem',
    },
    singlePrimaryButton: {
        width: '100%',
        height: '56px',
        border: 'none',
        borderRadius: '18px',
        backgroundColor: 'var(--primary)',
        color: '#ffffff',
        fontSize: '1.05rem',
        fontWeight: '800',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.45rem',
    },
    secondaryButton: {
        flex: 1,
        height: '56px',
        border: 'none',
        borderRadius: '18px',
        backgroundColor: '#e2e8f0',
        color: 'var(--text-main)',
        fontSize: '1.05rem',
        fontWeight: '800',
    },
    manualBlock: {
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        marginTop: '0.5rem',
    },
    manualInput: {
        width: '100%',
        height: '56px',
        border: 'none',
        outline: 'none',
        borderRadius: '18px',
        backgroundColor: '#eef2f6',
        padding: '0 1rem',
        fontSize: '1rem',
        fontWeight: '600',
        color: 'var(--text-main)',
    },
};

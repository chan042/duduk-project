"use client";

import { ChevronLeft, Loader2, X } from 'lucide-react';
import QuickAddInput from './QuickAddInput';
import ReceiptScan from './ReceiptScan';
import ImageMatching from './ImageMatching';
import ImageMatchEntry from './ImageMatchEntry';
import ImageMatchStoreConfirm from './ImageMatchStoreConfirm';
import TransactionConfirm from './TransactionConfirm';
import BottomSheet from '../common/BottomSheet';
import useQuickAddFlow, {
    QUICK_ADD_LOADING,
    QUICK_ADD_STEPS,
} from '../../hooks/useQuickAddFlow';

export default function QuickAddPopup({ onClose, onTransactionAdded, selectedDate }) {
    const {
        step,
        inputText,
        setInputText,
        loadingType,
        isLoading,
        parsedData,
        confirmOriginalInput,
        imageMatchState,
        handleRecordClick,
        handleReceiptScan,
        handleOpenImageMatch,
        handleImageSelect,
        handleAnalyzeStore,
        handleRejectAnalyzedStore,
        handleConfirmAnalyzedStore,
        handleSubmitManualStore,
        handleSave,
        handleClose,
        handleBack,
        setImageMatchMenuName,
        setManualStoreName,
    } = useQuickAddFlow({
        onClose,
        onTransactionAdded,
    });

    const showImageMatchBackButton = (
        step === QUICK_ADD_STEPS.IMAGE_MATCH_INPUT ||
        step === QUICK_ADD_STEPS.STORE_CONFIRM
    );

    const header = step === QUICK_ADD_STEPS.INPUT ? (
        <div style={styles.inputHeader}>
            <h2 style={styles.inputHeaderTitle}>Quick Add</h2>
            <button type="button" onClick={handleClose} style={styles.iconButton}>
                <X size={24} color="var(--text-main)" />
            </button>
        </div>
    ) : showImageMatchBackButton ? (
        <div style={styles.flowHeader}>
            <button
                type="button"
                onClick={handleBack}
                disabled={isLoading}
                style={{
                    ...styles.backButton,
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    opacity: isLoading ? 0.4 : 1,
                }}
            >
                <ChevronLeft size={22} color="var(--text-main)" />
            </button>
            <button type="button" onClick={handleClose} style={styles.iconButton}>
                <X size={24} color="var(--text-main)" />
            </button>
        </div>
    ) : (
        <div style={styles.closeHeader}>
            <button type="button" onClick={handleClose} style={styles.iconButton}>
                <X size={24} color="var(--text-main)" />
            </button>
        </div>
    );

    return (
        <BottomSheet
            isOpen
            onClose={handleClose}
            closeOnBackdrop={false}
            header={header}
            backgroundColor="var(--background-light)"
            padding="0.75rem 1.5rem 1.5rem"
            maxHeight="90vh"
        >
            {step === QUICK_ADD_STEPS.INPUT && (
                <>
                    <div style={styles.inputBody}>
                        <QuickAddInput value={inputText} onChange={setInputText} />

                        <div style={styles.quickActionRow}>
                            <ReceiptScan onImageSelect={handleReceiptScan} disabled={isLoading} />
                            <ImageMatching
                                onClick={handleOpenImageMatch}
                                disabled={isLoading}
                            />
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={handleRecordClick}
                        disabled={isLoading}
                        style={{
                            ...styles.primaryActionButton,
                            opacity: isLoading ? 0.7 : 1,
                            cursor: isLoading ? 'not-allowed' : 'pointer',
                        }}
                    >
                        {loadingType === QUICK_ADD_LOADING.PARSE ? (
                            <>
                                <Loader2 size={20} className="animate-spin" />
                                분석 중...
                            </>
                        ) : (
                            '기록하기'
                        )}
                    </button>
                </>
            )}

            {step === QUICK_ADD_STEPS.IMAGE_MATCH_INPUT && (
                <ImageMatchEntry
                    previewUrl={imageMatchState.imagePreviewUrl}
                    menuName={imageMatchState.menuName}
                    onMenuNameChange={setImageMatchMenuName}
                    onImageSelect={handleImageSelect}
                    onAnalyze={handleAnalyzeStore}
                    disabled={isLoading}
                    isAnalyzing={loadingType === QUICK_ADD_LOADING.ANALYZE_STORE}
                />
            )}

            {step === QUICK_ADD_STEPS.STORE_CONFIRM && (
                <ImageMatchStoreConfirm
                    previewUrl={imageMatchState.imagePreviewUrl}
                    storeName={imageMatchState.analyzedStoreName}
                    manualStoreName={imageMatchState.manualStoreName}
                    showManualStoreInput={imageMatchState.showManualStoreInput}
                    onConfirm={handleConfirmAnalyzedStore}
                    onReject={handleRejectAnalyzedStore}
                    onManualStoreNameChange={setManualStoreName}
                    onSubmitManualStore={handleSubmitManualStore}
                    disabled={isLoading}
                    isResolving={loadingType === QUICK_ADD_LOADING.RESOLVE_PRICE}
                />
            )}

            {step === QUICK_ADD_STEPS.CONFIRM && (
                <TransactionConfirm
                    initialData={parsedData}
                    onSave={handleSave}
                    isSaving={loadingType === QUICK_ADD_LOADING.SAVE}
                    selectedDate={selectedDate}
                    originalInput={confirmOriginalInput}
                />
            )}
        </BottomSheet>
    );
}

const styles = {
    inputHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1.25rem',
    },
    inputHeaderTitle: {
        fontSize: '1.25rem',
        fontWeight: '800',
        color: 'var(--text-main)',
    },
    closeHeader: {
        display: 'flex',
        justifyContent: 'flex-end',
        marginBottom: '0.5rem',
    },
    flowHeader: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '0.5rem',
    },
    iconButton: {
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
    },
    backButton: {
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.2rem',
        padding: 0,
        color: 'var(--text-main)',
        fontSize: '0.95rem',
        fontWeight: '700',
    },
    inputBody: {
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        marginBottom: '1.5rem',
    },
    quickActionRow: {
        display: 'flex',
        gap: '1rem',
    },
    primaryActionButton: {
        width: '100%',
        padding: '1rem',
        backgroundColor: 'var(--primary)',
        color: '#ffffff',
        border: 'none',
        borderRadius: '12px',
        fontSize: '1rem',
        fontWeight: '800',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
    },
};

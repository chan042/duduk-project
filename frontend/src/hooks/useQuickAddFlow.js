"use client";

import { useEffect, useRef, useState } from 'react';
import { parseTransaction, createTransaction } from '@/lib/api/transaction';
import { scanReceipt } from '@/lib/api/ocr';
import { analyzeStoreFromImage, resolveImageMatchPrice } from '@/lib/api/imageMatch';
import { isRequestCanceled } from '@/lib/api/helpers';

export const QUICK_ADD_STEPS = {
    INPUT: 'input',
    IMAGE_MATCH_INPUT: 'imageMatchInput',
    STORE_CONFIRM: 'storeConfirm',
    CONFIRM: 'confirm',
};

export const QUICK_ADD_LOADING = {
    PARSE: 'parse',
    OCR: 'ocr',
    ANALYZE_STORE: 'analyzeStore',
    RESOLVE_PRICE: 'resolvePrice',
    SAVE: 'save',
};

const createInitialImageMatchState = () => ({
    imageFile: null,
    imagePreviewUrl: '',
    menuName: '',
    analyzedStoreName: '',
    manualStoreName: '',
    showManualStoreInput: false,
    itemMatches: [],
    parsedItems: [],
    parseMode: '',
    imagePriceMatch: {
        found: false,
        amount: null,
        category: '기타',
        observedMenuName: '',
    },
});

const getAmountAnalysisStatus = (amount) => (
    typeof amount === 'number' && amount > 0 ? 'resolved' : 'failed'
);

export default function useQuickAddFlow({ onClose, onTransactionAdded } = {}) {
    const [step, setStep] = useState(QUICK_ADD_STEPS.INPUT);
    const [inputText, setInputText] = useState('');
    const [loadingType, setLoadingType] = useState(null);
    const [parsedData, setParsedData] = useState(null);
    const [confirmSource, setConfirmSource] = useState('text');
    const [imageMatchState, setImageMatchState] = useState(createInitialImageMatchState);
    const isMountedRef = useRef(false);
    const requestGenerationRef = useRef(0);
    const loadingTypeRef = useRef(null);
    const activeRequestControllerRef = useRef(null);

    useEffect(() => {
        isMountedRef.current = true;

        return () => {
            isMountedRef.current = false;
            requestGenerationRef.current += 1;
            activeRequestControllerRef.current?.abort();
            activeRequestControllerRef.current = null;
            loadingTypeRef.current = null;
        };
    }, []);

    useEffect(() => {
        return () => {
            if (imageMatchState.imagePreviewUrl?.startsWith('blob:')) {
                URL.revokeObjectURL(imageMatchState.imagePreviewUrl);
            }
        };
    }, [imageMatchState.imagePreviewUrl]);

    const isLoading = loadingType !== null;
    const confirmOriginalInput = confirmSource === 'text' ? inputText : '';
    const isInactiveRequest = (requestGeneration) => {
        return !isMountedRef.current || requestGeneration !== requestGenerationRef.current;
    };
    const setLoadingState = (nextLoadingType) => {
        loadingTypeRef.current = nextLoadingType;

        if (isMountedRef.current) {
            setLoadingType(nextLoadingType);
        }
    };
    const beginRequest = (nextLoadingType) => {
        if (loadingTypeRef.current !== null) {
            return null;
        }

        const controller = new AbortController();
        const requestGeneration = requestGenerationRef.current;

        activeRequestControllerRef.current = controller;
        setLoadingState(nextLoadingType);

        return {
            requestGeneration,
            signal: controller.signal,
        };
    };
    const finishRequest = (requestGeneration) => {
        activeRequestControllerRef.current = null;

        if (isInactiveRequest(requestGeneration)) {
            loadingTypeRef.current = null;
            return;
        }

        setLoadingState(null);
    };
    const handleClose = () => {
        requestGenerationRef.current += 1;
        activeRequestControllerRef.current?.abort();
        activeRequestControllerRef.current = null;
        setLoadingState(null);
        onClose?.();
    };

    const openConfirmStep = (data, source) => {
        setParsedData(data);
        setConfirmSource(source);
        setStep(QUICK_ADD_STEPS.CONFIRM);
    };

    const resetImageMatchState = () => {
        setImageMatchState((previousState) => {
            if (previousState.imagePreviewUrl?.startsWith('blob:')) {
                URL.revokeObjectURL(previousState.imagePreviewUrl);
            }

            return createInitialImageMatchState();
        });
    };

    const handleRecordClick = async () => {
        if (!inputText.trim()) {
            alert('내용을 입력해주세요.');
            return;
        }

        const request = beginRequest(QUICK_ADD_LOADING.PARSE);
        if (!request) {
            return;
        }

        try {
            const data = await parseTransaction(inputText, { signal: request.signal });

            if (isInactiveRequest(request.requestGeneration)) {
                return;
            }

            openConfirmStep(
                {
                    ...data,
                    amountAnalysisStatus: getAmountAnalysisStatus(data?.amount),
                },
                'text',
            );
        } catch (error) {
            if (isInactiveRequest(request.requestGeneration) || isRequestCanceled(error)) {
                return;
            }

            console.error('Failed to parse transaction:', error);
            alert(error.message || '분석에 실패했습니다. 다시 시도해주세요.');
        } finally {
            finishRequest(request.requestGeneration);
        }
    };

    const handleReceiptScan = async (imageFile) => {
        const request = beginRequest(QUICK_ADD_LOADING.OCR);
        if (!request) {
            return;
        }

        try {
            const data = await scanReceipt(imageFile, { signal: request.signal });

            if (isInactiveRequest(request.requestGeneration)) {
                return;
            }

            setInputText('');
            openConfirmStep(
                {
                    ...data,
                    amountAnalysisStatus: getAmountAnalysisStatus(data?.amount),
                },
                'receipt',
            );
        } catch (error) {
            if (isInactiveRequest(request.requestGeneration) || isRequestCanceled(error)) {
                return;
            }

            console.error('Failed to scan receipt:', error);
            alert(error.message || '영수증 분석에 실패했습니다. 다시 시도해주세요.');
        } finally {
            finishRequest(request.requestGeneration);
        }
    };

    const handleOpenImageMatch = () => {
        setParsedData(null);
        setConfirmSource('imageMatch');
        resetImageMatchState();
        setStep(QUICK_ADD_STEPS.IMAGE_MATCH_INPUT);
    };

    const handleImageSelect = (file) => {
        const previewUrl = URL.createObjectURL(file);

        setImageMatchState((previousState) => {
            if (previousState.imagePreviewUrl?.startsWith('blob:')) {
                URL.revokeObjectURL(previousState.imagePreviewUrl);
            }

            return {
                ...previousState,
                imageFile: file,
                imagePreviewUrl: previewUrl,
            };
        });
    };

    const handleAnalyzeStore = async () => {
        const normalizedMenuName = imageMatchState.menuName.trim();

        if (!imageMatchState.imageFile || !normalizedMenuName) {
            alert('사진과 메뉴명을 모두 입력해주세요.');
            return;
        }

        const request = beginRequest(QUICK_ADD_LOADING.ANALYZE_STORE);
        if (!request) {
            return;
        }

        try {
            const result = await analyzeStoreFromImage({
                imageFile: imageMatchState.imageFile,
                menuName: normalizedMenuName,
                signal: request.signal,
            });

            if (isInactiveRequest(request.requestGeneration)) {
                return;
            }

            setImageMatchState((previousState) => ({
                ...previousState,
                menuName: normalizedMenuName,
                analyzedStoreName: result.storeName || '',
                manualStoreName: '',
                showManualStoreInput: !result.storeName,
                itemMatches: result.itemMatches || [],
                parsedItems: result.parsedItems || [],
                parseMode: result.parseMode || '',
                imagePriceMatch: result.imagePriceMatch,
            }));
            setStep(QUICK_ADD_STEPS.STORE_CONFIRM);
        } catch (error) {
            if (isInactiveRequest(request.requestGeneration) || isRequestCanceled(error)) {
                return;
            }

            console.error('Failed to analyze store:', error);
            alert(error.message || '이미지 분석에 실패했습니다. 다시 시도해주세요.');
        } finally {
            finishRequest(request.requestGeneration);
        }
    };

    const handleRejectAnalyzedStore = () => {
        setImageMatchState((previousState) => ({
            ...previousState,
            showManualStoreInput: true,
            manualStoreName: '',
        }));
    };

    const openImagePriceMatchConfirm = (confirmedStoreName) => {
        const normalizedStoreName = confirmedStoreName.trim();
        const normalizedMenuName = imageMatchState.menuName.trim();
        const imagePriceMatch = imageMatchState.imagePriceMatch || {};

        openConfirmStep(
            {
                store: normalizedStoreName,
                item: imagePriceMatch.observedMenuName || normalizedMenuName,
                amount: imagePriceMatch.amount,
                category: imagePriceMatch.category || '기타',
                amountAnalysisStatus: 'resolved',
            },
            'imageMatch',
        );
    };

    const startPriceResolution = async (confirmedStoreName) => {
        const normalizedStoreName = confirmedStoreName.trim();
        const normalizedMenuName = imageMatchState.menuName.trim();

        if (!normalizedMenuName) {
            alert('메뉴명을 입력해주세요.');
            setStep(QUICK_ADD_STEPS.IMAGE_MATCH_INPUT);
            return;
        }

        const request = beginRequest(QUICK_ADD_LOADING.RESOLVE_PRICE);
        if (!request) {
            return;
        }

        try {
            const result = await resolveImageMatchPrice({
                confirmedStoreName: normalizedStoreName,
                menuName: normalizedMenuName,
                itemMatches: imageMatchState.itemMatches || [],
                parsedItems: imageMatchState.parsedItems || [],
                parseMode: imageMatchState.parseMode || '',
                signal: request.signal,
            });

            if (isInactiveRequest(request.requestGeneration)) {
                return;
            }

            openConfirmStep(
                {
                    ...result.prefill,
                    amountAnalysisStatus: result.status === 'failed' ? 'failed' : 'resolved',
                },
                'imageMatch',
            );
        } catch (error) {
            if (isInactiveRequest(request.requestGeneration) || isRequestCanceled(error)) {
                return;
            }

            console.error('Failed to resolve price:', error);
            alert(error.message || '가격 검색에 실패했습니다. 다시 시도해주세요.');
            setStep(QUICK_ADD_STEPS.STORE_CONFIRM);
        } finally {
            finishRequest(request.requestGeneration);
        }
    };

    const proceedWithConfirmedStore = (storeName, { onEmpty } = {}) => {
        const normalizedStoreName = storeName.trim();

        if (!normalizedStoreName) {
            onEmpty?.();
            return;
        }

        if (imageMatchState.imagePriceMatch?.found && imageMatchState.imagePriceMatch?.amount > 0) {
            openImagePriceMatchConfirm(normalizedStoreName);
            return;
        }

        startPriceResolution(normalizedStoreName);
    };

    const handleConfirmAnalyzedStore = () => {
        proceedWithConfirmedStore(imageMatchState.analyzedStoreName, {
            onEmpty: handleRejectAnalyzedStore,
        });
    };

    const handleSubmitManualStore = () => {
        proceedWithConfirmedStore(imageMatchState.manualStoreName, {
            onEmpty: () => alert('가게명을 입력해주세요.'),
        });
    };

    const handleSave = async (finalData) => {
        const request = beginRequest(QUICK_ADD_LOADING.SAVE);
        if (!request) {
            return;
        }

        try {
            await createTransaction(finalData, { signal: request.signal });

            if (isInactiveRequest(request.requestGeneration)) {
                onTransactionAdded?.();
                return;
            }

            alert('저장되었습니다!');
            onTransactionAdded?.();
            handleClose();
        } catch (error) {
            if (isInactiveRequest(request.requestGeneration) || isRequestCanceled(error)) {
                return;
            }

            console.error('Failed to save transaction:', error);
            alert(error.message || '저장에 실패했습니다.');
        } finally {
            finishRequest(request.requestGeneration);
        }
    };

    const handleBack = () => {
        if (loadingTypeRef.current !== null) {
            return;
        }

        if (step === QUICK_ADD_STEPS.IMAGE_MATCH_INPUT) {
            setStep(QUICK_ADD_STEPS.INPUT);
            return;
        }

        if (step === QUICK_ADD_STEPS.STORE_CONFIRM) {
            setStep(QUICK_ADD_STEPS.IMAGE_MATCH_INPUT);
        }
    };

    return {
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
        setImageMatchMenuName: (menuName) => {
            setImageMatchState((previousState) => ({
                ...previousState,
                menuName,
            }));
        },
        setManualStoreName: (manualStoreName) => {
            setImageMatchState((previousState) => ({
                ...previousState,
                manualStoreName,
            }));
        },
    };
}

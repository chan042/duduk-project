import client from './client';
import { extractApiErrorMessage, isRequestCanceled } from './helpers';
import { prepareImagePayload } from '../utils/imageUtils';

const normalizeImagePriceMatch = (imagePriceMatch = {}) => ({
    found: Boolean(imagePriceMatch?.found),
    amount: imagePriceMatch?.amount ?? null,
    category: imagePriceMatch?.category || '기타',
    observedMenuName: imagePriceMatch?.observed_menu_name || '',
});

const normalizeItemMatch = (itemMatch = {}) => ({
    requestedName: itemMatch?.requested_name || '',
    quantity: itemMatch?.quantity ?? 1,
    found: Boolean(itemMatch?.found),
    unitAmount: itemMatch?.unit_amount ?? null,
    category: itemMatch?.category || '기타',
    observedMenuName: itemMatch?.observed_menu_name || '',
});

const normalizeParsedItem = (parsedItem = {}) => ({
    name: parsedItem?.name || '',
    quantity: parsedItem?.quantity ?? 1,
});

const normalizeAnalyzeStoreResponse = (data = {}) => ({
    storeName: data?.store_name || '',
    imagePriceMatch: normalizeImagePriceMatch(data?.image_price_match),
    itemMatches: Array.isArray(data?.item_matches) ? data.item_matches.map(normalizeItemMatch) : [],
    parsedItems: Array.isArray(data?.parsed_items) ? data.parsed_items.map(normalizeParsedItem) : [],
    parseMode: data?.parse_mode || '',
});

const normalizeResolvePriceResponse = (data = {}) => ({
    status: data?.status || 'failed',
    prefill: {
        store: data?.prefill?.store || '',
        item: data?.prefill?.item || '',
        amount: data?.prefill?.amount ?? null,
        category: data?.prefill?.category || '기타',
        date: data?.prefill?.date || '',
    },
});

const serializeItemMatch = (itemMatch = {}) => ({
    requested_name: itemMatch?.requestedName || '',
    quantity: itemMatch?.quantity ?? 1,
    found: Boolean(itemMatch?.found),
    unit_amount: itemMatch?.unitAmount ?? null,
    category: itemMatch?.category || '기타',
    observed_menu_name: itemMatch?.observedMenuName || '',
});

const serializeParsedItem = (parsedItem = {}) => ({
    name: parsedItem?.name || '',
    quantity: parsedItem?.quantity ?? 1,
});

export const analyzeStoreFromImage = async ({ imageFile, menuName, signal }) => {
    if (!menuName?.trim()) {
        throw new Error('메뉴명을 입력해주세요.');
    }

    try {
        const { imageData, format } = await prepareImagePayload(imageFile, 10);

        const response = await client.post(
            '/api/transactions/image-match/analyze-store/',
            {
                imageData,
                format,
                menu_name: menuName.trim(),
            },
            {
                signal,
            }
        );

        return normalizeAnalyzeStoreResponse(response.data);
    } catch (error) {
        if (isRequestCanceled(error)) {
            throw error;
        }

        console.error('이미지 매칭 가게 분석 오류:', error);
        throw new Error(extractApiErrorMessage(error, '이미지 분석에 실패했습니다. 다시 시도해주세요.', {
            timeoutMessage: '이미지 분석 서버가 바쁩니다. 잠시 후 다시 시도해주세요.',
            statusMessages: {
                404: '이미지 매칭 API가 아직 준비되지 않았습니다.',
            },
        }));
    }
};

export const resolveImageMatchPrice = async ({
    confirmedStoreName,
    menuName,
    itemMatches = [],
    parsedItems = [],
    parseMode = '',
    signal,
}) => {
    if (!confirmedStoreName?.trim()) {
        throw new Error('가게명을 입력해주세요.');
    }

    if (!menuName?.trim()) {
        throw new Error('메뉴명을 입력해주세요.');
    }

    try {
        const response = await client.post(
            '/api/transactions/image-match/resolve-price/',
            {
                confirmed_store_name: confirmedStoreName.trim(),
                menu_name: menuName.trim(),
                item_matches: itemMatches.map(serializeItemMatch),
                parsed_items: parsedItems.map(serializeParsedItem),
                parse_mode: parseMode || undefined,
            },
            {
                signal,
            }
        );

        return normalizeResolvePriceResponse(response.data);
    } catch (error) {
        if (isRequestCanceled(error)) {
            throw error;
        }

        console.error('이미지 매칭 가격 검색 오류:', error);
        throw new Error(extractApiErrorMessage(error, '가격 검색에 실패했습니다. 다시 시도해주세요.', {
            timeoutMessage: '이미지 분석 서버가 바쁩니다. 잠시 후 다시 시도해주세요.',
            statusMessages: {
                404: '이미지 매칭 API가 아직 준비되지 않았습니다.',
            },
        }));
    }
};

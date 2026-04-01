import client from './client';
import { extractApiErrorMessage, isRequestCanceled } from './helpers';
import { prepareImagePayload } from '../utils/imageUtils';

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
                timeout: 30000,
            }
        );

        return response.data;
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

export const resolveImageMatchPrice = async ({ confirmedStoreName, menuName, confirmationType, signal }) => {
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
                confirmation_type: confirmationType,
            },
            {
                signal,
                timeout: 30000,
            }
        );

        return response.data;
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

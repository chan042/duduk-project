/**
 * 영수증 OCR 서비스
 * 이미지를 백엔드 OCR API로 전송하여 지출 정보 추출
 */
import client from './client';
import { extractApiErrorMessage, isRequestCanceled } from './helpers';
import { prepareImagePayload } from '../utils/imageUtils';

/**
 * 영수증 이미지를 OCR 분석하여 지출 정보 추출
 * @param {File} imageFile - 영수증 이미지 파일
 * @returns {Promise<Object>} 파싱된 지출 정보
 */
export const scanReceipt = async (imageFile, options = {}) => {
    try {
        const { imageData, format } = await prepareImagePayload(imageFile, 10);

        const response = await client.post(
            '/api/transactions/ocr/',
            {
                imageData,
                format,
            },
            {
                signal: options.signal,
            },
        );

        return response.data.data;
    } catch (error) {
        if (isRequestCanceled(error)) {
            throw error;
        }

        console.error('OCR 스캔 오류:', error);
        throw new Error(extractApiErrorMessage(error, '영수증 분석에 실패했습니다. 다시 시도해주세요.'));
    }
};

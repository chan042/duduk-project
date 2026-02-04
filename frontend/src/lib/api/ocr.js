/**
 * 영수증 OCR 서비스
 * 이미지를 서버 API Route로 전송하여 지출 정보 추출
 */
import client from './client';
import { fileToBase64, getImageFormat, validateImageFile } from '../utils/imageUtils';

/**
 * 영수증 이미지를 OCR 분석하여 지출 정보 추출
 * @param {File} imageFile - 영수증 이미지 파일
 * @returns {Promise<Object>} 파싱된 지출 정보
 */
export const scanReceipt = async (imageFile) => {
    // 파일 유효성 검사
    const validation = validateImageFile(imageFile, 10);
    if (!validation.valid) {
        throw new Error(validation.error);
    }

    try {
        // 이미지를 Base64로 변환
        const imageData = await fileToBase64(imageFile);
        const format = getImageFormat(imageFile);

        // 서버 API Route 호출 (client.js 인터셉터가 자동으로 토큰 첨부)
        const response = await client.post('/api/ocr', {
            imageData,
            format
        });

        return response.data.data;
    } catch (error) {
        console.error('OCR 스캔 오류:', error);
        // axios 에러인 경우 서버 응답 메시지 추출
        if (error.response?.data?.error) {
            throw new Error(error.response.data.error);
        }
        throw error;
    }
};

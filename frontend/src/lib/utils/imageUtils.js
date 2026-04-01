/**
 * 이미지 처리 유틸리티
 * 이미지 파일을 Base64로 변환, 포맷 추출, 유효성 검사 등
 */

const IMAGE_MIME_TYPE_TO_FORMAT = {
    'image/jpg': 'jpg',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/bmp': 'bmp',
    'image/tiff': 'tiff',
    'image/webp': 'webp',
    'image/heic': 'heic',
    'image/heif': 'heif',
};

const IMAGE_EXTENSION_TO_FORMAT = {
    'jpg': 'jpg',
    'jpeg': 'jpg',
    'png': 'png',
    'gif': 'gif',
    'bmp': 'bmp',
    'tiff': 'tiff',
    'tif': 'tiff',
    'webp': 'webp',
    'heic': 'heic',
    'heif': 'heif'
};

/**
 * 이미지 파일을 Base64로 변환
 * @param {File} file - 이미지 파일
 * @returns {Promise<string>} Base64 인코딩된 이미지 데이터
 */
export const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const base64 = reader.result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = (error) => reject(error);
    });
};

/**
 * 파일 확장자에서 이미지 포맷 추출
 * @param {File} file - 이미지 파일
 * @returns {string} 이미지 포맷 (jpg, png 등)
 */
export const getImageFormat = (file) => {
    const mimeType = (file?.type || '').toLowerCase();
    if (mimeType && IMAGE_MIME_TYPE_TO_FORMAT[mimeType]) {
        return IMAGE_MIME_TYPE_TO_FORMAT[mimeType];
    }

    const extension = (file?.name || '').split('.').pop().toLowerCase();
    return IMAGE_EXTENSION_TO_FORMAT[extension] || '';
};

/**
 * 이미지 파일 유효성 검사
 * @param {File} file - 이미지 파일
 * @param {number} maxSizeMB - 최대 파일 크기 (MB)
 * @returns {{ valid: boolean, error?: string }} 유효성 검사 결과
 */
export const validateImageFile = (file, maxSizeMB = 10) => {
    if (!file) {
        return { valid: false, error: '파일이 선택되지 않았습니다.' };
    }

    // 파일 타입 검사
    if (file.type && !file.type.startsWith('image/')) {
        return { valid: false, error: '이미지 파일만 업로드 가능합니다.' };
    }

    // 파일 크기 검사
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
        return { valid: false, error: `파일 크기는 ${maxSizeMB}MB 이하여야 합니다.` };
    }

    return { valid: true };
};

/**
 * 이미지 업로드 payload 준비
 * @param {File} file - 이미지 파일
 * @param {number} maxSizeMB - 최대 파일 크기 (MB)
 * @returns {Promise<{imageData: string, format: string}>}
 */
export const prepareImagePayload = async (file, maxSizeMB = 10) => {
    const validation = validateImageFile(file, maxSizeMB);
    if (!validation.valid) {
        throw new Error(validation.error);
    }

    const imageData = await fileToBase64(file);
    const format = getImageFormat(file);
    if (!format) {
        throw new Error('지원하지 않는 이미지 형식입니다.');
    }

    return {
        imageData,
        format,
    };
};

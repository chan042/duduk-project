/**
 * 이미지 처리 유틸리티
 * 이미지 파일을 Base64로 변환, 포맷 추출, 유효성 검사 등
 */

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
    const extension = file.name.split('.').pop().toLowerCase();
    const formatMap = {
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
    return formatMap[extension] || 'jpg';
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
    if (!file.type.startsWith('image/')) {
        return { valid: false, error: '이미지 파일만 업로드 가능합니다.' };
    }

    // 파일 크기 검사
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
        return { valid: false, error: `파일 크기는 ${maxSizeMB}MB 이하여야 합니다.` };
    }

    return { valid: true };
};

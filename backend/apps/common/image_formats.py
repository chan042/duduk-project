# 이미지 포맷 관련 공통 상수

# 확장자 → 정규화된 포맷 (serializer 검증, 뷰 변환에 사용)
IMAGE_FORMAT_MAP = {
    'jpg': 'jpg',
    'jpeg': 'jpg',
    'png': 'png',
    'gif': 'gif',
    'bmp': 'bmp',
    'tiff': 'tiff',
    'tif': 'tiff',
    'webp': 'webp',
    'heic': 'heic',
    'heif': 'heif',
}

# 정규화된 포맷 → MIME 타입 (AI 클라이언트 이미지 전송에 사용)
IMAGE_FORMAT_TO_MIME_TYPE = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'bmp': 'image/bmp',
    'tif': 'image/tiff',
    'tiff': 'image/tiff',
    'webp': 'image/webp',
    'heic': 'image/heic',
    'heif': 'image/heif',
}

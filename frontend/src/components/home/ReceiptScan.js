"use client";

import { useRef } from 'react';
import { Camera } from 'lucide-react';

/**
 * 영수증 스캔 버튼 컴포넌트
 * 모바일: 카메라 앱 직접 실행 (capture="environment")
 * 데스크톱: 파일 선택 다이얼로그
 * 
 * @param {Object} props
 * @param {Function} props.onImageSelect - 이미지 선택 시 호출되는 콜백 (File 객체 전달)
 * @param {boolean} props.disabled - 비활성화 여부
 */
export default function ReceiptScan({ onImageSelect, disabled = false }) {
    const fileInputRef = useRef(null);

    // 버튼 클릭 시 파일 입력 트리거
    const handleButtonClick = () => {
        if (!disabled && fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    // 파일 선택 시 콜백 호출
    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (file && onImageSelect) {
            onImageSelect(file);
        }
        // 같은 파일 재선택을 위해 값 초기화
        e.target.value = '';
    };

    return (
        <>
            {/* 숨겨진 파일 입력 */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"  // 모바일
                onChange={handleFileChange}
                style={{ display: 'none' }}
                disabled={disabled}
            />

            {/* 스캔 버튼 */}
            <button
                onClick={handleButtonClick}
                disabled={disabled}
                style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: disabled ? 'var(--background-muted, #f0f0f0)' : 'var(--card-bg)',
                    borderRadius: '12px',
                    padding: '1.5rem',
                    border: 'none',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    gap: '0.5rem',
                    opacity: disabled ? 0.6 : 1
                }}
            >
                <Camera color={disabled ? '#999' : 'var(--primary)'} size={28} />
                <span style={{
                    fontSize: '0.95rem',
                    fontWeight: 'bold',
                    color: disabled ? '#999' : 'var(--text-main)'
                }}>
                    영수증 스캔
                </span>
            </button>
        </>
    );
}

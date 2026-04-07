"use client";

import { Camera } from 'lucide-react';
import useImagePicker from '@/hooks/useImagePicker';

/**
 * 영수증 스캔 버튼 컴포넌트
 * 모바일: 시스템 이미지 선택지 노출
 * 데스크톱: 파일 선택 다이얼로그
 * 
 * @param {Object} props
 * @param {Function} props.onImageSelect - 이미지 선택 시 호출되는 콜백 (File 객체 전달)
 * @param {boolean} props.disabled - 비활성화 여부
 */
export default function ReceiptScan({ onImageSelect, disabled = false }) {
    const {
        fileInputRef,
        isBusy,
        openImagePicker,
        handleFileChange,
    } = useImagePicker({
        onSelect: onImageSelect,
        disabled,
    });

    return (
        <>
            {/* 숨겨진 파일 입력 */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                style={{ display: 'none' }}
                disabled={isBusy}
            />

            {/* 스캔 버튼 */}
            <button
                onClick={openImagePicker}
                disabled={isBusy}
                style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'var(--card-bg)',
                    borderRadius: '12px',
                    padding: '1.5rem',
                    border: 'none',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                    cursor: isBusy ? 'not-allowed' : 'pointer',
                    gap: '0.5rem',
                    opacity: isBusy ? 0.7 : 1
                }}
            >
                <Camera color="var(--primary)" size={28} />
                <span style={{
                    fontSize: '0.95rem',
                    fontWeight: 'bold',
                    color: 'var(--text-main)'
                }}>
                    영수증 스캔
                </span>
            </button>
        </>
    );
}

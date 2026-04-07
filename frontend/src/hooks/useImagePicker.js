"use client";

import { useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { canUseNativeImagePrompt, pickImageWithPrompt } from '@/lib/capacitor/camera';

export default function useImagePicker({ onSelect, disabled = false } = {}) {
    const { isNativeApp } = useAuth();
    const fileInputRef = useRef(null);
    const [isPickingImage, setIsPickingImage] = useState(false);
    const isBusy = disabled || isPickingImage;

    const openSystemChooser = () => {
        if (!fileInputRef.current) {
            return;
        }

        fileInputRef.current.removeAttribute('capture');
        fileInputRef.current.click();
    };

    const openImagePicker = async () => {
        if (isBusy) {
            return;
        }

        if (isNativeApp && canUseNativeImagePrompt()) {
            setIsPickingImage(true);

            try {
                const file = await pickImageWithPrompt();

                if (file && onSelect) {
                    onSelect(file);
                }
            } catch (error) {
                console.error('네이티브 이미지 선택 실패:', error);
                alert('이미지를 불러오지 못했습니다. 다시 시도해주세요.');
            } finally {
                setIsPickingImage(false);
            }

            return;
        }

        openSystemChooser();
    };

    const handleFileChange = (event) => {
        const file = event.target.files?.[0];
        if (file && onSelect) {
            onSelect(file);
        }
        event.target.value = '';
    };

    return {
        fileInputRef,
        isBusy,
        isPickingImage,
        openSystemChooser,
        openImagePicker,
        handleFileChange,
    };
}

"use client";
// Quick Add에서 자연어 분석 후 상세 정보를 입력/수정하는 화면


// 외부 라이브러리 및 아이콘 임포트
import { Edit2, MapPin, Calendar, X } from 'lucide-react';
import { useState, useEffect } from 'react';

import CalculatorInput from '../common/CalculatorInput';       // 금액 계산기 모달
import CategoryPickerSheet from '../common/CategoryPickerSheet';
import DateWheelPicker from '../common/DateWheelPicker';       // 날짜 휠 선택 모달
import KakaoLocationPicker from '../common/KakaoLocationPicker'; // 카카오맵 장소 검색 모달
import { getCategoryIcon, CATEGORY_COLORS, normalizeCategory } from '../common/CategoryIcons'; // 카테고리 아이콘/색상

// ============================================================
// 헬퍼 함수: 초기 위치 데이터 보정
// 주소가 없고 원본 입력이 있는 경우, 원본 입력에서 금액/상품명을 제외한 텍스트를 장소명으로 사용
// ============================================================
const getSmartLocation = (data, input) => {
    const address = (data?.address || '').trim();
    let placeName = data?.store || '';

    // 1. 주소 유무와 관계없이 원본 입력이 있으면 보정 시도
    if (input) {
        let cleaned = input;

        // 금액 제거
        cleaned = cleaned.replace(/(\s|^)(₩?[\d,]+원?)(\s|$)/g, ' ').trim();

        // 상품명(item) 제거 방어 로직
        const initialItem = (data?.item || '').trim();
        if (initialItem && cleaned.includes(initialItem)) {
            const candidate = cleaned.replace(initialItem, '').trim();
            // 제거 후 빈 문자열이 되면 제거하지 않음 (예: item이 "구로역 할리스커피" 전체인 경우)
            if (candidate.length > 0) {
                cleaned = candidate;
            }
        }

        // 공백 정리
        cleaned = cleaned.replace(/\s+/g, ' ').trim();

        if (cleaned) {
            placeName = cleaned;
        }
    }

    return {
        address,
        placeName,
        lat: null,
        lng: null
    };
};



export default function TransactionConfirm({
    initialData,
    onSave,
    isSaving = false,
    selectedDate,
    originalInput = '',
}) {
    // --------------------------------------------------------------------------------
    // 1. State Declarations (Must be at the top to avoid TDZ)
    // --------------------------------------------------------------------------------

    // 폼 입력 상태
    const [amount, setAmount] = useState(initialData?.amount ?? null);        // 금액
    const [category, setCategory] = useState(initialData?.category || '카페/간식'); // 카테고리
    const [item, setItem] = useState(initialData?.item || '');                 // 상품명
    const [store, setStore] = useState(initialData?.store || '');              // 소비처
    const [rawDate, setRawDate] = useState(                                    // 날짜
        selectedDate ? new Date(selectedDate) : (initialData?.date ? new Date(initialData.date) : new Date())
    );

    // 위치 정보 상태
    const [location, setLocation] = useState(() => getSmartLocation(initialData, originalInput));

    // 고정 지출 여부 토글 상태
    const [isRecurring, setIsRecurring] = useState(false);

    // 모달 표시 상태
    const [showCalculator, setShowCalculator] = useState(false);      // 금액 계산기 모달
    const [showDatePicker, setShowDatePicker] = useState(false);      // 날짜 선택 모달
    const [showCategoryPicker, setShowCategoryPicker] = useState(false); // 카테고리 선택 모달
    const [showLocationPicker, setShowLocationPicker] = useState(false); // 장소 검색 모달
    const [showAmountErrorOverlay, setShowAmountErrorOverlay] = useState(false);
    const [amountErrorOverlayKey, setAmountErrorOverlayKey] = useState(0);

    // --------------------------------------------------------------------------------
    // 2. Helper Functions & Effects
    // --------------------------------------------------------------------------------

    // useEffect - 초기 데이터 동기화
    // AI 분석이 완료되어 initialData가 변경되면 폼 상태를 업데이트
    useEffect(() => {
        if (initialData) {
            setAmount(initialData.amount ?? null);
            setCategory(initialData.category || '카페/간식');
            setItem(initialData.item || '');
            setStore(initialData.store || '');
            setRawDate(
                selectedDate ? new Date(selectedDate) : (initialData.date ? new Date(initialData.date) : new Date())
            );
            setLocation(getSmartLocation(initialData, originalInput));
        }
    }, [initialData, selectedDate, originalInput]);

    const hasValidAmount = typeof amount === 'number' && amount > 0;
    const showImageMatchPriceFailureMessage = initialData?.imageMatchStatus === 'not_found' && !hasValidAmount;
    const showAmountDash = showImageMatchPriceFailureMessage;

    useEffect(() => {
        if (hasValidAmount && showAmountErrorOverlay) {
            setShowAmountErrorOverlay(false);
        }
    }, [hasValidAmount, showAmountErrorOverlay]);

    useEffect(() => {
        if (!showAmountErrorOverlay) {
            return undefined;
        }

        const timeoutId = window.setTimeout(() => {
            setShowAmountErrorOverlay(false);
        }, 2500);

        return () => window.clearTimeout(timeoutId);
    }, [showAmountErrorOverlay, amountErrorOverlayKey]);




    // 날짜 포맷팅
    const formatDateDisplay = () => {
        const month = rawDate.getMonth() + 1;
        const day = rawDate.getDate();
        return `${month}월 ${day}일`;
    };

    // 카테고리에 해당하는 색상 반환
    const getCategoryColor = (cat) => {
        const normalized = normalizeCategory(cat);
        return CATEGORY_COLORS[normalized] || '#f59e0b';
    };

    const handleSaveClick = () => {
        if (isSaving) {
            return;
        }

        if (!hasValidAmount) {
            if (showImageMatchPriceFailureMessage) {
                alert('가격 분석에 실패했습니다. 금액을 직접 입력해주세요.');
                return;
            }

            setAmountErrorOverlayKey((prev) => prev + 1);
            setShowAmountErrorOverlay(true);
            return;
        }

        onSave({
            amount,
            category,
            item,
            store,
            date: rawDate.toISOString(),
            is_fixed: isRecurring,
            address: location.placeName && location.address
                ? `${location.placeName} | ${location.address}`
                : (location.placeName || location.address)
        });
    };

    // 렌더링
    return (
        <div style={styles.container}>

            {/* ----------------------------------------
                섹션 1: 금액 표시 (헤더)
                - 클릭하면 계산기 모달이 열림
            ---------------------------------------- */}
            <div
                onClick={() => setShowCalculator(true)}
                style={styles.amountRow}
            >
                <span style={{
                    ...styles.amountText,
                    color: hasValidAmount || showAmountDash ? 'var(--text-main)' : 'var(--primary)',
                }}>
                    {hasValidAmount ? `₩${amount.toLocaleString()}` : (showAmountDash ? '₩0' : '금액을 입력해주세요')}
                </span>
                <Edit2 size={18} color="var(--text-sub)" />
            </div>

            {!hasValidAmount && (
                <p style={{
                    ...styles.amountHint,
                    ...(showImageMatchPriceFailureMessage ? styles.amountErrorHint : null),
                }}>
                    {showImageMatchPriceFailureMessage
                        ? '가격 분석에 실패했습니다. 금액을 직접 입력해주세요.'
                        : '금액을 직접 입력해주세요.'}
                </p>
            )}

            {/* ----------------------------------------
                섹션 2: 카테고리 & 날짜 선택 버튼 (가로 배치)
            ---------------------------------------- */}
            <div style={styles.pickerRow}>
                {/* 카테고리 선택 버튼 */}
                <div
                    onClick={() => setShowCategoryPicker(true)}
                    style={styles.pickerCard}
                >
                    <div style={{
                        ...styles.pickerIcon,
                        backgroundColor: `${getCategoryColor(category)}20`,
                    }}>
                        {getCategoryIcon(category, 20)}
                    </div>
                    <div>
                        <p style={styles.pickerLabel}>카테고리</p>
                        <p style={styles.pickerValue}>{category}</p>
                    </div>
                </div>

                {/* 날짜 선택 버튼 */}
                <div
                    onClick={() => setShowDatePicker(true)}
                    style={styles.pickerCard}
                >
                    <div style={{ ...styles.pickerIcon, backgroundColor: '#f0f9ff' }}>
                        <Calendar size={20} color="#3b82f6" />
                    </div>
                    <div>
                        <p style={styles.pickerLabel}>날짜</p>
                        <p style={styles.pickerValue}>{formatDateDisplay()}</p>
                    </div>
                </div>
            </div>

            {/* ----------------------------------------
                섹션 3: 상품명 입력
            ---------------------------------------- */}
            <div style={styles.fieldBlock}>
                <label style={styles.fieldLabel}>상품명</label>
                <input
                    type="text"
                    value={item}
                    onChange={(e) => setItem(e.target.value)}
                    placeholder="상품명을 입력하세요"
                    style={styles.fieldInput}
                />
            </div>

            {/* ----------------------------------------
                섹션 4: 소비처 입력
            ---------------------------------------- */}
            <div style={styles.fieldBlock}>
                <label style={styles.fieldLabel}>소비처</label>
                <input
                    type="text"
                    value={store}
                    onChange={(e) => setStore(e.target.value)}
                    placeholder="소비처를 입력하세요"
                    style={styles.fieldInput}
                />
            </div>

            {/* ----------------------------------------
                섹션 5: 장소 검색
            ---------------------------------------- */}
            <div style={styles.fieldBlock}>
                <label style={styles.fieldLabel}>장소 검색</label>

                <div style={styles.locationRow}>
                    {/* 장소명 입력 필드 */}
                    <div style={styles.locationInputWrapper}>
                        <input
                            type="text"
                            value={location.placeName || location.address || ''}
                            onChange={(e) => setLocation({
                                ...location,
                                placeName: e.target.value,
                                address: location.address || e.target.value
                            })}
                            placeholder="장소를 검색하세요"
                            style={styles.locationInput}
                        />
                        {(location.placeName || location.address) && (
                            <button
                                onClick={() => setLocation({
                                    placeName: '',
                                    address: '',
                                    lat: null,
                                    lng: null
                                })}
                                style={styles.locationClearButton}
                            >
                                <X size={16} />
                            </button>
                        )}
                    </div>

                    {/* 미니맵 영역 */}
                    <div
                        onClick={() => setShowLocationPicker(true)}
                        style={styles.minimapShell}
                    >
                        {location.lat && location.lng ? (
                            <img
                                src={`https://dapi.kakao.com/v2/local/map/staticmap.png?appkey=${process.env.NEXT_PUBLIC_KAKAO_JS_KEY}&center=${location.lng},${location.lat}&level=3&w=96&h=96&marker=color:red|pos:${location.lng},${location.lat}`}
                                alt="위치 미리보기"
                                style={styles.minimapImage}
                                onError={(e) => {
                                    e.target.style.display = 'none';
                                    e.target.nextSibling.style.display = 'flex';
                                }}
                            />
                        ) : null}
                        <div style={{
                            ...styles.minimapFallback,
                            display: location.lat && location.lng ? 'none' : 'flex',
                        }}>
                            <MapPin size={24} color="var(--primary)" />
                        </div>
                    </div>
                </div>

                <p style={styles.locationHint}>썸네일을 누르면 지도를 크게 볼 수 있습니다.</p>
            </div>

            {/* ----------------------------------------
                섹션 6: 고정 지출 토글
            ---------------------------------------- */}
            <div style={styles.toggleRow}>
                <span style={styles.toggleLabel}>고정 지출에 추가</span>
                <div
                    onClick={() => setIsRecurring(!isRecurring)}
                    style={{
                        ...styles.toggleTrack,
                        backgroundColor: isRecurring ? 'var(--primary)' : '#cbd5e0',
                    }}
                >
                    <div style={{
                        ...styles.toggleThumb,
                        left: isRecurring ? '24px' : '2px',
                    }} />
                </div>
            </div>

            {/* ----------------------------------------
                섹션 7: 저장 버튼
            ---------------------------------------- */}
            <button
                type="button"
                onClick={handleSaveClick}
                disabled={isSaving}
                style={{
                    ...styles.saveButton,
                    cursor: isSaving ? 'not-allowed' : 'pointer',
                    opacity: hasValidAmount ? 1 : 0.7,
                }}
            >
                {isSaving ? '저장 중...' : '저장'}
            </button>

            {/* ========================================
                모달 컴포넌트들
            ======================================== */}

            <CalculatorInput
                isOpen={showCalculator}
                onClose={() => setShowCalculator(false)}
                initialValue={amount ?? 0}
                onConfirm={(newAmount) => setAmount(newAmount)}
            />

            <DateWheelPicker
                isOpen={showDatePicker}
                onClose={() => setShowDatePicker(false)}
                initialDate={rawDate}
                onConfirm={(newDate) => setRawDate(newDate)}
            />

            <KakaoLocationPicker
                isOpen={showLocationPicker}
                onClose={() => setShowLocationPicker(false)}
                onConfirm={(newLocation) => setLocation(newLocation)}
                initialAddress={location.address}
                initialPlaceName={location.address && store ? `${location.address} ${store}` : (store || location.address)}
            />

            <CategoryPickerSheet
                isOpen={showCategoryPicker}
                selectedCategory={category}
                onSelect={setCategory}
                onClose={() => setShowCategoryPicker(false)}
                zIndex={2000}
            />

            {showAmountErrorOverlay && (
                <div style={styles.amountErrorOverlay}>
                    <div
                        key={amountErrorOverlayKey}
                        style={styles.amountErrorToast}
                        role="alert"
                        aria-live="assertive"
                    >
                        금액을 입력해주세요
                    </div>
                </div>
            )}
        </div>
    );
}

const styles = {
    container: {
        paddingBottom: '1rem',
    },
    amountRow: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        marginBottom: '1.5rem',
        cursor: 'pointer',
    },
    amountText: {
        fontSize: '1.75rem',
        fontWeight: '800',
    },
    amountHint: {
        marginTop: '-1rem',
        marginBottom: '1.25rem',
        fontSize: '0.85rem',
        color: 'var(--text-sub)',
        lineHeight: 1.5,
    },
    amountErrorHint: {
        color: '#dc2626',
    },
    pickerRow: {
        display: 'flex',
        gap: '0.75rem',
        marginBottom: '1.5rem',
    },
    pickerCard: {
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        backgroundColor: 'white',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '0.875rem 1rem',
        cursor: 'pointer',
    },
    pickerIcon: {
        padding: '0.5rem',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    pickerLabel: {
        fontSize: '0.75rem',
        color: 'var(--text-sub)',
        marginBottom: '0.125rem',
    },
    pickerValue: {
        fontSize: '0.9rem',
        fontWeight: '600',
        color: 'var(--text-main)',
    },
    fieldBlock: {
        marginBottom: '1.25rem',
    },
    fieldLabel: {
        display: 'block',
        fontSize: '0.875rem',
        fontWeight: '600',
        color: 'var(--text-main)',
        marginBottom: '0.5rem',
    },
    fieldInput: {
        width: '100%',
        padding: '0.5rem 0',
        fontSize: '1rem',
        fontWeight: '500',
        color: 'var(--text-main)',
        backgroundColor: 'transparent',
        border: 'none',
        borderBottom: '1px solid #e2e8f0',
        outline: 'none',
        boxSizing: 'border-box',
    },
    locationRow: {
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: '12px',
    },
    locationInputWrapper: {
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        borderBottom: '1px solid #e2e8f0',
        paddingBottom: '0.5rem',
    },
    locationInput: {
        flex: 1,
        fontSize: '1rem',
        fontWeight: '500',
        color: 'var(--text-main)',
        backgroundColor: 'transparent',
        border: 'none',
        outline: 'none',
        padding: 0,
    },
    locationClearButton: {
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '2px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-sub)',
    },
    minimapShell: {
        width: '48px',
        height: '48px',
        borderRadius: '8px',
        overflow: 'hidden',
        flexShrink: 0,
        cursor: 'pointer',
        position: 'relative',
        border: '1px solid #e2e8f0',
        backgroundColor: '#f1f5f9',
    },
    minimapImage: {
        width: '100%',
        height: '100%',
        objectFit: 'cover',
    },
    minimapFallback: {
        width: '100%',
        height: '100%',
        backgroundColor: '#e0f2f1',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'absolute',
        top: 0,
        left: 0,
    },
    locationHint: {
        fontSize: '0.75rem',
        color: 'var(--text-sub)',
        marginTop: '0.5rem',
    },
    toggleRow: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0.5rem 0',
        marginBottom: '1rem',
    },
    toggleLabel: {
        fontSize: '1rem',
        fontWeight: '600',
        color: 'var(--text-main)',
    },
    toggleTrack: {
        width: '50px',
        height: '28px',
        borderRadius: '14px',
        position: 'relative',
        cursor: 'pointer',
        transition: 'background-color 0.2s ease',
    },
    toggleThumb: {
        width: '24px',
        height: '24px',
        backgroundColor: 'white',
        borderRadius: '50%',
        position: 'absolute',
        top: '2px',
        transition: 'left 0.2s ease',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
    },
    saveButton: {
        width: '100%',
        padding: '1rem',
        backgroundColor: 'var(--primary)',
        color: 'white',
        border: 'none',
        borderRadius: '12px',
        fontSize: '1.1rem',
        fontWeight: 'bold',
        cursor: 'pointer',
        boxShadow: '0 4px 6px rgba(47, 133, 90, 0.2)',
    },
    amountErrorOverlay: {
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 'calc(16px + var(--safe-area-bottom))',
        display: 'flex',
        justifyContent: 'center',
        padding: '0 1rem',
        zIndex: 2100,
        pointerEvents: 'none',
    },
    amountErrorToast: {
        width: '100%',
        maxWidth: '398px',
        backgroundColor: '#dc2626',
        color: '#ffffff',
        borderRadius: '14px',
        padding: '0.95rem 1rem',
        fontSize: '0.95rem',
        fontWeight: '700',
        textAlign: 'center',
        boxShadow: '0 14px 30px rgba(220, 38, 38, 0.28)',
        animation: 'sheet-slide-up 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
    },
};

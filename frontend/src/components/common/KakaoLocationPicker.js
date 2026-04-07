"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Search, MapPin, Check } from 'lucide-react';

import { withLoadedKakaoMaps } from '../../lib/kakaoMaps';

/**
 * KakaoLocationPicker - 카카오맵을 사용한 위치 선택 컴포넌트
 * 
 * @param {boolean} isOpen - 모달 표시 여부
 * @param {function} onClose - 모달 닫기 콜백
 * @param {function} onConfirm - 위치 확정 콜백 ({ address, placeName, lat, lng })
 * @param {string} initialAddress - 초기 검색어/주소
 * @param {string} initialPlaceName - 초기 장소명
 */
export default function KakaoLocationPicker({
    isOpen,
    onClose,
    onConfirm,
    initialAddress = '',
    initialPlaceName = ''
}) {
    const mapContainerRef = useRef(null);
    const mapRef = useRef(null);
    const markerRef = useRef(null);
    const geocoderRef = useRef(null);
    const placesRef = useRef(null);
    const initAttemptRef = useRef(0);

    const [searchQuery, setSearchQuery] = useState(initialPlaceName || initialAddress || '');
    const [searchResults, setSearchResults] = useState([]);
    const [selectedLocation, setSelectedLocation] = useState({
        address: initialAddress || '',
        placeName: initialPlaceName || '',
        lat: null,
        lng: null
    });
    const [isMapLoaded, setIsMapLoaded] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [mapLoadError, setMapLoadError] = useState('');

    // 좌표로 주소만 업데이트 (placeName은 유지, 검색으로만 변경 가능)
    const updateAddressFromCoords = useCallback((lat, lng) => {
        if (!geocoderRef.current) return;

        const coords = new window.kakao.maps.LatLng(lat, lng);

        // 좌표로 주소 검색
        geocoderRef.current.coord2Address(coords.getLng(), coords.getLat(), (result, status) => {
            if (status === window.kakao.maps.services.Status.OK) {
                const address = result[0].road_address
                    ? result[0].road_address.address_name
                    : result[0].address.address_name;

                // 주소와 좌표만 업데이트, placeName은 기존 값 유지
                setSelectedLocation(prev => ({
                    ...prev,
                    address: address,
                    lat: lat,
                    lng: lng
                }));
            }
        });
    }, []);

    // 검색 결과 선택
    // IMPORTANT: searchPlaces에서 참조하므로 searchPlaces보다 먼저 정의되어야 함
    const handleSelectResult = useCallback((place, updateQuery = true) => {
        const lat = parseFloat(place.y);
        const lng = parseFloat(place.x);

        if (mapRef.current && markerRef.current) {
            const coords = new window.kakao.maps.LatLng(lat, lng);
            mapRef.current.setCenter(coords);
            markerRef.current.setPosition(coords);
        }

        setSelectedLocation({
            address: place.road_address_name || place.address_name,
            placeName: place.place_name,
            lat: lat,
            lng: lng
        });

        setSearchResults([]);
        // 초기 자동 선택 시에는 검색어(사용자가 입력한 "구로 스타벅스" 등)를 덮어쓰지 않음
        if (updateQuery) {
            setSearchQuery(place.place_name);
        }
    }, []);

    // 장소 검색
    const searchPlaces = useCallback((query, isInitial = false) => {
        if (!placesRef.current || !query.trim()) {
            setSearchResults([]);
            return;
        }

        setIsSearching(true);

        placesRef.current.keywordSearch(query, (data, status) => {
            setIsSearching(false);

            if (status === window.kakao.maps.services.Status.OK) {
                setSearchResults(data); // 모든 결과 표시

                // 초기 검색이고 결과가 있다면 첫 번째 장소 자동 선택
                if (isInitial && data.length > 0) {
                    const firstPlace = data[0];
                    // 초기 자동 선택 시 검색어 입력창은 건드리지 않음 (updateQuery = false)
                    handleSelectResult(firstPlace, false);
                }
            } else {
                setSearchResults([]);
            }
        });
    }, [handleSelectResult]);

    // 카카오맵 초기화 (SDK 로드 대기 포함)
    const initializeMap = useCallback(async () => {
        const initAttempt = ++initAttemptRef.current;
        setMapLoadError('');
        setIsMapLoaded(false);

        try {
            await withLoadedKakaoMaps((maps) => {
                if (initAttemptRef.current !== initAttempt || !mapContainerRef.current) {
                    return;
                }

                const defaultLat = 37.5665;
                const defaultLng = 126.9780;
                const options = {
                    center: new maps.LatLng(defaultLat, defaultLng),
                    level: 3
                };

                const map = new maps.Map(mapContainerRef.current, options);
                mapRef.current = map;

                const marker = new maps.Marker({
                    position: map.getCenter(),
                    draggable: true
                });
                marker.setMap(map);
                markerRef.current = marker;

                geocoderRef.current = new maps.services.Geocoder();
                placesRef.current = new maps.services.Places();

                maps.event.addListener(marker, 'dragend', () => {
                    const position = marker.getPosition();
                    updateAddressFromCoords(position.getLat(), position.getLng());
                });

                maps.event.addListener(map, 'click', (mouseEvent) => {
                    const latlng = mouseEvent.latLng;
                    marker.setPosition(latlng);
                    updateAddressFromCoords(latlng.getLat(), latlng.getLng());
                });
            });

            if (initAttemptRef.current !== initAttempt) {
                return;
            }

            setIsMapLoaded(true);

            if (initialPlaceName || initialAddress) {
                searchPlaces(initialPlaceName || initialAddress, true);
            }
        } catch (error) {
            if (initAttemptRef.current !== initAttempt) {
                return;
            }

            console.error('Kakao Maps SDK failed to initialize:', error);
            setMapLoadError('지도를 불러오지 못했어요. 잠시 후 다시 시도해주세요.');
        }
    }, [initialAddress, initialPlaceName, searchPlaces, updateAddressFromCoords]);

    // 확인 버튼 클릭
    const handleConfirm = () => {
        onConfirm(selectedLocation);
        onClose();
    };

    // 검색어 변경 핸들러 (디바운스)
    useEffect(() => {
        if (!isMapLoaded) return;

        const timer = setTimeout(() => {
            if (searchQuery.trim()) {
                searchPlaces(searchQuery);
            } else {
                setSearchResults([]);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [searchQuery, isMapLoaded, searchPlaces]);

    // 모달이 열릴 때 지도 초기화
    useEffect(() => {
        if (isOpen) {
            // 약간의 지연 후 지도 초기화 (DOM 렌더링 완료 후)
            const timer = setTimeout(() => {
                initializeMap();
            }, 100);

            return () => clearTimeout(timer);
        } else {
            // 모달이 닫힐 때 상태 초기화
            initAttemptRef.current += 1;
            mapRef.current = null;
            markerRef.current = null;
            geocoderRef.current = null;
            placesRef.current = null;
            setIsMapLoaded(false);
            setSearchResults([]);
            setMapLoadError('');
        }
    }, [isOpen, initializeMap]);

    // initialAddress/initialPlaceName이 변경될 때 상태 업데이트
    useEffect(() => {
        setSearchQuery(initialPlaceName || initialAddress || '');
        setSelectedLocation({
            address: initialAddress || '',
            placeName: initialPlaceName || '',
            lat: null,
            lng: null
        });
    }, [initialAddress, initialPlaceName]);

    if (!isOpen) return null;

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'center',
                zIndex: 2001,
            }}
            onClick={onClose}
        >
            <div
                style={{
                    backgroundColor: 'white',
                    borderTopLeftRadius: '24px',
                    borderTopRightRadius: '24px',
                    padding: '20px',
                    width: '100%',
                    maxWidth: '430px',
                    maxHeight: '85vh',
                    display: 'flex',
                    flexDirection: 'column',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* 헤더 */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '16px'
                }}>
                    <span style={{ fontSize: '1.125rem', fontWeight: '600' }}>위치 선택</span>
                    <button
                        onClick={onClose}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* 검색 입력 */}
                <div style={{
                    backgroundColor: '#f8f9fa',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '12px'
                }}>
                    <Search size={18} color="#718096" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="장소 검색..."
                        style={{
                            width: '100%',
                            border: 'none',
                            outline: 'none',
                            fontSize: '1rem',
                            color: 'var(--text-main)',
                            background: 'transparent'
                        }}
                    />
                    {isSearching && (
                        <div style={{
                            width: '18px',
                            height: '18px',
                            border: '2px solid #e2e8f0',
                            borderTopColor: 'var(--primary)',
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite'
                        }} />
                    )}
                </div>

                {/* 검색 결과 목록 */}
                {searchResults.length > 0 && (
                    <div style={{
                        backgroundColor: 'white',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        marginBottom: '12px',
                        maxHeight: '150px',
                        overflowY: 'auto'
                    }}>
                        {searchResults.map((place, index) => (
                            <div
                                key={place.id || index}
                                onClick={() => handleSelectResult(place)}
                                style={{
                                    padding: '12px 16px',
                                    borderBottom: index < searchResults.length - 1 ? '1px solid #e2e8f0' : 'none',
                                    cursor: 'pointer',
                                    transition: 'background-color 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                            >
                                <div style={{ fontWeight: '500', color: 'var(--text-main)', marginBottom: '4px' }}>
                                    {place.place_name}
                                </div>
                                <div style={{ fontSize: '0.875rem', color: '#718096' }}>
                                    {place.road_address_name || place.address_name}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* 지도 영역 */}
                <div
                    ref={mapContainerRef}
                    style={{
                        width: '100%',
                        height: '250px',
                        borderRadius: '16px',
                        overflow: 'hidden',
                        backgroundColor: '#e2e8f0',
                        marginBottom: '12px'
                    }}
                >
                    {!isMapLoaded && (
                        <div style={{
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#718096'
                        }}>
                            {mapLoadError || '지도 로딩 중...'}
                        </div>
                    )}
                </div>

                {/* 선택된 위치 정보 */}
                {selectedLocation.address && (
                    <div style={{
                        backgroundColor: '#e6fffa',
                        borderRadius: '12px',
                        padding: '12px 16px',
                        marginBottom: '16px',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '10px'
                    }}>
                        <MapPin size={20} color="var(--primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
                        <div>
                            {selectedLocation.placeName && (
                                <div style={{ fontWeight: '600', color: 'var(--text-main)', marginBottom: '4px' }}>
                                    {selectedLocation.placeName}
                                </div>
                            )}
                            <div style={{ fontSize: '0.875rem', color: '#718096' }}>
                                {selectedLocation.address}
                            </div>
                        </div>
                    </div>
                )}

                {/* 버튼 영역 */}
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                        onClick={onClose}
                        style={{
                            flex: 1,
                            padding: '14px',
                            backgroundColor: '#f1f5f9',
                            color: 'var(--text-main)',
                            border: 'none',
                            borderRadius: '12px',
                            fontSize: '1rem',
                            fontWeight: '600',
                            cursor: 'pointer'
                        }}
                    >
                        취소
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={!selectedLocation.address}
                        style={{
                            flex: 1,
                            padding: '14px',
                            backgroundColor: selectedLocation.address ? 'var(--primary)' : '#cbd5e0',
                            color: 'white',
                            border: 'none',
                            borderRadius: '12px',
                            fontSize: '1rem',
                            fontWeight: '600',
                            cursor: selectedLocation.address ? 'pointer' : 'not-allowed',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px'
                        }}
                    >
                        <Check size={18} />
                        확인
                    </button>
                </div>
            </div>

            {/* 스피너 애니메이션 스타일 */}
            <style jsx global>{`
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}

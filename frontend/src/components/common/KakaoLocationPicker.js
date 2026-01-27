"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Search, MapPin, Check } from 'lucide-react';

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

    // 카카오맵 초기화 (SDK 로드 대기 포함)
    const initializeMap = useCallback(() => {
        // SDK 로드 대기 함수
        const waitForKakaoSDK = (callback, maxRetries = 50, retryCount = 0) => {
            if (window.kakao && window.kakao.maps) {
                callback();
            } else if (retryCount < maxRetries) {
                // 100ms 간격으로 재시도 (최대 5초)
                setTimeout(() => waitForKakaoSDK(callback, maxRetries, retryCount + 1), 100);
            } else {
                console.error('Kakao Maps SDK failed to load after 5 seconds');
            }
        };

        waitForKakaoSDK(() => {
            // SDK가 로드되었으면 load 함수로 초기화
            window.kakao.maps.load(() => {
                if (!mapContainerRef.current) return;

                // 기본 좌표 (서울 시청)
                const defaultLat = 37.5665;
                const defaultLng = 126.9780;

                const options = {
                    center: new window.kakao.maps.LatLng(defaultLat, defaultLng),
                    level: 3
                };

                const map = new window.kakao.maps.Map(mapContainerRef.current, options);
                mapRef.current = map;

                // 마커 생성
                const marker = new window.kakao.maps.Marker({
                    position: map.getCenter(),
                    draggable: true
                });
                marker.setMap(map);
                markerRef.current = marker;

                // Geocoder 초기화
                geocoderRef.current = new window.kakao.maps.services.Geocoder();

                // Places 초기화
                placesRef.current = new window.kakao.maps.services.Places();

                // 마커 드래그 이벤트
                window.kakao.maps.event.addListener(marker, 'dragend', () => {
                    const position = marker.getPosition();
                    updateAddressFromCoords(position.getLat(), position.getLng());
                });

                // 지도 클릭 이벤트
                window.kakao.maps.event.addListener(map, 'click', (mouseEvent) => {
                    const latlng = mouseEvent.latLng;
                    marker.setPosition(latlng);
                    updateAddressFromCoords(latlng.getLat(), latlng.getLng());
                });

                setIsMapLoaded(true);

                // 초기 주소가 있으면 검색
                if (initialPlaceName || initialAddress) {
                    searchPlaces(initialPlaceName || initialAddress);
                }
            });
        });
    }, [initialAddress, initialPlaceName]);

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

    // 장소 검색
    const searchPlaces = useCallback((query) => {
        if (!placesRef.current || !query.trim()) {
            setSearchResults([]);
            return;
        }

        setIsSearching(true);

        placesRef.current.keywordSearch(query, (data, status) => {
            setIsSearching(false);

            if (status === window.kakao.maps.services.Status.OK) {
                setSearchResults(data.slice(0, 5)); // 최대 5개 결과
            } else {
                setSearchResults([]);
            }
        });
    }, []);

    // 검색 결과 선택
    const handleSelectResult = useCallback((place) => {
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
        setSearchQuery(place.place_name);
    }, []);

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
            setIsMapLoaded(false);
            setSearchResults([]);
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
                            지도 로딩 중...
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

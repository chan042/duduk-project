"use client";

import { useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';

import { withLoadedKakaoMaps } from '../../lib/kakaoMaps';

export default function KakaoStaticMapPreview({
    lat,
    lng,
    level = 3,
    marker = true,
}) {
    const containerRef = useRef(null);
    const [isRendered, setIsRendered] = useState(false);
    const [hasError, setHasError] = useState(false);
    const hasCoordinates = Number.isFinite(lat) && Number.isFinite(lng);

    useEffect(() => {
        if (!hasCoordinates || !containerRef.current) {
            setIsRendered(false);
            setHasError(false);
            return undefined;
        }

        let cancelled = false;
        setIsRendered(false);
        setHasError(false);

        withLoadedKakaoMaps((maps) => {
            if (cancelled || !containerRef.current) {
                return;
            }

            const position = new maps.LatLng(lat, lng);
            containerRef.current.innerHTML = '';

            new maps.StaticMap(containerRef.current, {
                center: position,
                level,
                marker: marker
                    ? { position }
                    : undefined,
            });

            setIsRendered(true);
        }).catch((error) => {
            if (cancelled) {
                return;
            }

            console.error('Kakao static map preview failed to render:', error);
            setHasError(true);
        });

        return () => {
            cancelled = true;

            if (containerRef.current) {
                containerRef.current.innerHTML = '';
            }
        };
    }, [hasCoordinates, lat, lng, level, marker]);

    return (
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            <div
                ref={containerRef}
                style={{
                    width: '100%',
                    height: '100%',
                    display: isRendered && !hasError ? 'block' : 'none',
                }}
            />
            <div
                style={{
                    width: '100%',
                    height: '100%',
                    display: isRendered && !hasError ? 'none' : 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'absolute',
                    inset: 0,
                    backgroundColor: '#e0f2f1',
                }}
            >
                <MapPin size={24} color="var(--primary)" />
            </div>
        </div>
    );
}

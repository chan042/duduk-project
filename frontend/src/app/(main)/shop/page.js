"use client";

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { X, DoorClosed } from 'lucide-react';
import { getShopItems, getShopUserPoints, purchaseItem, playGacha } from '@/lib/api/shop';

export default function ShopPage() {
    // Shopkeeper messages
    const shopkeeperMessages = [
        '한번 천천히 둘러보시게.',
        '가차를 통해 희귀한 상품을 얻을 수 있다네.',
        '좋은 소비가 되길 바라네.',
        '나를 어디서 본 것 같다고? 후후..',
        '또 왔구려. 곧 단골이 되겠어.'
    ];

    const router = useRouter();
    const [activeTab, setActiveTab] = useState('clothing');
    const [userPoints, setUserPoints] = useState(0);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [showGachaModal, setShowGachaModal] = useState(false);
    const [gachaStatus, setGachaStatus] = useState('idle'); // 'idle' | 'rolling' | 'burst' | 'result'
    const [gachaResult, setGachaResult] = useState(null); // 스텝별 가챠 결과 (null -> loading -> result)
    const [speechBubble, setSpeechBubble] = useState(shopkeeperMessages[0]);
    const [isVisible, setIsVisible] = useState(true); // Control opacity for fade effect
    const [speechIndex, setSpeechIndex] = useState(0);

    // 데이터 불러오기
    const fetchData = async () => {
        setLoading(true);
        try {
            // 포인트와 현재 탭의 상품 목록 동시 조회
            const [pointsData, itemsData] = await Promise.all([
                getShopUserPoints(),
                getShopItems(activeTab)
            ]);
            setUserPoints(pointsData.points);
            setProducts(itemsData);
        } catch (err) {
            console.error('데이터 로딩 실패:', err);
        } finally {
            setLoading(false);
        }
    };

    // 탭 변경 시 상품 다시 조회
    useEffect(() => {
        fetchData();
    }, [activeTab]);

    // Handle speech bubble fade out
    useEffect(() => {
        if (speechBubble) {
            setIsVisible(true);
            const timer = setTimeout(() => {
                setIsVisible(false);
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [speechBubble]);



    const handleGachaClick = () => {
        setGachaResult(null); // 초기화
        setGachaStatus('idle'); // 가챠 모달 열 때 상태 초기화
        setShowGachaModal(true);
    };

    const handleGachaDraw = async () => {
        if (gachaStatus !== 'idle') return; // Prevent double click

        if (userPoints < 500) {
            alert('포인트가 부족합니다! (500P 필요)');
            return;
        }

        try {
            setGachaStatus('rolling'); // Start animation

            // 1. Call API
            const data = await playGacha();

            // 2. Wait for animation (at least 2s)
            setTimeout(() => {
                if (data.success) {
                    setGachaResult(data);
                    setUserPoints(data.remaining_points);
                    fetchData(); // Update inventory

                    // Skip 'burst' state, go directly to result
                    setGachaStatus('result');
                }
            }, 2000);

        } catch (err) {
            console.error('가챠 실패:', err);
            alert(err.response?.data?.message || '가챠 도중 오류가 발생했습니다.');
            setGachaStatus('idle'); // Reset on error
        }
    };

    const handleProductClick = (product) => {
        // 레어템도 구매 가능 (이전에는 가챠만 가능했음)
        setSelectedProduct(product);
    };

    const handleClosePopup = () => {
        setSelectedProduct(null);
    };

    const handlePurchase = async () => {
        if (!selectedProduct) return;

        try {
            const data = await purchaseItem(selectedProduct.id);
            if (data.success) {
                alert(`${selectedProduct.name}을(를) 구매했습니다!`);
                setUserPoints(data.remaining_points);
                setSelectedProduct(null);
                // 상품 목록 새로고침 (보유 상태 업데이트 확인용)
                fetchData();
            }
        } catch (err) {
            console.error('구매 실패:', err);
            alert(err.response?.data?.message || '구매 도중 오류가 발생했습니다.');
        }
    };

    const handleCharacterClick = () => {
        setSpeechBubble(shopkeeperMessages[speechIndex]);
        setSpeechIndex((prev) => (prev + 1) % shopkeeperMessages.length);
    };

    return (
        <div style={styles.container}>
            {/* Top Section */}
            <div style={styles.topSection}>
                {/* Navigation Icons */}
                <div style={styles.navIcons}>
                    <button onClick={() => router.push('/room')} style={styles.iconButton}>
                        <DoorClosed color="#333" size={20} />
                    </button>
                </div>

                {/* Points */}
                <div style={styles.pointsBadge}>
                    <span style={styles.pointsText}>{userPoints.toLocaleString()}</span>
                    <div style={styles.coinIcon}>P</div>
                </div>

                {/* Shopkeeper Image */}
                <div style={styles.characterContainer} onClick={handleCharacterClick}>
                    <Image
                        src="/images/characters/char_dog/dog_in_shop.png"
                        alt="Shopkeeper"
                        fill
                        style={{ objectFit: 'cover', objectPosition: 'center bottom' }}
                        priority
                    />
                    {/* Speech Bubble */}
                    {speechBubble && (
                        <div style={{
                            ...styles.speechBubble,
                            opacity: isVisible ? 1 : 0,
                        }}>
                            <div style={styles.nameTag}>상점 주인</div>
                            {speechBubble}
                        </div>
                    )}
                </div>

                {/* Gacha Button with Sparkle Animation */}
                <style jsx>{`
                    @keyframes sparkle {
                        0%, 100% { opacity: 0; transform: scale(0.5); }
                        50% { opacity: 1; transform: scale(1); }
                    }
                    @keyframes sparkleRotate {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                    @keyframes floating {
                        0%, 100% { transform: translateY(0px); }
                        50% { transform: translateY(-6px); }
                    }
                `}</style>
                <button onClick={handleGachaClick} style={styles.gachaButton}>
                    {/* Sparkle effects */}
                    <div style={{
                        position: 'absolute',
                        top: '-5px',
                        left: '-5px',
                        fontSize: '14px',
                        animation: 'sparkle 1.5s ease-in-out infinite',
                        animationDelay: '0s'
                    }}>✨</div>
                    <div style={{
                        position: 'absolute',
                        top: '10px',
                        right: '-8px',
                        fontSize: '12px',
                        animation: 'sparkle 1.5s ease-in-out infinite',
                        animationDelay: '0.5s'
                    }}>✨</div>
                    <div style={{
                        position: 'absolute',
                        bottom: '5px',
                        left: '0px',
                        fontSize: '10px',
                        animation: 'sparkle 1.5s ease-in-out infinite',
                        animationDelay: '1s'
                    }}>✨</div>
                    <div style={{
                        position: 'absolute',
                        bottom: '-3px',
                        right: '15px',
                        fontSize: '11px',
                        animation: 'sparkle 1.5s ease-in-out infinite',
                        animationDelay: '0.75s'
                    }}>✨</div>
                    <Image
                        src="/images/shop.png"
                        alt="Gacha"
                        width={130}
                        height={130}
                        style={styles.gachaImage}
                    />
                </button>
            </div>

            {/* Bottom Content (White Background) */}
            <div style={styles.bottomSection}>
                {/* Tabs */}
                <div style={styles.tabsContainer}>
                    {['clothing', 'item', 'background'].map((tab) => (
                        <button
                            key={tab}
                            style={{
                                ...styles.tab,
                                ...(activeTab === tab ? styles.activeTab : styles.inactiveTab)
                            }}
                            onClick={() => setActiveTab(tab)}
                        >
                            {tab === 'clothing' && '의류'}
                            {tab === 'item' && '아이템'}
                            {tab === 'background' && '배경'}
                        </button>
                    ))}
                </div>

                {/* Products Grid */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px' }}>
                    <div style={styles.productsGrid}>
                        {loading ? (
                            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '20px', color: '#888' }}>
                                로딩 중...
                            </div>
                        ) : (
                            <>
                                {products.map((product) => (
                                    <div
                                        key={product.id}
                                        style={{
                                            ...styles.productCard,
                                            border: product.is_rare ? '2px solid #ffd700' : '1px solid #eee',
                                            backgroundColor: product.is_owned ? '#f0f0f0' : 'white',
                                            opacity: product.is_owned ? 0.8 : 1
                                        }}
                                        onClick={() => handleProductClick(product)}
                                    >
                                        <div style={styles.productImagePlaceholder}>
                                            {/* 실제 이미지가 없으면 텍스트나 이모지로 대체 */}
                                            {product.image_url ? (
                                                <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img
                                                        src={product.image_url}
                                                        alt={product.name}
                                                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                                        onError={(e) => {
                                                            e.target.onerror = null;
                                                            e.target.style.display = 'none';
                                                            e.target.nextSibling.style.display = 'block';
                                                        }}
                                                    />
                                                    <span style={{ fontSize: '2rem', display: 'none', position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
                                                        {product.category === 'CLOTHING' ? '👕' :
                                                            product.category === 'ITEM' ? '🎒' : '🖼️'}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span style={{ fontSize: '2rem' }}>🎁</span>
                                            )}
                                        </div>
                                        <div style={styles.productInfo}>
                                            <div style={styles.productName}>
                                                {product.is_rare && <span style={{ color: '#ffd700', marginRight: '4px' }}>★</span>}
                                                {product.name}
                                            </div>
                                            <div style={styles.productPrice}>
                                                {product.is_owned ? '보유중' : `${product.price.toLocaleString()}p`}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {products.length === 0 && (
                                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '20px', color: '#888' }}>
                                        상품이 없습니다.
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Product Detail Popup */}
            {selectedProduct && (
                <div style={styles.popupOverlay} onClick={handleClosePopup}>
                    <div style={styles.popupContent} onClick={(e) => e.stopPropagation()}>
                        <button style={styles.popupCloseButton} onClick={handleClosePopup}>
                            <X size={20} color="#666" />
                        </button>

                        <div style={styles.popupImageContainer}>
                            {selectedProduct.image_url ? (
                                <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={selectedProduct.image_url}
                                        alt={selectedProduct.name}
                                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                        onError={(e) => {
                                            e.target.onerror = null;
                                            e.target.style.display = 'none';
                                            e.target.nextSibling.style.display = 'block';
                                        }}
                                    />
                                    <span style={{ fontSize: '3.5rem', display: 'none', position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
                                        {selectedProduct.category === 'CLOTHING' ? '👕' :
                                            selectedProduct.category === 'ITEM' ? '🎒' : '🖼️'}
                                    </span>
                                </div>
                            ) : (
                                <span style={{ fontSize: '3.5rem' }}>🎁</span>
                            )}
                        </div>

                        <div style={styles.popupProductName}>{selectedProduct.name}</div>

                        {selectedProduct.description && (
                            <div style={styles.popupProductDescription}>
                                {selectedProduct.description}
                            </div>
                        )}

                        <div style={styles.popupProductPrice}>
                            {selectedProduct.is_owned ? '이미 보유 중입니다' : `${selectedProduct.price.toLocaleString()}P`}
                        </div>

                        {!selectedProduct.is_owned && (
                            <button style={styles.purchaseButton} onClick={handlePurchase}>
                                구매하기
                            </button>
                        )}

                        {!selectedProduct.is_owned && (
                            <div style={styles.refundWarning}>*구매 후 환불 불가</div>
                        )}
                    </div>
                </div>
            )}

            {/* Gacha Popup */}
            {showGachaModal && (
                <div style={styles.popupOverlay} onClick={() => {
                    if (gachaStatus === 'result' || gachaStatus === 'idle') {
                        setGachaResult(null);
                        setGachaStatus('idle');
                        setShowGachaModal(false);
                    }
                }}>
                    <style jsx global>{`
                        @keyframes shake {
                            0% { transform: translate(0, 0) rotate(0deg); }
                            25% { transform: translate(-5px, 2px) rotate(-5deg); }
                            50% { transform: translate(5px, -2px) rotate(5deg); }
                            75% { transform: translate(-5px, 2px) rotate(-5deg); }
                            100% { transform: translate(0, 0) rotate(0deg); }
                        }
                        @keyframes lightSpread {
                            0% { transform: translate(-50%, -50%) scale(0); opacity: 0.8; }
                            100% { transform: translate(-50%, -50%) scale(3.5); opacity: 0; }
                        }
                        @keyframes popIn {
                            0% { transform: scale(0) translateY(50px); opacity: 0; }
                            60% { transform: scale(1.1) translateY(-10px); opacity: 1; }
                            100% { transform: scale(1) translateY(0); }
                    `}</style>
                    <div style={styles.popupContent} onClick={(e) => e.stopPropagation()}>
                        <button style={styles.popupCloseButton} onClick={() => {
                            if (gachaStatus === 'rolling') return;
                            setGachaResult(null);
                            setGachaStatus('idle');
                            setShowGachaModal(false);
                        }}>
                            <X size={20} color="#666" />
                        </button>

                        {/* Gacha Machine & Animation Area */}
                        {(gachaStatus === 'idle' || gachaStatus === 'rolling') ? (
                            <>
                                <div style={{
                                    ...styles.gachaPopupImageContainer,
                                    animation: gachaStatus === 'rolling' ? 'shake 0.5s infinite' : 'none',
                                }}>
                                    <Image
                                        src="/images/shop.png"
                                        alt="Gacha Machine"
                                        width={306}
                                        height={306}
                                        style={{ objectFit: 'contain' }}
                                    />
                                </div>

                                <div style={styles.gachaDescriptionContainer}>
                                    <div style={styles.gachaDescription}>
                                        {gachaStatus === 'rolling' ? '두근두근...' :
                                            <>500p를 내면 가챠를 뽑을 수 있어요.<br />가챠를 통해 희귀 아이템을 얻어보아요!</>}
                                    </div>
                                </div>
                                <button
                                    style={{
                                        ...styles.gachaDrawButton,
                                        opacity: (gachaStatus === 'rolling') ? 0.5 : 1,
                                        cursor: (gachaStatus === 'rolling') ? 'not-allowed' : 'pointer'
                                    }}
                                    onClick={handleGachaDraw}
                                    disabled={gachaStatus === 'rolling'}
                                >
                                    {gachaStatus === 'rolling' ? '뽑는 중...' : '가챠 뽑기 (500P)'}
                                </button>
                            </>
                        ) : (
                            // Result Screen (gachaStatus === 'result')
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', animation: 'popIn 0.5s forwards', width: '100%' }}>
                                <div style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '20px', color: 'var(--primary)' }}>
                                    축하합니다!
                                </div>

                                <div style={{
                                    position: 'relative',
                                    width: '150px',
                                    height: '150px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginBottom: '20px',
                                    fontSize: '4rem',
                                    // Removed yellow box styles (background, border, shadow)
                                }}>
                                    {/* Rare Effect: Light Spread */}
                                    {gachaResult.is_rare && (
                                        <div style={{
                                            position: 'absolute',
                                            top: '50%',
                                            left: '50%',
                                            width: '300px', // Increased from 200px
                                            height: '300px', // Increased from 200px
                                            borderRadius: '50%',
                                            background: 'radial-gradient(circle, rgba(255, 215, 0, 0.8) 0%, rgba(255, 215, 0, 0) 70%)',
                                            animation: 'lightSpread 1s ease-out forwards',
                                            zIndex: 0,
                                            pointerEvents: 'none'
                                        }} />
                                    )}

                                    {gachaResult.acquired_item.image_url ? (
                                        <div style={{ position: 'relative', width: '100%', height: '100%', zIndex: 1 }}>
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={gachaResult.acquired_item.image_url}
                                                alt={gachaResult.acquired_item.name}
                                                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                                onError={(e) => {
                                                    e.target.onerror = null;
                                                    e.target.style.display = 'none';
                                                    e.target.nextSibling.style.display = 'block';
                                                }}
                                            />
                                            <span style={{ fontSize: '4rem', display: 'none', position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>🎁</span>
                                        </div>
                                    ) : (
                                        <span style={{ fontSize: '4rem', zIndex: 1 }}>🎁</span>
                                    )}
                                </div>
                                <div style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '8px', zIndex: 1, textAlign: 'center' }}>
                                    {gachaResult.is_rare && <span style={{ color: '#ffd700', textShadow: '0 0 5px rgba(255,215,0,0.5)' }}>★ LEGENDARY ★<br /></span>}
                                    {gachaResult.acquired_item.name}
                                </div>
                                <div style={{ color: '#888', marginBottom: '20px', zIndex: 1 }}>
                                    을(를) 획득했습니다!
                                </div>
                                <button style={{ ...styles.gachaDrawButton, zIndex: 1 }} onClick={() => {
                                    setGachaResult(null);
                                    setGachaStatus('idle');
                                }}>
                                    한 번 더 뽑기
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

const styles = {
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#fff',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        zIndex: 100,
    },
    topSection: {
        flex: '0 0 45vh', // Fixed flex basis
        position: 'relative',
        width: '100%',
        backgroundColor: '#e6e0d4',
    },
    navIcons: {
        position: 'absolute',
        top: '16px',
        left: '16px',
        zIndex: 50,
        display: 'flex',
        gap: '8px',
    },
    iconButton: {
        background: 'transparent',
        border: 'none',
        padding: '8px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        filter: 'drop-shadow(0 0 2px white) drop-shadow(0 0 2px white)',
    },
    pointsBadge: {
        position: 'absolute',
        top: '16px',
        right: '16px',
        backgroundColor: 'white',
        padding: '6px 12px',
        borderRadius: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        zIndex: 50,
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        fontWeight: 'bold',
        fontSize: '1rem',
    },
    pointsText: {
        color: 'var(--primary)',
    },
    coinIcon: {
        backgroundColor: 'var(--primary)',
        color: 'white',
        borderRadius: '50%',
        width: '18px',
        height: '18px',
        fontSize: '11px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    characterContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 10,
        cursor: 'pointer',
    },
    speechBubble: {
        position: 'absolute',
        bottom: '60px',
        right: '200px',
        backgroundColor: '#fdf6e3', // Cream/beige like the image
        padding: '20px 28px 16px 28px',
        borderRadius: '30px', // Fully rounded like the image
        border: 'none',
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        fontSize: '0.9rem',
        fontWeight: '500',
        color: '#5c4a3a',
        maxWidth: '220px',
        textAlign: 'center',
        zIndex: 20,
        animation: 'floating 3s ease-in-out infinite',
        overflow: 'visible',
    },
    nameTag: {
        position: 'absolute',
        top: '-22px',
        left: '16px',
        backgroundColor: '#7a3e48', // Dark burgundy like the image
        color: 'white',
        padding: '5px 14px',
        borderRadius: '12px', // More rounded
        fontSize: '0.85rem',
        fontWeight: 'bold',
        whiteSpace: 'nowrap',
    },
    gachaButton: {
        position: 'absolute',
        bottom: '35px',
        right: '15px', // Changed back to right
        zIndex: 60, // Above everything in top section
        background: 'none',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
    },
    popupProductDescription: {
        fontSize: '0.9rem',
        color: '#666',
        textAlign: 'center',
        marginBottom: '12px',
        lineHeight: '1.4',
        padding: '0 16px',
    },
    gachaWrapper: {
        position: 'relative',
        display: 'inline-block',
    },
    gachaImage: {
        filter: 'drop-shadow(0 0 3px white) drop-shadow(0 0 3px white)',
        objectFit: 'contain',
    },
    gachaText: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        color: 'white',
        fontWeight: 'bold',
        fontSize: '1.1rem',
        textShadow: '0 1px 2px rgba(0,0,0,0.3)',
        whiteSpace: 'nowrap',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
    },
    sparkle: {
        fontSize: '0.9rem',
    },
    bottomSection: {
        flex: 1,
        backgroundColor: 'white',
        borderTopLeftRadius: '24px',
        borderTopRightRadius: '24px',
        marginTop: '-24px', // Pull up to overlap
        zIndex: 40,
        padding: '0', // Remove internal padding
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 -4px 20px rgba(0,0,0,0.05)',
        overflow: 'hidden', // Prevent body scroll
    },
    tabsContainer: {
        display: 'flex',
        gap: '12px',
        padding: '30px 20px 0 20px', // Top padding moved here
        marginBottom: '24px',
        flexShrink: 0,
    },
    tab: {
        flex: 1,
        padding: '10px 0',
        borderRadius: '999px',
        border: 'none',
        fontSize: '0.95rem',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        textAlign: 'center',
    },
    activeTab: {
        backgroundColor: 'var(--primary)',
        color: 'white',
    },
    inactiveTab: {
        backgroundColor: 'transparent',
        color: '#999',
    },
    productsGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '12px',
        paddingBottom: '100px',
    },
    productCard: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '10px',
        backgroundColor: 'white',
        borderRadius: '16px',
        border: '1px solid #eee',
        boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
        cursor: 'pointer',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    },
    productImagePlaceholder: {
        width: '100%',
        aspectRatio: '1',
        backgroundColor: '#f8f8f8',
        borderRadius: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '10px',
    },
    productInfo: {
        textAlign: 'center',
        width: '100%',
    },
    productName: {
        fontSize: '0.85rem',
        fontWeight: '700',
        color: '#333',
        marginBottom: '4px',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
    },
    productPrice: {
        fontSize: '0.8rem',
        color: 'var(--primary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '4px',
        fontWeight: '700',
    },
    coinSymbol: {
        fontSize: '0.8rem',
        color: '#ffd700',
    },
    // Popup Styles
    popupOverlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
    },
    popupContent: {
        backgroundColor: 'white',
        borderRadius: '20px',
        padding: '24px',
        width: '85%', // Slightly wider
        maxWidth: '360px', // Increased max-width
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        position: 'relative',
    },
    popupCloseButton: {
        position: 'absolute',
        top: '12px',
        right: '12px',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '4px',
    },
    popupImageContainer: {
        width: '120px',
        height: '120px',
        backgroundColor: '#f8f8f8',
        borderRadius: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '16px',
    },
    popupProductName: {
        fontSize: '1.2rem',
        fontWeight: '700',
        color: '#333',
        marginBottom: '8px',
        textAlign: 'center',
    },
    popupProductPrice: {
        fontSize: '1rem',
        color: 'var(--primary)',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        marginBottom: '20px',
        fontWeight: '700',
    },
    purchaseButton: {
        width: '100%',
        padding: '14px',
        backgroundColor: 'var(--primary)',
        color: 'white',
        border: 'none',
        borderRadius: '12px',
        fontSize: '1rem',
        fontWeight: '600',
        cursor: 'pointer',
        marginBottom: '12px',
    },
    refundWarning: {
        color: '#e74c3c',
        fontSize: '0.8rem',
        fontWeight: '500',
    },
    // Gacha Popup Specifics
    gachaPopupImageContainer: {
        marginBottom: '20px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
    },
    gachaDescriptionContainer: {
        backgroundColor: '#f5f5f5',
        borderRadius: '16px',
        padding: '16px',
        width: '100%',
        marginBottom: '24px',
        border: '1px solid #eee',
    },
    gachaDescription: {
        fontSize: '0.95rem',
        color: '#555',
        textAlign: 'center',
        lineHeight: '1.5',
        wordBreak: 'keep-all',
        margin: 0,
    },
    gachaDrawButton: {
        width: '100%',
        padding: '16px',
        backgroundColor: 'var(--primary)',
        color: 'white',
        border: 'none',
        borderRadius: '12px',
        fontSize: '1.1rem',
        fontWeight: 'bold',
        cursor: 'pointer',
        transition: 'all 0.2s',
    },
};

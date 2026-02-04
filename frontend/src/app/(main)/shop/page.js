"use client";

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Home, Shirt, X, ChevronLeft } from 'lucide-react';
import { getUserPoints } from '@/lib/api/challenge';

// Mock data to match the UI visual
const mockProducts = [
    { id: 1, name: '탐정 모자', price: 2500, category: 'clothing', image: '/images/items/hat.png' },
    { id: 2, name: '빈티지 정장', price: 2500, category: 'clothing', image: '/images/items/suit.png' },
    { id: 3, name: '단안경', price: 2500, category: 'item', image: '/images/items/monocle.png' },
    { id: 4, name: '나비 넥타이', price: 2500, category: 'clothing', image: '/images/items/bowtie.png' },
    { id: 5, name: '구식 여행 가방', price: 1500, category: 'item', image: '/images/items/bag.png' },
    { id: 6, name: '도서관 배경', price: 1500, category: 'background', image: '/images/items/library.png' },
    { id: 11, name: '빨간 목도리', price: 1500, category: 'clothing', image: '/images/items/hat.png' },
    { id: 12, name: '파란 조끼', price: 2000, category: 'clothing', image: '/images/items/suit.png' },
    { id: 13, name: '검은 안경', price: 1200, category: 'clothing', image: '/images/items/monocle.png' },
    { id: 14, name: '선장 모자', price: 3000, category: 'clothing', image: '/images/items/hat.png' },
    { id: 15, name: '해적 코트', price: 3500, category: 'clothing', image: '/images/items/suit.png' },
    { id: 16, name: '황금 왕관', price: 9900, category: 'clothing', image: '/images/items/hat.png' },
];

export default function ShopPage() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState('clothing');
    const [userPoints, setUserPoints] = useState(0);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [showGachaModal, setShowGachaModal] = useState(false);
    const [speechBubble, setSpeechBubble] = useState(null);
    const [speechIndex, setSpeechIndex] = useState(0);
    // Using simple category filtering logic
    const [filteredProducts, setFilteredProducts] = useState([]);

    // Shopkeeper messages
    const shopkeeperMessages = [
        '한번 천천히 둘러보시게.',
        '가차를 통해 희귀한 상품을 얻을 수 있다네',
        '좋은 소비가 되길 바라네'
    ];


    // Fetch user points on mount
    useEffect(() => {
        const fetchPoints = async () => {
            try {
                const data = await getUserPoints();
                setUserPoints(data.points);
            } catch (err) {
                console.error('포인트 조회 실패:', err);
            }
        };
        fetchPoints();
    }, []);

    useEffect(() => {
        // Filter products based on activeTab
        // Logic: 
        // clothing -> items with category 'clothing'
        // item -> items with category 'item'
        // background -> items with category 'background'
        const filtered = mockProducts.filter(p => p.category === activeTab);
        setFilteredProducts(filtered);
    }, [activeTab]);

    const handleBack = () => {
        router.push('/challenge');
    };

    const handleGachaClick = () => {
        setShowGachaModal(true);
    };

    const handleGachaDraw = () => {
        // Here we would deduct points and give a random item
        if (userPoints < 500) {
            alert('포인트가 부족합니다!');
            return;
        }
        alert('가챠를 뽑았습니다! (기능 준비중)');
        setShowGachaModal(false);
    };

    const handleProductClick = (product) => {
        setSelectedProduct(product);
    };

    const handleClosePopup = () => {
        setSelectedProduct(null);
    };

    const handlePurchase = () => {
        alert(`${selectedProduct.name}을(를) 구매했습니다!`);
        setSelectedProduct(null);
    };

    const handleCharacterClick = () => {
        setSpeechBubble(shopkeeperMessages[speechIndex]);
        setSpeechIndex((prev) => (prev + 1) % shopkeeperMessages.length);
        // Auto hide after 3 seconds
        setTimeout(() => {
            setSpeechBubble(null);
        }, 3000);
    };

    return (
        <div style={styles.container}>
            {/* Top Section */}
            <div style={styles.topSection}>
                {/* Navigation Icons */}
                <div style={styles.navIcons}>
                    <button onClick={handleBack} style={styles.iconButton}>
                        <ChevronLeft color="#333" size={24} />
                    </button>
                    <button onClick={() => router.push('/closet')} style={styles.iconButton}>
                        <Shirt color="#333" size={24} />
                    </button>
                    <button onClick={() => router.push('/home')} style={styles.iconButton}>
                        <Home color="#333" size={24} />
                    </button>
                </div>

                {/* Points */}
                <div style={styles.pointsBadge}>
                    <span style={styles.pointsText}>{userPoints.toLocaleString()}</span>
                    <div style={styles.coinIcon}>P</div>
                </div>

                {/* Shopkeeper Image */}
                <div style={styles.characterContainer} onClick={handleCharacterClick}>
                    {/* Using dog_in_shop.png as the main character/scene */}
                    <Image
                        src="/images/characters/char_dog/dog_in_shop.png"
                        alt="Shopkeeper"
                        fill
                        style={{ objectFit: 'cover', objectPosition: 'center bottom' }}
                        priority
                    />
                    {/* Speech Bubble */}
                    {speechBubble && (
                        <div style={styles.speechBubble}>
                            {speechBubble}
                        </div>
                    )}
                </div>

                {/* Gacha Button */}
                <button onClick={handleGachaClick} style={styles.gachaButton}>
                    <Image
                        src="/images/shop.png"
                        alt="Gacha"
                        width={100}
                        height={100}
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
                <div style={styles.productsGrid}>
                    {filteredProducts.map((product) => (
                        <div
                            key={product.id}
                            style={styles.productCard}
                            onClick={() => handleProductClick(product)}
                        >
                            <div style={styles.productImagePlaceholder}>
                                {/* Placeholder since we don't have item images yet */}
                                <span style={{ fontSize: '2rem' }}>🎁</span>
                            </div>
                            <div style={styles.productInfo}>
                                <div style={styles.productName}>{product.name}</div>
                                <div style={styles.productPrice}>
                                    <span style={styles.coinSymbol}>🪙</span>
                                    {product.price.toLocaleString()}
                                </div>
                            </div>
                        </div>
                    ))}
                    {filteredProducts.length === 0 && (
                        <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '20px', color: '#888' }}>
                            상품이 없습니다.
                        </div>
                    )}
                </div>
            </div>

            {/* Product Detail Popup */}
            {selectedProduct && (
                <div style={styles.popupOverlay} onClick={handleClosePopup}>
                    <div style={styles.popupContent} onClick={(e) => e.stopPropagation()}>
                        {/* Close Button */}
                        <button style={styles.popupCloseButton} onClick={handleClosePopup}>
                            <X size={20} color="#666" />
                        </button>

                        {/* Product Image */}
                        <div style={styles.popupImageContainer}>
                            <span style={{ fontSize: '4rem' }}>🎁</span>
                        </div>

                        {/* Product Name */}
                        <div style={styles.popupProductName}>{selectedProduct.name}</div>

                        {/* Product Price */}
                        <div style={styles.popupProductPrice}>
                            {selectedProduct.price.toLocaleString()}P
                        </div>

                        {/* Purchase Button */}
                        <button style={styles.purchaseButton} onClick={handlePurchase}>
                            구매하기
                        </button>

                        {/* Refund Warning */}
                        <div style={styles.refundWarning}>*구매 후 환불 불가</div>
                    </div>
                </div>
            )}

            {/* Gacha Popup */}
            {showGachaModal && (
                <div style={styles.popupOverlay} onClick={() => setShowGachaModal(false)}>
                    <div style={styles.popupContent} onClick={(e) => e.stopPropagation()}>
                        {/* Close Button */}
                        <button style={styles.popupCloseButton} onClick={() => setShowGachaModal(false)}>
                            <X size={20} color="#666" />
                        </button>

                        {/* Big Gacha Image */}
                        <div style={styles.gachaPopupImageContainer}>
                            <Image
                                src="/images/shop.png"
                                alt="Gacha Machine"
                                width={306}
                                height={306} // Square or fit based on image aspect
                                style={{ objectFit: 'contain' }}
                            />
                        </div>

                        {/* Description */}
                        <div style={styles.gachaDescriptionContainer}>
                            <div style={styles.gachaDescription}>
                                500p를 내면 가챠를 뽑을 수 있어요.<br />
                                가챠를 통해 희귀 아이템을 얻어보아요!
                            </div>
                        </div>

                        {/* Draw Button */}
                        <button style={styles.gachaDrawButton} onClick={handleGachaDraw}>
                            가챠 뽑기 (500P)
                        </button>
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
        background: 'rgba(255, 255, 255, 0.9)',
        border: 'none',
        padding: '8px',
        borderRadius: '50%',
        cursor: 'pointer',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
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
        right: '140px',
        backgroundColor: 'white',
        padding: '12px 20px',
        borderRadius: '16px',
        borderBottomRightRadius: '4px', // Add tail capability visual or just style preference
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        fontSize: '0.9rem',
        fontWeight: '500',
        color: '#333',
        maxWidth: '200px',
        textAlign: 'center',
        zIndex: 20,
        animation: 'fadeIn 0.3s ease',
    },
    gachaButton: {
        position: 'absolute',
        bottom: '25px', // Sit partially on the line or just above? Image suggests above
        right: '25px',
        zIndex: 60, // Above everything in top section
        background: 'none',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
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
        padding: '30px 20px 0 20px', // Remove bottom padding, assume content handles it
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 -4px 20px rgba(0,0,0,0.05)',
        overflowY: 'auto',
    },
    tabsContainer: {
        display: 'flex',
        gap: '12px',
        marginBottom: '24px',
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
        boxShadow: '0 4px 12px rgba(20, 184, 166, 0.3)',
    },
    inactiveTab: {
        backgroundColor: 'transparent',
        color: '#999',
    },
    productsGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '12px',
        paddingBottom: '20px',
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
        color: '#666',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '4px',
        fontWeight: '500',
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
        color: '#666',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        marginBottom: '20px',
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
        boxShadow: '0 4px 12px rgba(20, 184, 166, 0.4)',
        transition: 'all 0.2s',
    },
};

"use client";

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Home, ShoppingBag, ChevronLeft } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

// Mock data - In a real app, this would come from an API (e.g., user's inventory)
const mockInventory = [
    { id: 1, name: '탐정 모자', price: 2500, category: 'clothing', image: '/images/items/hat.png' },
    { id: 2, name: '빈티지 정장', price: 2500, category: 'clothing', image: '/images/items/suit.png' },
    { id: 4, name: '나비 넥타이', price: 2500, category: 'clothing', image: '/images/items/bowtie.png' },
    // Duplicates for scroll testing
    { id: 11, name: '빨간 목도리', price: 1500, category: 'clothing', image: '/images/items/hat.png' },
    { id: 12, name: '파란 조끼', price: 2000, category: 'clothing', image: '/images/items/suit.png' },
    { id: 13, name: '검은 안경', price: 1200, category: 'clothing', image: '/images/items/monocle.png' },
    { id: 14, name: '선장 모자', price: 3000, category: 'clothing', image: '/images/items/hat.png' },
    { id: 15, name: '해적 코트', price: 3500, category: 'clothing', image: '/images/items/suit.png' },
    { id: 16, name: '황금 왕관', price: 9900, category: 'clothing', image: '/images/items/hat.png' },
];

export default function ClosetPage() {
    const router = useRouter();
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('clothing');
    const [wearingItems, setWearingItems] = useState({
        clothing: null,
        item: null,
        background: null
    });
    // Add selectedItem for popup
    const [selectedItem, setSelectedItem] = useState(null);
    const [filteredItems, setFilteredItems] = useState([]);
    const [characterType, setCharacterType] = useState('char_dog');

    useEffect(() => {
        if (user && user.character_type) {
            let type = user.character_type.toLowerCase();
            // Ensure prefix
            if (!type.startsWith('char_')) {
                type = `char_${type}`;
            }
            setCharacterType(type);
        }
    }, [user]);

    useEffect(() => {
        const filtered = mockInventory.filter(p => p.category === activeTab);
        setFilteredItems(filtered);
    }, [activeTab]);

    const handleBack = () => {
        router.push('/challenge');
    };

    const handleItemClick = (item) => {
        // Open popup instead of immediate toggle
        setSelectedItem(item);
    };

    const handleClosePopup = () => {
        setSelectedItem(null);
    };

    const handleEquipToggle = () => {
        if (!selectedItem) return;

        setWearingItems(prev => {
            const currentWearingId = prev[selectedItem.category];
            const isWearing = currentWearingId === selectedItem.id;

            return {
                ...prev,
                [selectedItem.category]: isWearing ? null : selectedItem.id
            };
        });
        setSelectedItem(null);
    };

    const handleSaveLook = () => {
        alert('착장이 저장되었습니다!');
    };

    const isWearingSelected = selectedItem && wearingItems[selectedItem.category] === selectedItem.id;

    return (
        <div style={styles.container}>
            {/* Top Section */}
            <div style={styles.topSection}>
                {/* Navigation Icons */}
                <div style={styles.navIcons}>
                    <button onClick={handleBack} style={styles.iconButton}>
                        <ChevronLeft color="#333" size={24} />
                    </button>
                    {/* Shop Icon - Using ShoppingBag as 'Store' icon equivalent */}
                    <button onClick={() => router.push('/shop')} style={styles.iconButton}>
                        <ShoppingBag color="#333" size={24} />
                    </button>
                    {/* Home Icon */}
                    <button onClick={() => router.push('/home')} style={styles.iconButton}>
                        <Home color="#333" size={24} />
                    </button>
                </div>

                {/* Character Image */}
                <div style={styles.characterContainer}>
                    <Image
                        src={`/images/characters/${characterType}/body.png`}
                        alt="Character"
                        fill
                        style={{ objectFit: 'contain', objectPosition: 'center bottom', paddingBottom: '40px' }}
                        priority
                    />
                </div>
            </div>

            {/* Bottom Content */}
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
                            {tab === 'clothing' && '의상'}
                            {tab === 'item' && '아이템'}
                            {tab === 'background' && '배경'}
                        </button>
                    ))}
                </div>

                {/* Items Grid */}
                <div style={styles.productsGrid}>
                    {filteredItems.map((item) => {
                        const isWearing = wearingItems[item.category] === item.id;
                        return (
                            <div
                                key={item.id}
                                style={{
                                    ...styles.productCard,
                                    // Highlight if wearing
                                    border: isWearing ? '2px solid var(--primary)' : '1px solid #eee'
                                }}
                                onClick={() => handleItemClick(item)}
                            >
                                <div style={styles.productImagePlaceholder}>
                                    {isWearing && <span style={styles.wearingBadge}>Wearing</span>}
                                    <span style={{ fontSize: '2rem' }}>🎁</span>
                                </div>
                                <div style={styles.productInfo}>
                                    <div style={styles.productName}>{item.name}</div>
                                </div>
                            </div>
                        );
                    })}
                    {filteredItems.length === 0 && (
                        <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '20px', color: '#888' }}>
                            보유한 아이템이 없습니다.
                        </div>
                    )}
                </div>

                {/* Save Look Button */}
                <div style={styles.footerButtonContainer}>
                    <button style={styles.saveButton} onClick={handleSaveLook}>
                        Save Look
                    </button>
                </div>
            </div>

            {/* Item Detail Popup (Reusing/adapting Shop Page Modal style) */}
            {selectedItem && (
                <div style={styles.popupOverlay} onClick={handleClosePopup}>
                    <div style={styles.popupContent} onClick={(e) => e.stopPropagation()}>
                        {/* Selected Item Image */}
                        <div style={styles.popupImageContainer}>
                            <span style={{ fontSize: '4rem' }}>🎁</span>
                        </div>

                        {/* Item Name */}
                        <div style={styles.popupProductName}>{selectedItem.name}</div>

                        {/* Action Button */}
                        <button
                            style={{
                                ...styles.purchaseButton,
                                backgroundColor: isWearingSelected ? '#e0e0e0' : 'var(--primary)',
                                color: isWearingSelected ? '#333' : 'white',
                            }}
                            onClick={handleEquipToggle}
                        >
                            {isWearingSelected ? '해제하기' : '적용하기'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

const styles = {
    container: {
        position: 'absolute', // Changed from fixed to respect parent maxWidth
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
        flex: '0 0 50vh', // Fixed flex basis
        position: 'relative',
        width: '100%',
        backgroundColor: '#e6e0d4', // Similar to shop BG
        backgroundImage: 'url("/images/room_background.png")', // If there is a room bg
        backgroundSize: 'cover',
        backgroundPosition: 'center',
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
    characterContainer: {
        position: 'absolute',
        top: '60px', // Below nav
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-end',
    },
    bottomSection: {
        flex: 1,
        backgroundColor: 'white',
        borderTopLeftRadius: '24px',
        borderTopRightRadius: '24px',
        marginTop: '-24px',
        zIndex: 40,
        padding: '30px 20px 0 20px', // Remove bottom padding here, move to grid
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 -4px 20px rgba(0,0,0,0.05)',
        overflowY: 'auto', // Scrollable
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
        paddingBottom: '120px', // Increased to avoid button overlap
    },
    productCard: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '10px',
        backgroundColor: 'white',
        borderRadius: '16px',
        // border handled inline for selection
        boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
        cursor: 'pointer',
        position: 'relative',
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
        position: 'relative',
    },
    wearingBadge: {
        position: 'absolute',
        top: '4px',
        right: '4px',
        backgroundColor: 'var(--primary)',
        color: 'white',
        fontSize: '0.6rem',
        padding: '2px 6px',
        borderRadius: '8px',
        fontWeight: 'bold',
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
    footerButtonContainer: {
        position: 'fixed',
        bottom: '90px', // Raised to sit above the bottom navigation bar
        left: '50%',
        transform: 'translateX(-50%)',
        width: '90%',
        maxWidth: '400px',
        zIndex: 100,
    },
    saveButton: {
        width: '100%',
        padding: '16px',
        backgroundColor: 'var(--primary)',
        color: 'white',
        border: 'none',
        borderRadius: '999px',
        fontSize: '1.1rem',
        fontWeight: 'bold',
        cursor: 'pointer',
        boxShadow: '0 4px 12px rgba(20, 184, 166, 0.4)',
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
        width: '85%',
        maxWidth: '360px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        position: 'relative',
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
        marginBottom: '20px',
        textAlign: 'center',
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
    },
};

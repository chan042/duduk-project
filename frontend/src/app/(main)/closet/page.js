"use client";

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { DoorClosed } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getUserInventory, getEquippedItems, saveEquippedItems } from '@/lib/api/shop';
import { getCharacterPreviewLayers } from '@/lib/characterPreview';

export default function ClosetPage() {
    const router = useRouter();
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('clothing');
    const [inventory, setInventory] = useState([]);
    const [wearingItems, setWearingItems] = useState({
        clothing: null,
        item: null,
        background: null
    });
    const [selectedItem, setSelectedItem] = useState(null);
    const [filteredItems, setFilteredItems] = useState([]);
    const [characterType, setCharacterType] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // 사용자 캐릭터 타입 설정
    useEffect(() => {
        if (user && user.character_type) {
            let type = user.character_type.toLowerCase();
            if (!type.startsWith('char_')) {
                type = `char_${type}`;
            }
            setCharacterType(type);
        }
    }, [user]);

    // 인벤토리 및 착장 상태 로드
    useEffect(() => {
        const loadData = async () => {
            try {
                setIsLoading(true);

                // 인벤토리는 API에서 가져옴
                const inventoryData = await getUserInventory();

                // 인벤토리 데이터 변환 (중복 제거 및 카테고리 매핑)
                const seenIds = new Set();
                const formattedInventory = [];

                (inventoryData.items || []).forEach(inv => {
                    const shopItem = inv.shop_item;
                    if (!seenIds.has(shopItem.id)) {
                        seenIds.add(shopItem.id);
                        formattedInventory.push({
                            id: shopItem.id,
                            name: shopItem.name,
                            category: shopItem.category.toLowerCase(), // CLOTHING -> clothing
                            image: shopItem.image_url,
                            image_key: shopItem.image_key,
                            price: shopItem.price
                        });
                    }
                });
                setInventory(formattedInventory);

                // 착장 상태는 백엔드 API에서 가져옴
                const equippedData = await getEquippedItems();
                setWearingItems({
                    clothing: equippedData.clothing?.id || null,
                    item: equippedData.item?.id || null,
                    background: equippedData.background?.id || null
                });
            } catch (error) {
                console.error('Failed to load closet data:', error);
            } finally {
                setIsLoading(false);
            }
        };

        loadData();
    }, []);

    // 탭 변경 시 필터링
    useEffect(() => {
        const filtered = inventory.filter(p => p.category === activeTab);
        setFilteredItems(filtered);
    }, [activeTab, inventory]);

    const handleItemClick = (item) => {
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

    const handleSaveLook = async () => {
        setIsSaving(true);

        // 현재 착장 중인 아이템 정보 수집
        const equippedData = {
            clothing: inventory.find(i => i.id === wearingItems.clothing) || null,
            item: inventory.find(i => i.id === wearingItems.item) || null,
            background: inventory.find(i => i.id === wearingItems.background) || null
        };

        const success = await saveEquippedItems(equippedData);
        setIsSaving(false);

        if (success) {
            alert('착장이 저장되었습니다!');
        } else {
            alert('저장에 실패했습니다. 다시 시도해주세요.');
        }
    };

    const isWearingSelected = selectedItem && wearingItems[selectedItem.category] === selectedItem.id;
    const clothingItem = inventory.find(i => i.id === wearingItems.clothing) || null;
    const accessoryItem = inventory.find(i => i.id === wearingItems.item) || null;
    const previewLayers = getCharacterPreviewLayers({
        characterType,
        clothing: clothingItem,
        item: accessoryItem,
    });

    // 배경 이미지 경로
    const getBackgroundStyle = () => {
        const bgItem = inventory.find(i => i.id === wearingItems.background);
        if (bgItem && bgItem.image) {
            return {
                backgroundImage: `url("${bgItem.image}")`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
            };
        }
        return {
            backgroundImage: 'url("/images/backgrounds/basic_room.png")',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
        };
    };

    return (
        <div style={styles.container}>
            {/* Top Section */}
            <div style={{ ...styles.topSection, ...getBackgroundStyle() }}>
                {/* Navigation Icons */}
                <div style={styles.navIcons}>
                    <button onClick={() => router.push('/room')} style={styles.iconButton}>
                        <DoorClosed color="#333" size={26} />
                    </button>
                </div>

                {/* Save Button (Top Right) */}
                <button
                    onClick={handleSaveLook}
                    style={{
                        position: 'absolute',
                        top: 'calc(var(--safe-area-top) + 16px)',
                        right: '16px',
                        zIndex: 50,
                        backgroundColor: 'rgba(255, 255, 255, 0.9)',
                        border: 'none',
                        padding: '8px 16px',
                        borderRadius: '20px',
                        fontWeight: 'bold',
                        color: 'var(--primary)', // Using primary color for text
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                    }}
                >
                    Save
                </button>

                {/* Character Image */}
                <div style={styles.characterContainer}>
                    {previewLayers.baseSrc && (
                        <>
                            <Image
                                src={previewLayers.baseSrc}
                                alt="Character"
                                fill
                                style={{ objectFit: 'contain', objectPosition: 'center bottom', paddingBottom: '40px' }}
                                priority
                            />
                            {previewLayers.overlaySrc && (
                                <Image
                                    src={previewLayers.overlaySrc}
                                    alt=""
                                    fill
                                    aria-hidden
                                    style={{ objectFit: 'contain', objectPosition: 'center bottom', paddingBottom: '40px', pointerEvents: 'none' }}
                                />
                            )}
                        </>
                    )}
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

                {/* Items Grid Wrapper for Scrolling */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px' }}>
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
                                        <Image
                                            src={item.image}
                                            alt={item.name}
                                            width={60}
                                            height={60}
                                            style={{ objectFit: 'contain' }}
                                        />
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
                </div>

            </div>

            {/* Item Detail Popup (Reusing/adapting Shop Page Modal style) */}
            {selectedItem && (
                <div style={styles.popupOverlay} onClick={handleClosePopup}>
                    <div style={styles.popupContent} onClick={(e) => e.stopPropagation()}>
                        {/* Selected Item Image */}
                        <div style={styles.popupImageContainer}>
                            <Image
                                src={selectedItem.image}
                                alt={selectedItem.name}
                                width={120}
                                height={120}
                                style={{ objectFit: 'contain' }}
                            />
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
        backgroundImage: 'url("/images/backgrounds/basic_room.png")',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
    },
    navIcons: {
        position: 'absolute',
        top: 'calc(var(--safe-area-top) + 16px)',
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
    characterContainer: {
        position: 'absolute',
        top: 'calc(var(--safe-area-top) + 60px)',
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
        // Remove padding and scroll from here
        padding: '0',
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
        flexShrink: 0, // Prevent tabs from shrinking
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
        paddingBottom: '100px', // Increased to avoid overlap with bottom nav
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

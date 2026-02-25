/**
 * [파일 역할]
 * - 상점 관련 API 호출 함수
 * - 백엔드 /api/shop/ 엔드포인트와 통신
 */
import client from './client';

/**
 * 상점 아이템 목록 조회
 * @param {string} category - 'CLOTHING' | 'ITEM' | 'BACKGROUND' (optional)
 */
export const getShopItems = async (category = null) => {
    try {
        let url = '/api/shop/items/';
        if (category) {
            // 프론트엔드 탭 이름(lowercase)을 백엔드 카테고리(uppercase)로 변환
            const categoryMap = {
                'clothing': 'CLOTHING',
                'item': 'ITEM',
                'background': 'BACKGROUND'
            };
            const mappedCategory = categoryMap[category] || category;
            url += `?category=${mappedCategory}`;
        }
        const response = await client.get(url);
        return response.data.items;
    } catch (error) {
        console.error('Get Shop Items Error:', error);
        throw error;
    }
};

/**
 * 사용자 인벤토리 조회
 */
export const getUserInventory = async () => {
    try {
        const response = await client.get('/api/shop/inventory/');
        return response.data;
    } catch (error) {
        console.error('Get User Inventory Error:', error);
        throw error;
    }
};

/**
 * 상점 포인트 조회
 */
export const getShopUserPoints = async () => {
    try {
        const response = await client.get('/api/shop/points/');
        return response.data;
    } catch (error) {
        console.error('Get Shop User Points Error:', error);
        throw error;
    }
};

/**
 * 상품 구매
 * @param {number} shopItemId
 */
export const purchaseItem = async (shopItemId) => {
    try {
        const response = await client.post('/api/shop/purchase/', {
            shop_item_id: shopItemId
        });
        return response.data;
    } catch (error) {
        console.error('Purchase Item Error:', error);
        throw error;
    }
};

/**
 * 가챠 실행
 */
export const playGacha = async () => {
    try {
        const response = await client.post('/api/shop/gacha/');
        return response.data;
    } catch (error) {
        console.error('Play Gacha Error:', error);
        throw error;
    }
};

/**
 * 착장 상태 조회 (백엔드 API)
 */
export const getEquippedItems = async () => {
    try {
        const response = await client.get('/api/shop/equipped/');
        return {
            clothing: response.data.clothing || null,
            item: response.data.item || null,
            background: response.data.background || null,
        };
    } catch (error) {
        console.error('Get Equipped Items Error:', error);
        return { clothing: null, item: null, background: null };
    }
};

/**
 * 착장 상태 저장 (백엔드 API)
 * @param {object} equippedItems - { clothing: {...}|null, item: {...}|null, background: {...}|null }
 */
export const saveEquippedItems = async (equippedItems) => {
    try {
        await client.put('/api/shop/equipped/', {
            clothing_id: equippedItems.clothing?.id ?? null,
            item_id: equippedItems.item?.id ?? null,
            background_id: equippedItems.background?.id ?? null,
        });
        return true;
    } catch (error) {
        console.error('Save Equipped Items Error:', error);
        return false;
    }
};



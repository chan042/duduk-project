const CHARACTER_RENDER_KEYS = new Set([
    'black_glasses',
    'body',
    'gray_hoodie',
    'gray_hoodie_black_glasses',
    'gray_hoodie_sunglasses',
    'king',
    'king_black_glasses',
    'king_sunglasses',
    'school_uniform',
    'school_uniform_black_glasses',
    'school_uniform_sunglasses',
    'Sherlock',
    'space_suit',
    'summer',
    'summer_black_glasses',
    'summer_sunglasses',
    'sunglasses',
]);

const buildCharacterAssetPath = (characterType, assetKey) =>
    `/images/characters/${characterType}/${assetKey}.png`;

const hasCharacterRenderAsset = (assetKey) =>
    Boolean(assetKey) && CHARACTER_RENDER_KEYS.has(assetKey);

const getItemOverlayPath = (item) => item?.image_url || null;

// Keep preview rendering on known-good assets so new shop items do not break the room/closet.
export function getCharacterPreviewLayers({ characterType, clothing = null, item = null }) {
    if (!characterType) {
        return {
            baseSrc: null,
            overlaySrc: null,
        };
    }

    const clothingKey = clothing?.image_key || null;
    const itemKey = item?.image_key || null;
    const comboKey = clothingKey && itemKey ? `${clothingKey}_${itemKey}` : null;

    if (hasCharacterRenderAsset(comboKey)) {
        return {
            baseSrc: buildCharacterAssetPath(characterType, comboKey),
            overlaySrc: null,
        };
    }

    if (hasCharacterRenderAsset(clothingKey)) {
        return {
            baseSrc: buildCharacterAssetPath(characterType, clothingKey),
            overlaySrc: getItemOverlayPath(item),
        };
    }

    if (hasCharacterRenderAsset(itemKey)) {
        return {
            baseSrc: buildCharacterAssetPath(characterType, itemKey),
            overlaySrc: null,
        };
    }

    return {
        baseSrc: buildCharacterAssetPath(characterType, 'body'),
        overlaySrc: getItemOverlayPath(item),
    };
}

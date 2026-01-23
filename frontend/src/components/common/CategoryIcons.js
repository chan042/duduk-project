"use client";

import {
    Utensils,
    Home,
    Coffee,
    ShoppingCart,
    ShoppingBag,
    Sparkles,
    Bus,
    Car,
    Wifi,
    Heart,
    Film,
    Plane,
    GraduationCap,
    Baby,
    PawPrint,
    Gift,
    Wine,
    HelpCircle
} from 'lucide-react';

// 모든 카테고리 목록
export const CATEGORIES = [
    '식비',
    '생활',
    '카페/간식',
    '온라인 쇼핑',
    '패션/쇼핑',
    '뷰티/미용',
    '교통',
    '자동차',
    '주거/통신',
    '의료/건강',
    '문화/여가',
    '여행/숙박',
    '교육/학습',
    '자녀/육아',
    '반려동물',
    '경조/선물',
    '술/유흥',
    '기타'
];


// 카테고리별 아이콘 컴포넌트 매핑
const CATEGORY_ICON_MAP = {
    '식비': Utensils,
    '생활': Home,
    '카페/간식': Coffee,
    '온라인 쇼핑': ShoppingCart,
    '패션/쇼핑': ShoppingBag,
    '뷰티/미용': Sparkles,
    '교통': Bus,
    '자동차': Car,
    '주거/통신': Wifi,
    '의료/건강': Heart,
    '문화/여가': Film,
    '여행/숙박': Plane,
    '교육/학습': GraduationCap,
    '자녀/육아': Baby,
    '반려동물': PawPrint,
    '경조/선물': Gift,
    '술/유흥': Wine,
    '기타': HelpCircle
};

// 구버전 카테고리 -> 신버전 카테고리 매핑
const LEGACY_CATEGORY_MAP = {
    '쇼핑': '패션/쇼핑',
    '여가': '문화/여가',
    '주거': '주거/통신',
    '통신': '주거/통신',
    '의료': '의료/건강',
    '교육': '교육/학습',
    '육아': '자녀/육아',
    '여행': '여행/숙박',
    '미용': '뷰티/미용'
};

// 카테고리별 색상 매핑
export const CATEGORY_COLORS = {
    '식비': '#14b8a6',
    '생활': '#8b5cf6',
    '카페/간식': '#f59e0b',
    '온라인 쇼핑': '#3b82f6',
    '패션/쇼핑': '#ec4899',
    '뷰티/미용': '#f472b6',
    '교통': '#6366f1',
    '자동차': '#475569',
    '주거/통신': '#0ea5e9',
    '의료/건강': '#ef4444',
    '문화/여가': '#a855f7',
    '여행/숙박': '#06b6d4',
    '교육/학습': '#22c55e',
    '자녀/육아': '#fb923c',
    '반려동물': '#84cc16',
    '경조/선물': '#f43f5e',
    '술/유흥': '#7c3aed',
    '기타': '#94a3b8'
};

/**
 * 카테고리에 해당하는 아이콘 컴포넌트 반환
 * @param {string} category - 카테고리 이름
 * @returns {React.Component} 아이콘 컴포넌트
 */
export function getCategoryIconComponent(category) {
    return CATEGORY_ICON_MAP[category] || HelpCircle;
}

/**
 * 카테고리 아이콘 JSX 반환
 * @param {string} category - 카테고리 이름
 * @param {number} size - 아이콘 크기 (기본값: 16)
 * @param {string} color - 아이콘 색상 (기본값: 카테고리별 색상)
 * @returns {JSX.Element} 아이콘 JSX
 */
export function getCategoryIcon(category, size = 16, color = null) {
    const normalizedCategory = normalizeCategory(category);
    const IconComponent = getCategoryIconComponent(normalizedCategory);
    const iconColor = color || CATEGORY_COLORS[normalizedCategory] || '#94a3b8';
    return <IconComponent size={size} color={iconColor} />;
}

/**
 * 카테고리 이름 정규화 (구버전 -> 신버전)
 * @param {string} category 
 * @returns {string} Normalized category name
 */
export function normalizeCategory(category) {
    if (!category) return '기타';
    if (CATEGORIES.includes(category)) return category;
    return LEGACY_CATEGORY_MAP[category] || '기타';
}

export default {
    CATEGORIES,
    CATEGORY_COLORS,
    getCategoryIcon,
    getCategoryIconComponent,
    normalizeCategory
};

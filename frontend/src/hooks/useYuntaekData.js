"use client";

import { useState, useEffect } from 'react';
import { getYuntaekScore, getYuntaekReport } from '@/lib/api/yuntaek';

const SCORE_DETAILS_MAP = [
    { key: 'budget_achievement', label: '예산 달성률', max: 35 },
    { key: 'alternative_action', label: '대체 행동 실현', max: 20 },
    { key: 'growth_consumption', label: '성장 점수', max: 10 },
    { key: 'health_score', label: '건강 점수', max: 15 },
    { key: 'spending_consistency', label: '꾸준함', max: 7 },
    { key: 'leakage_improvement', label: '누수지출 개선', max: 10 },
    { key: 'challenge_success', label: '챌린지 참여', max: 3 },
];

function extractSummary(reportData) {
    if (!reportData) return '요약 정보를 불러올 수 없습니다.';
    if (typeof reportData === 'object' && reportData.summary) {
        return reportData.summary.overview || '요약 정보를 불러올 수 없습니다.';
    }
    return '요약 정보를 불러올 수 없습니다.';
}

function buildGuideText(guide) {
    return `${guide.title}\n\n${guide.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\n💡 팁:\n${guide.tips.map(t => `• ${t}`).join('\n')}`;
}

// localStorage 캐싱 헬퍼 함수
function getCacheKey(type, year, month) {
    return `yuntaek_${type}_${year}_${month}`;
}

function getFromCache(type, year, month) {
    if (typeof window === 'undefined') return null;

    try {
        const key = getCacheKey(type, year, month);
        const cached = localStorage.getItem(key);
        if (!cached) return null;

        const data = JSON.parse(cached);
        // 캐시 데이터의 year/month가 요청한 것과 일치하는지 확인
        if (data.year === year && data.month === month) {
            return data;
        }
        return null;
    } catch (err) {
        console.error('캐시 읽기 오류:', err);
        return null;
    }
}

function saveToCache(type, data) {
    if (typeof window === 'undefined') return;

    try {
        const { year, month } = data;
        const key = getCacheKey(type, year, month);
        localStorage.setItem(key, JSON.stringify(data));
    } catch (err) {
        console.error('캐시 저장 오류:', err);
    }
}

export function useYuntaekScore() {
    const [scoreData, setScoreData] = useState(null);
    const [isNewUser, setIsNewUser] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [fromCache, setFromCache] = useState(false);

    useEffect(() => {
        const fetchScore = async () => {
            try {
                // 1. localStorage에서 캐시 확인
                const now = new Date();
                const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth();
                const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

                const cached = getFromCache('score', prevYear, prevMonth);

                if (cached) {
                    // 캐시가 있으면 즉시 표시
                    if (cached.is_new_user) {
                        setIsNewUser(true);
                        setScoreData(null);
                    } else {
                        setScoreData(cached);
                    }
                    setFromCache(true);
                    setLoading(false);
                }

                // 2. 백그라운드에서 API 재검증
                const data = await getYuntaekScore();

                if (data.is_new_user) {
                    setIsNewUser(true);
                    setScoreData(null);
                } else {
                    setScoreData(data);
                }

                // 3. 새 데이터를 캐시에 저장
                saveToCache('score', data);
                setFromCache(false);
            } catch (err) {
                console.error('윤택지수 로딩 오류:', err);
                setError(err.response?.data?.error || err.message || '윤택지수를 불러오는데 실패했습니다.');
            } finally {
                setLoading(false);
            }
        };
        fetchScore();
    }, []);

    const score = scoreData?.total_score || 0;

    const details = scoreData
        ? SCORE_DETAILS_MAP.map(({ key, label, max }) => ({
            label,
            score: scoreData.breakdown?.[key] || 0,
            max,
        }))
        : [];

    return { scoreData, score, details, isNewUser, loading, error, fromCache };
}

export function useYuntaekReport() {
    const [reportData, setReportData] = useState(null);
    const [reportSummary, setReportSummary] = useState('');
    const [isNewUser, setIsNewUser] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [fromCache, setFromCache] = useState(false);

    useEffect(() => {
        const fetchReport = async () => {
            try {
                // 1. localStorage에서 캐시 확인
                const now = new Date();
                const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth();
                const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

                const cached = getFromCache('report', prevYear, prevMonth);

                if (cached) {
                    // 캐시가 있으면 즉시 표시
                    setReportData(cached);

                    if (cached.is_new_user) {
                        setIsNewUser(true);
                        if (cached.report?.guide) {
                            setReportSummary(buildGuideText(cached.report.guide));
                        } else if (cached.report?.summary) {
                            setReportSummary(cached.report.summary.overview);
                        } else {
                            setReportSummary('리포트를 불러올 수 없습니다.');
                        }
                    } else {
                        setReportSummary(extractSummary(cached.report));
                    }

                    setFromCache(true);
                    setLoading(false);
                }

                // 2. 백그라운드에서 API 재검증
                const data = await getYuntaekReport();
                setReportData(data);

                if (data.is_new_user) {
                    setIsNewUser(true);

                    if (data.report?.guide) {
                        setReportSummary(buildGuideText(data.report.guide));
                    } else if (data.report?.summary) {
                        setReportSummary(data.report.summary.overview);
                    } else {
                        setReportSummary('리포트를 불러올 수 없습니다.');
                    }
                } else {
                    setReportSummary(extractSummary(data.report));
                }

                // 3. 새 데이터를 캐시에 저장
                saveToCache('report', data);
                setFromCache(false);
            } catch (err) {
                console.error('리포트 로딩 오류:', err);
                setError(err.response?.data?.error || err.message || '리포트를 불러오는데 실패했습니다.');
            } finally {
                setLoading(false);
            }
        };
        fetchReport();
    }, []);

    return { reportData, reportSummary, isNewUser, loading, error, fromCache };
}

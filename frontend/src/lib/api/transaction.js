import client from './client';
import { extractApiErrorMessage, isRequestCanceled } from './helpers';

export const parseTransaction = async (text, options = {}) => {
    try {
        const response = await client.post('/api/transactions/parse/', { text }, {
            timeout: 30000,
            signal: options.signal,
        });
        return response.data;
    } catch (error) {
        if (isRequestCanceled(error)) {
            throw error;
        }

        console.error('Parse Error:', error);
        throw new Error(extractApiErrorMessage(error, '분석에 실패했습니다. 다시 시도해주세요.', {
            timeoutMessage: 'AI 분석 서버가 바쁩니다. 잠시 후 다시 시도해주세요.',
            statusMessages: {
                500: 'AI 분석 서버가 바쁩니다. 잠시 후 다시 시도해주세요.',
                503: 'AI 분석 서버가 바쁩니다. 잠시 후 다시 시도해주세요.',
            },
        }));
    }
};

export const createTransaction = async (data, options = {}) => {
    try {
        const response = await client.post('/api/transactions/create/', data, {
            signal: options.signal,
        });
        return response.data;
    } catch (error) {
        if (isRequestCanceled(error)) {
            throw error;
        }

        console.error('Create Error:', error);
        throw new Error(extractApiErrorMessage(error, '저장에 실패했습니다.'));
    }
};

export const getTransactions = async () => {
    try {
        const response = await client.get('/api/transactions/');
        return response.data;
    } catch (error) {
        console.error('Get Transactions Error:', error);
        throw error;
    }
};

export const getTransactionsByMonth = async (year, month) => {
    try {
        const response = await client.get(`/api/transactions/?year=${year}&month=${month}`);
        return response.data;
    } catch (error) {
        console.error('Get Transactions By Month Error:', error);
        throw error;
    }
};

export const updateTransaction = async (id, data) => {
    try {
        const response = await client.patch(`/api/transactions/${id}/`, data);
        return response.data;
    } catch (error) {
        console.error('Update Transaction Error:', error);
        throw error;
    }
};

export const deleteTransaction = async (id) => {
    try {
        const response = await client.delete(`/api/transactions/${id}/`);
        return response.data;
    } catch (error) {
        console.error('Delete Transaction Error:', error);
        throw error;
    }
};

export const getCategoryStats = async (year, month) => {
    try {
        let url = '/api/transactions/category-stats/';
        if (year && month) {
            url += `?year=${year}&month=${month}`;
        }
        const response = await client.get(url);
        return response.data;
    } catch (error) {
        console.error('Get Category Stats Error:', error);
        throw error;
    }
};

export const getMonthlyAnalysis = async (year, month) => {
    try {
        const response = await client.get(`/api/transactions/monthly-analysis/?year=${year}&month=${month}`);
        return response.data;
    } catch (error) {
        console.error('Get Monthly Analysis Error:', error);
        throw error;
    }
};

export const confirmNoSpending = async (date) => {
    try {
        const response = await client.post('/api/transactions/spending-confirmation/', {
            date,
            is_no_spending: true
        });
        return response.data;
    } catch (error) {
        console.error('Confirm No Spending Error:', error);
        throw error;
    }
};

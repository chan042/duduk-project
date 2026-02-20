import client from './client';

export const parseTransaction = async (text) => {
    try {
        const response = await client.post('/api/transactions/parse/', { text }, { timeout: 30000 });
        return response.data;
    } catch (error) {
        console.error('Parse Error:', error);
        throw error;
    }
};

export const createTransaction = async (data) => {
    try {
        const response = await client.post('/api/transactions/create/', data);
        return response.data;
    } catch (error) {
        console.error('Create Error:', error);
        throw error;
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

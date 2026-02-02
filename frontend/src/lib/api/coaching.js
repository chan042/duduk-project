import client from './client';

export const getCoachingAdvice = async (year, month) => {
    try {
        let url = '/api/coaching/advice/';
        if (year && month) {
            url += `?year=${year}&month=${month}`;
        }
        const response = await client.get(url);
        return response.data;
    } catch (error) {
        console.error('Error fetching coaching advice:', error);
        return [];
    }
};

export const submitFeedback = async (isLiked, dislikeReason = '') => {
    try {
        const response = await client.post('/api/coaching/feedback/', {
            is_liked: isLiked,
            dislike_reason: dislikeReason
        });
        return response.data;
    } catch (error) {
        console.error('Error submitting feedback:', error);
        throw error;
    }
};

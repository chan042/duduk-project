export const extractApiErrorMessage = (error, fallbackMessage, options = {}) => {
    const {
        timeoutMessage,
        statusMessages = {},
    } = options;

    const isTimeout = error?.code === 'ECONNABORTED' || error?.message?.includes('timeout');

    if (isTimeout && timeoutMessage) {
        return timeoutMessage;
    }

    const responseMessage = error?.response?.data?.error || error?.response?.data?.message;
    if (responseMessage) {
        return responseMessage;
    }

    const statusMessage = statusMessages[error?.response?.status];
    if (statusMessage) {
        return statusMessage;
    }

    return fallbackMessage;
};

export const isRequestCanceled = (error) => {
    return (
        error?.code === 'ERR_CANCELED' ||
        error?.name === 'CanceledError' ||
        error?.message === 'canceled'
    );
};

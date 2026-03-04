import api from './apiClient';

export const authService = {
    login: async (email, password) => {
        try {
            // Default to salesman authentication
            const response = await api.post('/auth/login-salesman', { email, password });
            return response.data;
        } catch (error) {
            // Fallback to developer login if salesman fails
            if (error.response && error.response.status === 401) {
                const devResponse = await api.post('/auth/login-developer', { email, password });
                return devResponse.data;
            }
            throw error;
        }
    },
};

import api from './apiClient';

export const authService = {
    login: async (username, password) => {
        const response = await api.post('/auth/login', { username, password });
        return response.data;
    },
};

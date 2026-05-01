import api from './apiClient';

export const authService = {
    login: async (email, password, loginType = 'salesman') => {
        const endpoint = loginType === 'developer' ? '/auth/login-developer' : '/auth/login-salesman';
        const response = await api.post(endpoint, { email, password });
        return response.data;
    },
};

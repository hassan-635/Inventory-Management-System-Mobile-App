import api from './apiClient';

export const buyersService = {
    getAll: async () => {
        const response = await api.get('/buyers');
        return response.data;
    },
    create: async (data) => {
        const response = await api.post('/buyers', data);
        return response.data;
    },
    update: async (id, data) => {
        const response = await api.put(`/buyers/${id}`, data);
        return response.data;
    },
    delete: async (id) => {
        const response = await api.delete(`/buyers/${id}`);
        return response.data;
    }
};

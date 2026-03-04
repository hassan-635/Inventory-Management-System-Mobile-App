import api from './apiClient';

export const suppliersService = {
    getAll: async () => {
        const response = await api.get('/suppliers');
        return response.data;
    },
    create: async (data) => {
        const response = await api.post('/suppliers', data);
        return response.data;
    },
    update: async (id, data) => {
        const response = await api.put(`/suppliers/${id}`, data);
        return response.data;
    },
    delete: async (id) => {
        const response = await api.delete(`/suppliers/${id}`);
        return response.data;
    }
};

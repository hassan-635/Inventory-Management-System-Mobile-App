import api from './apiClient';

export const productsService = {
    getAll: async () => {
        const response = await api.get('/products');
        return response.data;
    },
    create: async (data) => {
        const response = await api.post('/products', data);
        return response.data;
    },
    update: async (id, data) => {
        const response = await api.put(`/products/${id}`, data);
        return response.data;
    },
    delete: async (id) => {
        const response = await api.delete(`/products/${id}`);
        return response.data;
    }
};

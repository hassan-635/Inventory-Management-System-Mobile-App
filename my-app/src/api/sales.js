import api from './apiClient';

export const salesService = {
    getAll: async () => {
        const response = await api.get('/sales');
        return response.data;
    },
    create: async (data) => {
        const response = await api.post('/sales', data);
        return response.data;
    },
    delete: async (id) => {
        const response = await api.delete(`/sales/${id}`);
        return response.data;
    },
    /** Partial or full return: body { quantity } — credit reduced in proportion for this line only */
    returnQty: async (id, quantity) => {
        const response = await api.post(`/sales/${id}/return`, { quantity });
        return response.data;
    },
};

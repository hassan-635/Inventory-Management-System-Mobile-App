import api from './axiosConfig';

export const purchasesService = {
    getAll: async () => {
        const response = await api.get('/purchases');
        return response.data;
    },
    updatePayment: async (id, data) => {
        const response = await api.put(`/purchases/${id}`, data);
        return response.data;
    }
};

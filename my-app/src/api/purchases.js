import api from './apiClient';

export const purchasesService = {
    getAll: async () => {
        const response = await api.get('/purchases');
        return response.data;
    },
    updatePayment: async (id, add_payment) => {
        const response = await api.put(`/purchases/${id}`, { add_payment });
        return response.data;
    }
};

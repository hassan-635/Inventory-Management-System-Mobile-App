import api from './apiClient';

export const billingService = {
    getNextInvoiceId: async () => {
        const response = await api.get('/billing/next-invoice-id');
        return response.data;
    },
    createBill: async (data) => {
        const response = await api.post('/billing', data);
        return response.data;
    }
};

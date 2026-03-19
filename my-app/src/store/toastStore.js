import { create } from 'zustand';

export const useToastStore = create((set, get) => ({
    visible: false,
    title: '',
    message: '',
    type: 'success', // 'success', 'error', 'info'
    timeoutId: null,

    showToast: (title, message, type = 'success') => {
        // Clear existing timeout if showing a new toast
        const currentTimeout = get().timeoutId;
        if (currentTimeout) {
            clearTimeout(currentTimeout);
        }

        set({ visible: true, title, message, type });

        const newTimeoutId = setTimeout(() => {
            set({ visible: false });
        }, 3500);

        set({ timeoutId: newTimeoutId });
    },

    hideToast: () => set({ visible: false })
}));

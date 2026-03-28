import { create } from 'zustand';

/**
 * Bump when inventory-related data changes (new sale, return, bill saved)
 * so Products / Sales / Billing can refetch without navigating away.
 */
export const useDataRefreshStore = create((set) => ({
    inventoryTick: 0,
    bumpInventory: () => set((s) => ({ inventoryTick: s.inventoryTick + 1 })),
}));

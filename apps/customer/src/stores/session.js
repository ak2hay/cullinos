import { create } from 'zustand';
import { persist } from 'zustand/middleware';
export const useSessionStore = create()(persist((set) => ({
    organizationId: null,
    organizationName: null,
    organizationSlug: null,
    outletId: import.meta.env.VITE_OUTLET_ID ?? null,
    outletName: null,
    outletSlug: null,
    tableId: null,
    tableName: null,
    orderMode: 'online',
    setStorefront: (data) => set({
        organizationId: data.organizationId,
        organizationName: data.organizationName,
        organizationSlug: data.organizationSlug,
        outletId: data.outletId,
        outletName: data.outletName,
        outletSlug: data.outletSlug,
        orderMode: 'online',
    }),
    setTable: (tableId, tableName = null) => set({
        tableId,
        tableName,
        orderMode: tableId ? 'dine-in' : 'online',
    }),
    setOrderMode: (mode) => set({ orderMode: mode }),
    initFromSearchParams: (params) => {
        const table = params.get('table');
        const tableName = params.get('tableName');
        const updates = {};
        if (table) {
            updates.tableId = table;
            updates.tableName = tableName ?? `Table ${table.slice(0, 8)}`;
            updates.orderMode = 'dine-in';
        }
        set(updates);
    },
}), {
    name: 'cullinos-customer-session',
    partialize: (state) => ({
        organizationId: state.organizationId,
        organizationName: state.organizationName,
        organizationSlug: state.organizationSlug,
        outletId: state.outletId,
        outletName: state.outletName,
        outletSlug: state.outletSlug,
        tableId: state.tableId,
        tableName: state.tableName,
        orderMode: state.orderMode,
    }),
}));

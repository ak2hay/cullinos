import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SessionState {
  outletId: string | null;
  tableId: string | null;
  tableName: string | null;
  orderMode: 'dine-in' | 'online';
  setOutletId: (id: string | null) => void;
  setTable: (tableId: string | null, tableName?: string | null) => void;
  setOrderMode: (mode: 'dine-in' | 'online') => void;
  initFromSearchParams: (params: URLSearchParams) => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      outletId: import.meta.env.VITE_OUTLET_ID ?? null,
      tableId: null,
      tableName: null,
      orderMode: 'online',

      setOutletId: (id) => set({ outletId: id }),

      setTable: (tableId, tableName = null) =>
        set({
          tableId,
          tableName,
          orderMode: tableId ? 'dine-in' : 'online',
        }),

      setOrderMode: (mode) => set({ orderMode: mode }),

      initFromSearchParams: (params) => {
        const table = params.get('table');
        const outlet = params.get('outlet');
        const updates: Partial<SessionState> = {};

        if (outlet) {
          updates.outletId = outlet;
        } else if (import.meta.env.VITE_OUTLET_ID) {
          updates.outletId = import.meta.env.VITE_OUTLET_ID;
        }

        if (table) {
          updates.tableId = table;
          updates.tableName = params.get('tableName') ?? `Table ${table.slice(0, 8)}`;
          updates.orderMode = 'dine-in';
        }

        set(updates);
      },
    }),
    {
      name: 'cullinos-customer-session',
      partialize: (state) => ({
        outletId: state.outletId,
        tableId: state.tableId,
        tableName: state.tableName,
        orderMode: state.orderMode,
      }),
    },
  ),
);

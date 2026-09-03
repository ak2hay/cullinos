import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { StorefrontBootstrap } from '@/lib/api';

interface SessionState {
  organizationId: string | null;
  organizationName: string | null;
  organizationSlug: string | null;
  outletId: string | null;
  outletName: string | null;
  outletSlug: string | null;
  tableId: string | null;
  tableName: string | null;
  sessionToken: string | null;
  orderMode: 'dine-in' | 'online';
  setStorefront: (data: StorefrontBootstrap) => void;
  setTable: (tableId: string | null, tableName?: string | null) => void;
  setSession: (token: string, tableId: string, tableName: string) => void;
  clearSession: () => void;
  setOrderMode: (mode: 'dine-in' | 'online') => void;
  initFromSearchParams: (params: URLSearchParams) => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      organizationId: null,
      organizationName: null,
      organizationSlug: null,
      outletId: import.meta.env.VITE_OUTLET_ID ?? null,
      outletName: null,
      outletSlug: null,
      tableId: null,
      tableName: null,
      sessionToken: null,
      orderMode: 'online',

      setStorefront: (data) =>
        set({
          organizationId: data.organizationId,
          organizationName: data.organizationName,
          organizationSlug: data.organizationSlug,
          outletId: data.outletId,
          outletName: data.outletName,
          outletSlug: data.outletSlug,
        }),

      setTable: (tableId, tableName = null) =>
        set({
          tableId,
          tableName,
          orderMode: tableId ? 'dine-in' : 'online',
        }),

      setSession: (sessionToken, tableId, tableName) =>
        set({
          sessionToken,
          tableId,
          tableName,
          orderMode: 'dine-in',
        }),

      clearSession: () =>
        set({
          sessionToken: null,
          tableId: null,
          tableName: null,
          orderMode: 'online',
        }),

      setOrderMode: (mode) => set({ orderMode: mode }),

      initFromSearchParams: (params) => {
        const session = params.get('session');
        const table = params.get('table');
        const tableName = params.get('tableName');
        const updates: Partial<SessionState> = {};

        if (session) {
          updates.sessionToken = session;
          updates.orderMode = 'dine-in';
        } else if (table) {
          updates.tableId = table;
          updates.tableName = tableName ?? `Table ${table.slice(0, 8)}`;
          updates.orderMode = 'dine-in';
        }

        set(updates);
      },
    }),
    {
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
        sessionToken: state.sessionToken,
        orderMode: state.orderMode,
      }),
    },
  ),
);

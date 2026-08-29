import { create } from 'zustand';
import { persist } from 'zustand/middleware';
export const useAuthStore = create()(persist((set) => ({
    accessToken: null,
    refreshToken: null,
    user: null,
    permissions: [],
    selectedOutletId: null,
    setAuth: ({ accessToken, refreshToken, user, permissions }) => set({ accessToken, refreshToken, user, permissions }),
    setSelectedOutlet: (outletId) => set({ selectedOutletId: outletId }),
    logout: () => set({
        accessToken: null,
        refreshToken: null,
        user: null,
        permissions: [],
        selectedOutletId: null,
    }),
}), {
    name: 'cullinos-admin-auth',
    partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
        permissions: state.permissions,
        selectedOutletId: state.selectedOutletId,
    }),
}));

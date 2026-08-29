import { create } from 'zustand';
import { persist } from 'zustand/middleware';
export const useAuthStore = create()(persist((set) => ({
    accessToken: null,
    admin: null,
    setAuth: ({ accessToken, admin }) => set({ accessToken, admin }),
    logout: () => set({ accessToken: null, admin: null }),
}), {
    name: 'cullinos-super-admin-auth',
    partialize: (state) => ({
        accessToken: state.accessToken,
        admin: state.admin,
    }),
}));

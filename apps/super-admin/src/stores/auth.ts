import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface SuperAdminUser {
  id: string;
  email: string;
  name: string;
}

interface AuthState {
  accessToken: string | null;
  admin: SuperAdminUser | null;
  setAuth: (payload: { accessToken: string; admin: SuperAdminUser }) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      admin: null,
      setAuth: ({ accessToken, admin }) => set({ accessToken, admin }),
      logout: () => set({ accessToken: null, admin: null }),
    }),
    {
      name: 'cullinos-super-admin-auth',
      partialize: (state) => ({
        accessToken: state.accessToken,
        admin: state.admin,
      }),
    },
  ),
);

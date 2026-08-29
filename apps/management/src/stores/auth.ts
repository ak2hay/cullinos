import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AuthUser {
  id: string;
  organizationId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  permissions: string[];
  selectedBrandId: string | null;
  selectedOutletId: string | null;
  setAuth: (payload: {
    accessToken: string;
    refreshToken: string;
    user: AuthUser;
    permissions: string[];
  }) => void;
  setSelectedBrand: (brandId: string | null) => void;
  setSelectedOutlet: (outletId: string | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      permissions: [],
      selectedBrandId: null,
      selectedOutletId: null,
      setAuth: ({ accessToken, refreshToken, user, permissions }) =>
        set({ accessToken, refreshToken, user, permissions }),
      setSelectedBrand: (brandId) => set({ selectedBrandId: brandId }),
      setSelectedOutlet: (outletId) => set({ selectedOutletId: outletId }),
      logout: () =>
        set({
          accessToken: null,
          refreshToken: null,
          user: null,
          permissions: [],
          selectedBrandId: null,
          selectedOutletId: null,
        }),
    }),
    {
      name: 'cullinos-management-auth',
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
        permissions: state.permissions,
        selectedBrandId: state.selectedBrandId,
        selectedOutletId: state.selectedOutletId,
      }),
    },
  ),
);

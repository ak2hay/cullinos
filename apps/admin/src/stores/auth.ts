import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import {
  defaultPortalMode,
  type PortalMode,
} from '@cullinos/shared';

export const ADMIN_REMEMBER_KEY = 'cullinos-admin-remember';

function makeRememberStorage(): StateStorage {
  return {
    getItem: (key) => {
      const useSession = localStorage.getItem(ADMIN_REMEMBER_KEY) === 'false';
      return (useSession ? sessionStorage : localStorage).getItem(key);
    },
    setItem: (key, value) => {
      const useSession = localStorage.getItem(ADMIN_REMEMBER_KEY) === 'false';
      if (useSession) {
        sessionStorage.setItem(key, value);
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, value);
        sessionStorage.removeItem(key);
      }
    },
    removeItem: (key) => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    },
  };
}

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
  mustChangePassword?: boolean;
  organizationName?: string;
  organizationSlug?: string;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  permissions: string[];
  selectedOutletId: string | null;
  portalMode: PortalMode;
  impersonation: boolean;
  impersonatedBy: string | null;
  setAuth: (payload: {
    accessToken: string;
    refreshToken: string;
    user: AuthUser;
    permissions: string[];
    impersonation?: boolean;
    impersonatedBy?: string | null;
  }) => void;
  setMustChangePassword: (value: boolean) => void;
  setSelectedOutlet: (outletId: string | null) => void;
  setPortalMode: (mode: PortalMode) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      permissions: [],
      selectedOutletId: null,
      portalMode: 'erp',
      impersonation: false,
      impersonatedBy: null,
      setAuth: ({
        accessToken,
        refreshToken,
        user,
        permissions,
        impersonation = false,
        impersonatedBy = null,
      }) =>
        set({
          accessToken,
          refreshToken,
          user,
          permissions,
          portalMode: defaultPortalMode(permissions),
          impersonation,
          impersonatedBy,
        }),
      setMustChangePassword: (value) =>
        set((state) =>
          state.user ? { user: { ...state.user, mustChangePassword: value } } : state,
        ),
      setSelectedOutlet: (outletId) => set({ selectedOutletId: outletId }),
      setPortalMode: (mode) => set({ portalMode: mode }),
      logout: () =>
        set({
          accessToken: null,
          refreshToken: null,
          user: null,
          permissions: [],
          selectedOutletId: null,
          portalMode: 'erp',
          impersonation: false,
          impersonatedBy: null,
        }),
    }),
    {
      name: 'cullinos-admin-auth',
      storage: createJSONStorage(() => makeRememberStorage()),
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
        permissions: state.permissions,
        selectedOutletId: state.selectedOutletId,
        portalMode: state.portalMode,
        impersonation: state.impersonation,
        impersonatedBy: state.impersonatedBy,
      }),
    },
  ),
);

export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

export const POS_REMEMBER_KEY = 'cullinos-pos-remember';

function makeRememberStorage(): StateStorage {
  return {
    getItem: (key) => {
      const useSession = localStorage.getItem(POS_REMEMBER_KEY) === 'false';
      return (useSession ? sessionStorage : localStorage).getItem(key);
    },
    setItem: (key, value) => {
      const useSession = localStorage.getItem(POS_REMEMBER_KEY) === 'false';
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
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  permissions: string[];
  selectedOutletId: string | null;
  setAuth: (payload: {
    accessToken: string;
    refreshToken: string;
    user: AuthUser;
    permissions: string[];
  }) => void;
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
      selectedOutletId: null,
      setAuth: ({ accessToken, refreshToken, user, permissions }) =>
        set({ accessToken, refreshToken, user, permissions }),
      setSelectedOutlet: (outletId) => set({ selectedOutletId: outletId }),
      logout: () =>
        set({
          accessToken: null,
          refreshToken: null,
          user: null,
          permissions: [],
          selectedOutletId: null,
        }),
    }),
    {
      name: 'cullinos-pos-auth',
      storage: createJSONStorage(() => makeRememberStorage()),
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
        permissions: state.permissions,
        selectedOutletId: state.selectedOutletId,
      }),
    },
  ),
);

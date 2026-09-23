import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

export const SUPER_ADMIN_REMEMBER_KEY = 'cullinos-super-admin-remember';

function makeRememberStorage(): StateStorage {
  return {
    getItem: (key) => {
      const useSession = localStorage.getItem(SUPER_ADMIN_REMEMBER_KEY) === 'false';
      return (useSession ? sessionStorage : localStorage).getItem(key);
    },
    setItem: (key, value) => {
      const useSession = localStorage.getItem(SUPER_ADMIN_REMEMBER_KEY) === 'false';
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
      storage: createJSONStorage(() => makeRememberStorage()),
      partialize: (state) => ({
        accessToken: state.accessToken,
        admin: state.admin,
      }),
    },
  ),
);

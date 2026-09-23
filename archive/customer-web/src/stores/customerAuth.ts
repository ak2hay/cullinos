import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

export const CUSTOMER_REMEMBER_KEY = 'cullinos-customer-remember';

function makeRememberStorage(): StateStorage {
  return {
    getItem: (key) => {
      const useSession = localStorage.getItem(CUSTOMER_REMEMBER_KEY) === 'false';
      return (useSession ? sessionStorage : localStorage).getItem(key);
    },
    setItem: (key, value) => {
      const useSession = localStorage.getItem(CUSTOMER_REMEMBER_KEY) === 'false';
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

export interface CustomerProfile {
  id: string;
  name: string;
  phone: string;
  loyaltyPoints: number;
  stampCount: number;
}

interface CustomerAuthState {
  accessToken: string | null;
  customer: CustomerProfile | null;
  setAuth: (payload: { accessToken: string; customer: CustomerProfile }) => void;
  updateCustomer: (customer: Partial<CustomerProfile>) => void;
  logout: () => void;
}

export const useCustomerAuthStore = create<CustomerAuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      customer: null,
      setAuth: ({ accessToken, customer }) => set({ accessToken, customer }),
      updateCustomer: (patch) =>
        set((state) =>
          state.customer ? { customer: { ...state.customer, ...patch } } : state,
        ),
      logout: () => set({ accessToken: null, customer: null }),
    }),
    {
      name: 'cullinos-customer-auth',
      storage: createJSONStorage(() => makeRememberStorage()),
      partialize: (state) => ({
        accessToken: state.accessToken,
        customer: state.customer,
      }),
    },
  ),
);

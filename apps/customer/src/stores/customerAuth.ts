import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
      partialize: (state) => ({
        accessToken: state.accessToken,
        customer: state.customer,
      }),
    },
  ),
);

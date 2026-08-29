import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CartLine } from './cart';

export interface HeldOrder {
  id: string;
  orderNumber: string;
  heldAt: string;
  lines: CartLine[];
  subtotal: number;
}

interface HeldOrdersState {
  orders: HeldOrder[];
  addHeld: (order: HeldOrder) => void;
  removeHeld: (id: string) => void;
}

export const useHeldOrdersStore = create<HeldOrdersState>()(
  persist(
    (set) => ({
      orders: [],
      addHeld: (order) =>
        set((state) => ({
          orders: [order, ...state.orders.filter((o) => o.id !== order.id)],
        })),
      removeHeld: (id) =>
        set((state) => ({
          orders: state.orders.filter((o) => o.id !== id),
        })),
    }),
    { name: 'cullinos-pos-held-orders' },
  ),
);

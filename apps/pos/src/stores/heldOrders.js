import { create } from 'zustand';
import { persist } from 'zustand/middleware';
export const useHeldOrdersStore = create()(persist((set) => ({
    orders: [],
    addHeld: (order) => set((state) => ({
        orders: [order, ...state.orders.filter((o) => o.id !== order.id)],
    })),
    removeHeld: (id) => set((state) => ({
        orders: state.orders.filter((o) => o.id !== id),
    })),
}), { name: 'cullinos-pos-held-orders' }));

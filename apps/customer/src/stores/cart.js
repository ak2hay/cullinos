import { create } from 'zustand';
import { persist } from 'zustand/middleware';
function cartItemKey(item) {
    const modKey = item.modifiers.map((m) => m.id).sort().join(',');
    return `${item.menuItemId}:${item.variantId ?? ''}:${modKey}:${item.notes ?? ''}`;
}
export const useCartStore = create()(persist((set, get) => ({
    items: [],
    addItem: (item) => {
        const key = cartItemKey(item);
        set((state) => {
            const existing = state.items.find((i) => cartItemKey(i) === key);
            if (existing) {
                return {
                    items: state.items.map((i) => i.id === existing.id ? { ...i, quantity: i.quantity + item.quantity } : i),
                };
            }
            return {
                items: [...state.items, { ...item, id: crypto.randomUUID() }],
            };
        });
    },
    removeItem: (id) => set((state) => ({ items: state.items.filter((i) => i.id !== id) })),
    updateQuantity: (id, quantity) => set((state) => ({
        items: quantity <= 0
            ? state.items.filter((i) => i.id !== id)
            : state.items.map((i) => (i.id === id ? { ...i, quantity } : i)),
    })),
    clear: () => set({ items: [] }),
    total: () => get().items.reduce((sum, item) => {
        const modTotal = item.modifiers.reduce((m, mod) => m + mod.price, 0);
        return sum + (item.unitPrice + modTotal) * item.quantity;
    }, 0),
    itemCount: () => get().items.reduce((sum, item) => sum + item.quantity, 0),
}), { name: 'cullinos-customer-cart' }));

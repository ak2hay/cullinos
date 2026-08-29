import { create } from 'zustand';
export const useCartStore = create((set, get) => ({
    lines: [],
    addItem: (item) => set((state) => {
        const existing = state.lines.find((l) => l.menuItemId === item.id);
        if (existing) {
            return {
                lines: state.lines.map((l) => l.menuItemId === item.id ? { ...l, quantity: l.quantity + 1 } : l),
            };
        }
        return {
            lines: [
                ...state.lines,
                {
                    menuItemId: item.id,
                    name: item.name,
                    unitPrice: item.price,
                    quantity: 1,
                },
            ],
        };
    }),
    removeItem: (menuItemId) => set((state) => ({
        lines: state.lines.filter((l) => l.menuItemId !== menuItemId),
    })),
    updateQuantity: (menuItemId, quantity) => set((state) => {
        if (quantity <= 0) {
            return { lines: state.lines.filter((l) => l.menuItemId !== menuItemId) };
        }
        return {
            lines: state.lines.map((l) => l.menuItemId === menuItemId ? { ...l, quantity } : l),
        };
    }),
    clear: () => set({ lines: [] }),
    subtotal: () => get().lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0),
    itemCount: () => get().lines.reduce((sum, line) => sum + line.quantity, 0),
}));

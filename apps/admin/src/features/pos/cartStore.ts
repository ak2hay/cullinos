import { create } from 'zustand';

export const CART_NOTE_MAX_LENGTH = 200;

export interface CartLineModifier {
  modifierId: string;
  name: string;
  /** Paise */
  price: number;
}

export interface CartLine {
  lineId: string;
  menuItemId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  notes?: string;
  variantId?: string;
  modifiers?: CartLineModifier[];
}

export interface AddCartItem {
  id: string;
  name: string;
  price: number;
  variantId?: string;
  modifiers?: CartLineModifier[];
}

interface CartState {
  lines: CartLine[];
  addItem: (item: AddCartItem) => void;
  removeItem: (lineId: string) => void;
  updateQuantity: (lineId: string, quantity: number) => void;
  setLineNote: (lineId: string, notes: string) => void;
  clear: () => void;
  subtotal: () => number;
  itemCount: () => number;
}

let lineSeq = 0;
function nextLineId(menuItemId: string): string {
  lineSeq += 1;
  return `${menuItemId}:${Date.now().toString(36)}:${lineSeq}`;
}

function optionsKey(variantId?: string, modifiers?: CartLineModifier[]): string {
  const mods = (modifiers ?? []).map((m) => m.modifierId).sort().join(',');
  return `${variantId ?? ''}|${mods}`;
}

/** Held orders saved before line ids existed only carry menuItemId. */
export function normalizeCartLines(lines: Array<Partial<CartLine> & { menuItemId: string }>): CartLine[] {
  return lines.map((l) => ({
    lineId: l.lineId ?? nextLineId(l.menuItemId),
    menuItemId: l.menuItemId,
    name: l.name ?? '',
    unitPrice: l.unitPrice ?? 0,
    quantity: l.quantity ?? 1,
    ...(l.notes ? { notes: l.notes } : {}),
    ...(l.variantId ? { variantId: l.variantId } : {}),
    ...(l.modifiers?.length ? { modifiers: l.modifiers } : {}),
  }));
}

export const useCartStore = create<CartState>((set, get) => ({
  lines: [],

  addItem: (item) =>
    set((state) => {
      const key = optionsKey(item.variantId, item.modifiers);
      // Lines with a note stay separate so each note maps to its own kitchen line.
      const existing = state.lines.find(
        (l) =>
          l.menuItemId === item.id && !l.notes && optionsKey(l.variantId, l.modifiers) === key,
      );
      if (existing) {
        return {
          lines: state.lines.map((l) =>
            l.lineId === existing.lineId ? { ...l, quantity: l.quantity + 1 } : l,
          ),
        };
      }
      return {
        lines: [
          ...state.lines,
          {
            lineId: nextLineId(item.id),
            menuItemId: item.id,
            name: item.name,
            unitPrice: item.price,
            quantity: 1,
            ...(item.variantId ? { variantId: item.variantId } : {}),
            ...(item.modifiers?.length ? { modifiers: item.modifiers } : {}),
          },
        ],
      };
    }),

  removeItem: (lineId) =>
    set((state) => ({
      lines: state.lines.filter((l) => l.lineId !== lineId),
    })),

  updateQuantity: (lineId, quantity) =>
    set((state) => {
      if (quantity <= 0) {
        return { lines: state.lines.filter((l) => l.lineId !== lineId) };
      }
      return {
        lines: state.lines.map((l) => (l.lineId === lineId ? { ...l, quantity } : l)),
      };
    }),

  setLineNote: (lineId, notes) =>
    set((state) => {
      const trimmed = notes.trim().slice(0, CART_NOTE_MAX_LENGTH);
      return {
        lines: state.lines.map((l) => {
          if (l.lineId !== lineId) return l;
          if (trimmed) return { ...l, notes: trimmed };
          const next = { ...l };
          delete next.notes;
          return next;
        }),
      };
    }),

  clear: () => set({ lines: [] }),

  subtotal: () =>
    get().lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0),

  itemCount: () => get().lines.reduce((sum, line) => sum + line.quantity, 0),
}));

export function toOrderItems(lines: CartLine[]) {
  return lines.map((l) => ({
    menuItemId: l.menuItemId,
    quantity: l.quantity,
    ...(l.notes ? { notes: l.notes } : {}),
    ...(l.variantId ? { variantId: l.variantId } : {}),
    ...(l.modifiers?.length
      ? { modifiers: l.modifiers.map((m) => ({ modifierId: m.modifierId, name: m.name, price: m.price })) }
      : {}),
  }));
}

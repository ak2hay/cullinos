const PHOTOS_KEY = "cullinos.pos.showPhotos";
const ORDER_TYPE_KEY = "cullinos.pos.orderType";
const CHOICES_KEY = "cullinos.pos.itemChoices";

export type StoredOrderType = "takeaway" | "dine_in" | "delivery";

function tableKey(outletId: string): string {
  return `cullinos.pos.tableId.${outletId}`;
}

export function loadShowPhotos(): boolean {
  try {
    return localStorage.getItem(PHOTOS_KEY) !== "0";
  } catch {
    return true;
  }
}

export function saveShowPhotos(on: boolean): void {
  try {
    localStorage.setItem(PHOTOS_KEY, on ? "1" : "0");
  } catch {
    /* private mode */
  }
}

export function loadOrderType(): StoredOrderType | null {
  try {
    const raw = localStorage.getItem(ORDER_TYPE_KEY);
    if (raw === "takeaway" || raw === "dine_in" || raw === "delivery") return raw;
    return null;
  } catch {
    return null;
  }
}

export function saveOrderType(type: StoredOrderType): void {
  try {
    localStorage.setItem(ORDER_TYPE_KEY, type);
  } catch {
    /* private mode */
  }
}

export function loadTableId(outletId: string): string | null {
  try {
    return localStorage.getItem(tableKey(outletId));
  } catch {
    return null;
  }
}

export function saveTableId(outletId: string, tableId: string | null): void {
  try {
    const key = tableKey(outletId);
    if (tableId) localStorage.setItem(key, tableId);
    else localStorage.removeItem(key);
  } catch {
    /* private mode */
  }
}

export interface StoredChoice {
  variantId?: string;
  modifierIds: string[];
}

function readChoices(): Record<string, StoredChoice> {
  try {
    const raw = localStorage.getItem(CHOICES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Record<string, StoredChoice>;
  } catch {
    return {};
  }
}

export function loadItemChoice(itemId: string): StoredChoice | null {
  const choice = readChoices()[itemId];
  if (!choice || !Array.isArray(choice.modifierIds)) return null;
  return choice;
}

export function saveItemChoice(itemId: string, choice: StoredChoice): void {
  try {
    const all = readChoices();
    all[itemId] = choice;
    localStorage.setItem(CHOICES_KEY, JSON.stringify(all));
  } catch {
    /* private mode */
  }
}

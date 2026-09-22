export const CULLINOS_BRAND = {
  name: 'Cullinos',
  tagline: 'Restaurant Operating System',
  parent: 'Rkyves',
  poweredBy: 'Powered by Rkyves',
} as const;

export const API_VERSION = 'v1';
export const API_PREFIX = `/api/${API_VERSION}`;

/** Default API base URL for Vite apps (overridable via VITE_API_URL). */
export const DEFAULT_API_BASE = 'http://localhost:3000/api/v1';


export const DEFAULT_CURRENCY = 'INR';
export const DEFAULT_TIMEZONE = 'Asia/Kolkata';
export const DEFAULT_LANGUAGE = 'en';

/** Allowed inventory stock units (stored values). */
export const INVENTORY_UNITS = [
  'kg',
  'g',
  'L',
  'mL',
  'pieces',
  'bottles',
] as const;

export type InventoryUnit = (typeof INVENTORY_UNITS)[number];

export const INVENTORY_UNIT_LABELS: Record<InventoryUnit, string> = {
  kg: 'Kilograms (kg)',
  g: 'Grams (g)',
  L: 'Liters (L)',
  mL: 'Milliliters (mL)',
  pieces: 'Pieces',
  bottles: 'Bottles',
};

export const INVENTORY_UNIT_OPTIONS = INVENTORY_UNITS.map((value) => ({
  value,
  label: INVENTORY_UNIT_LABELS[value],
}));

export function isInventoryUnit(value: string): value is InventoryUnit {
  return (INVENTORY_UNITS as readonly string[]).includes(value);
}

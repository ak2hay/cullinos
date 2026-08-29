import { API_PREFIX, CULLINOS_BRAND } from '@cullinos/shared';
import type { ApiError } from '@cullinos/shared';

const API_BASE = import.meta.env.VITE_API_URL ?? API_PREFIX;

function getToken(): string | null {
  return import.meta.env.VITE_ORDER_TOKEN ?? null;
}

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

async function parseError(response: Response): Promise<ApiRequestError> {
  try {
    const body = (await response.json()) as ApiError;
    return new ApiRequestError(
      body.error?.message ?? 'Request failed',
      body.error?.code ?? 'UNKNOWN',
      response.status,
    );
  } catch {
    return new ApiRequestError(response.statusText || 'Request failed', 'UNKNOWN', response.status);
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');

  const token = getToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    throw await parseError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export interface MenuCategory {
  id: string;
  name: string;
  description?: string | null;
}

export interface MenuModifier {
  id: string;
  name: string;
  price: number;
}

export interface MenuModifierGroup {
  id: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  modifiers: MenuModifier[];
}

export interface MenuVariant {
  id: string;
  name: string;
  price: number;
}

export interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  isAvailable: boolean;
  categoryId: string | null;
  imageUrl?: string | null;
  variants?: MenuVariant[];
  modifierGroups?: MenuModifierGroup[];
}

export interface OutletMenu {
  outletId: string;
  categories: MenuCategory[];
  items: MenuItem[];
}

export interface OrderPayload {
  outletId: string;
  source: 'QR' | 'ONLINE';
  tableId?: string;
  notes?: string;
  items: Array<{
    menuItemId: string;
    variantId?: string;
    quantity: number;
    modifiers?: Array<{ name: string; price: number; modifierId?: string }>;
    notes?: string;
  }>;
}

export interface Order {
  id: string;
  orderNumber: string;
  status: string;
  subtotal: number;
}

export const menuApi = {
  getOutletMenu: (outletId: string) => apiRequest<OutletMenu>(`/menu/outlets/${outletId}`),
};

export const ordersApi = {
  create: (payload: OrderPayload) =>
    apiRequest<Order>('/orders', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  confirm: (orderId: string) =>
    apiRequest<Order>(`/orders/${orderId}/confirm`, { method: 'POST' }),
};

export const tablesApi = {
  list: (outletId: string) =>
    apiRequest<Array<{ id: string; name: string; qrCode: string | null }>>(
      `/tables/outlets/${outletId}`,
    ),
};

export { CULLINOS_BRAND };

export function formatPrice(paise: number): string {
  return `₹${(paise / 100).toFixed(0)}`;
}

export function hasApiAccess(): boolean {
  return Boolean(getToken());
}

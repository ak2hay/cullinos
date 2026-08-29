import {
  CULLINOS_BRAND,
  DEFAULT_API_BASE,
  mapStaffLoginResponse,
  type ApiStaffLoginResponse,
  type StaffAuthResponse,
} from '@cullinos/shared';
import type { ApiError, OrderStatus } from '@cullinos/shared';
import { useAuthStore } from '../stores/auth';

const API_BASE = import.meta.env.VITE_API_URL ?? DEFAULT_API_BASE;

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
  authenticated = true,
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');

  if (authenticated) {
    const token = useAuthStore.getState().accessToken;
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
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

export interface LoginPayload {
  email: string;
  password: string;
}

export interface AuthResponse extends StaffAuthResponse {}

export const authApi = {
  login: async (payload: LoginPayload) => {
    const raw = await apiRequest<ApiStaffLoginResponse>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify(payload) },
      false,
    );
    return mapStaffLoginResponse(raw);
  },
};

export interface Outlet {
  id: string;
  name: string;
  code: string | null;
  city: string | null;
  operatingMode?: string;
  isActive: boolean;
}

export interface MenuCategory {
  id: string;
  name: string;
  sortOrder: number;
}

export interface OutletMenuItem {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  price: number;
  isAvailable: boolean;
}

export interface Order {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  totalAmount: number;
}

export interface QuickOrderItem {
  menuItemId: string;
  quantity: number;
}

export const outletsApi = {
  list: () => apiRequest<Outlet[]>('/outlets'),
};

export const menuApi = {
  getOutletMenu: (outletId: string) =>
    apiRequest<{
      outletId: string;
      categories: MenuCategory[];
      items: OutletMenuItem[];
    }>(`/menu/outlets/${outletId}`),
};

export const posApi = {
  quickOrder: (
    payload: {
      outletId: string;
      items: QuickOrderItem[];
      autoConfirm?: boolean;
      type?: string;
      customerName?: string;
      tipAmount?: number;
      notes?: string;
    },
    idempotencyKey?: string,
  ) =>
    apiRequest<Order>(
      '/pos/quick-order',
      {
        method: 'POST',
        body: JSON.stringify({ ...payload, autoConfirm: payload.autoConfirm ?? true }),
        headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
      },
    ),

  holdOrder: (orderId: string) =>
    apiRequest<Order>(`/pos/orders/${orderId}/hold`, { method: 'POST' }),

  resumeOrder: (orderId: string) =>
    apiRequest<Order>(`/pos/orders/${orderId}/resume`, { method: 'POST' }),
};

export const ordersApi = {
  create: (
    payload: {
      outletId: string;
      source: 'POS';
      items: QuickOrderItem[];
    },
    idempotencyKey?: string,
  ) =>
    apiRequest<Order>(
      '/orders',
      {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
      },
    ),

  hold: (orderId: string) =>
    apiRequest<Order>(`/orders/${orderId}/hold`, { method: 'POST' }),

  resume: (orderId: string) =>
    apiRequest<Order>(`/orders/${orderId}/resume`, { method: 'POST' }),
};

export { CULLINOS_BRAND };

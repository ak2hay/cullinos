import {
  CULLINOS_BRAND,
  DEFAULT_API_BASE,
  mapStaffLoginResponse,
  type ApiStaffLoginResponse,
  type StaffAuthResponse,
} from '@cullinos/shared';
import type { ApiError, OrderStatus, PaginatedResponse } from '@cullinos/shared';
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

export interface Brand {
  id: string;
  name: string;
  code: string | null;
  isActive: boolean;
}

export interface Outlet {
  id: string;
  name: string;
  code: string | null;
  city: string | null;
  brandId: string | null;
  isActive: boolean;
}

export interface DailyDashboard {
  date: string;
  summary: {
    totalOrders: number;
    totalRevenue: number;
    averageOrderValue: number;
    openOrders: number;
    cancelledOrders: number;
  };
  hourlyBreakdown: Array<{ hour: number; orders: number; revenue: number }>;
  paymentBreakdown: Array<{ method: string; count: number; amount: number }>;
}

export interface OutletComparison {
  outletId: string;
  outletName: string;
  revenue: number;
  orders: number;
  averageOrderValue: number;
}

export interface InventoryItem {
  id: string;
  name: string;
  sku: string | null;
  unit: string;
  currentStock: number;
}

export interface StockTransferPayload {
  fromOutletId: string;
  toOutletId: string;
  inventoryItemId: string;
  quantity: number;
  notes?: string;
}

export interface Franchisee {
  id: string;
  name: string;
  contactEmail: string | null;
  contactPhone: string | null;
  status: string;
  outletCount: number;
  agreementCount: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  totalAmount: number;
  createdAt: string;
  outletId: string;
}

export const brandsApi = {
  list: () => apiRequest<Brand[]>('/brands'),
};

export const outletsApi = {
  list: (brandId?: string) => {
    const qs = brandId ? `?brandId=${brandId}` : '';
    return apiRequest<Outlet[]>(`/outlets${qs}`);
  },
};

export const analyticsApi = {
  daily: (params?: { date?: string; outletId?: string }) => {
    const search = new URLSearchParams();
    if (params?.date) search.set('date', params.date);
    if (params?.outletId) search.set('outletId', params.outletId);
    const qs = search.toString();
    return apiRequest<DailyDashboard>(`/analytics/daily${qs ? `?${qs}` : ''}`);
  },
  outletComparison: (params?: { date?: string; brandId?: string }) => {
    const search = new URLSearchParams();
    if (params?.date) search.set('date', params.date);
    if (params?.brandId) search.set('brandId', params.brandId);
    const qs = search.toString();
    return apiRequest<OutletComparison[]>(`/analytics/outlet-comparison${qs ? `?${qs}` : ''}`);
  },
};

export const inventoryApi = {
  listItems: () => apiRequest<InventoryItem[]>('/inventory/items'),
  transfer: (payload: StockTransferPayload) =>
    apiRequest<{ id: string }>('/inventory/transfers', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

export const franchiseApi = {
  listFranchisees: () => apiRequest<Franchisee[]>('/franchise/franchisees'),
};

export const ordersApi = {
  list: (params?: { outletId?: string; limit?: number }) => {
    const search = new URLSearchParams();
    if (params?.outletId) search.set('outletId', params.outletId);
    if (params?.limit) search.set('limit', String(params.limit));
    const qs = search.toString();
    return apiRequest<PaginatedResponse<Order>>(`/orders${qs ? `?${qs}` : ''}`);
  },
};

export { CULLINOS_BRAND };

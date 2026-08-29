import { CULLINOS_BRAND } from '@cullinos/shared';
import type { ApiError, OrderStatus, PaginatedResponse } from '@cullinos/shared';
import { useAuthStore } from '../stores/auth';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

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

export interface RegisterPayload {
  organizationName: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: import('../stores/auth').AuthUser;
  permissions: string[];
}

export interface Outlet {
  id: string;
  name: string;
  code: string | null;
  city: string | null;
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

export interface MenuCategory {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  parentId: string | null;
}

export interface MenuItem {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  basePrice: number;
  isAvailable: boolean;
  sortOrder: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  source: string;
  totalAmount: number;
  subtotal: number;
  createdAt: string;
  outletId: string;
  tableId: string | null;
}

export interface OrganizationSettings {
  settings: Record<string, unknown>;
}

export const authApi = {
  login: (payload: LoginPayload) =>
    apiRequest<AuthResponse>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify(payload) },
      false,
    ),

  register: (payload: RegisterPayload) =>
    apiRequest<AuthResponse>(
      '/auth/register',
      { method: 'POST', body: JSON.stringify(payload) },
      false,
    ),

  logout: (refreshToken: string) =>
    apiRequest<{ success: boolean }>('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }),
};

export const outletsApi = {
  list: () => apiRequest<Outlet[]>('/outlets'),
};

export const analyticsApi = {
  daily: (params?: { date?: string; outletId?: string }) => {
    const search = new URLSearchParams();
    if (params?.date) search.set('date', params.date);
    if (params?.outletId) search.set('outletId', params.outletId);
    const qs = search.toString();
    return apiRequest<DailyDashboard>(`/analytics/daily${qs ? `?${qs}` : ''}`);
  },
};

export const menuApi = {
  listCategories: () => apiRequest<MenuCategory[]>('/menu/categories'),
  createCategory: (payload: { name: string; description?: string; sortOrder?: number }) =>
    apiRequest<MenuCategory>('/menu/categories', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateCategory: (id: string, payload: Partial<{ name: string; description: string; isActive: boolean }>) =>
    apiRequest<MenuCategory>(`/menu/categories/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteCategory: (id: string) =>
    apiRequest<void>(`/menu/categories/${id}`, { method: 'DELETE' }),

  listItems: () => apiRequest<MenuItem[]>('/menu/items'),
  createItem: (payload: {
    categoryId: string;
    name: string;
    description?: string;
    basePrice: number;
  }) =>
    apiRequest<MenuItem>('/menu/items', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateItem: (
    id: string,
    payload: Partial<{ name: string; description: string; basePrice: number; isAvailable: boolean }>,
  ) =>
    apiRequest<MenuItem>(`/menu/items/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteItem: (id: string) => apiRequest<void>(`/menu/items/${id}`, { method: 'DELETE' }),

  getOutletMenu: (outletId: string) =>
    apiRequest<{
      outletId: string;
      categories: MenuCategory[];
      items: Array<MenuItem & { price: number }>;
    }>(`/menu/outlets/${outletId}`),
};

export const ordersApi = {
  list: (params?: { outletId?: string; status?: OrderStatus; limit?: number }) => {
    const search = new URLSearchParams();
    if (params?.outletId) search.set('outletId', params.outletId);
    if (params?.status) search.set('status', params.status);
    if (params?.limit) search.set('limit', String(params.limit));
    const qs = search.toString();
    return apiRequest<PaginatedResponse<Order>>(`/orders${qs ? `?${qs}` : ''}`);
  },
  get: (id: string) => apiRequest<Order>(`/orders/${id}`),
};

export const settingsApi = {
  get: () => apiRequest<OrganizationSettings>('/organizations/settings'),
  update: (settings: Record<string, unknown>) =>
    apiRequest<OrganizationSettings>('/organizations/settings', {
      method: 'PATCH',
      body: JSON.stringify({ settings }),
    }),
};

export { CULLINOS_BRAND };

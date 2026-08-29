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

export interface RegisterPayload {
  organizationName: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

export interface AuthResponse extends StaffAuthResponse {}
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
  login: async (payload: LoginPayload) => {
    const raw = await apiRequest<ApiStaffLoginResponse>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify(payload) },
      false,
    );
    return mapStaffLoginResponse(raw);
  },

  logout: (refreshToken: string) =>
    apiRequest<{ success: boolean }>('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }),
};

export const outletsApi = {  list: () => apiRequest<Outlet[]>('/outlets'),
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
  update: async (data: Record<string, unknown>) => {
    const { businessType, name, gstin, operatingMode, enabledOrderTypes, sampleCategories, ...rest } = data;
    if (businessType || name || gstin) {
      await apiRequest('/organizations/current', {
        method: 'PATCH',
        body: JSON.stringify({ businessType, name, gstin }),
      });
    }
    const settings = {
      ...(operatingMode ? { operatingMode } : {}),
      ...(enabledOrderTypes ? { enabledOrderTypes } : {}),
      ...(sampleCategories ? { sampleCategories } : {}),
      ...rest,
    };
    return apiRequest<OrganizationSettings>('/organizations/settings', {
      method: 'PATCH',
      body: JSON.stringify({ settings }),
    });
  },
};

export const eventsApi = {
  list: (outletId?: string) => {
    const qs = outletId ? `?outletId=${outletId}` : '';
    return apiRequest<Array<Record<string, unknown>>>(`/events${qs}`);
  },
  create: (payload: Record<string, unknown>) =>
    apiRequest('/events', { method: 'POST', body: JSON.stringify(payload) }),
  update: (id: string, payload: Record<string, unknown>) =>
    apiRequest(`/events/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  delete: (id: string) => apiRequest(`/events/${id}`, { method: 'DELETE' }),
};

export const productionApi = {
  list: (outletId?: string) => {
    const qs = outletId ? `?outletId=${outletId}` : '';
    return apiRequest<Array<Record<string, unknown>>>(`/production${qs}`);
  },
  create: (payload: Record<string, unknown>) =>
    apiRequest('/production', { method: 'POST', body: JSON.stringify(payload) }),
  complete: (id: string, actualQty?: number) =>
    apiRequest(`/production/${id}/complete`, {
      method: 'POST',
      body: JSON.stringify({ actualQty }),
    }),
  scaleRecipe: (recipeId: string, factor: number) =>
    apiRequest(`/production/recipes/${recipeId}/scale?factor=${factor}`),
};

export const loyaltyApi = {
  listTiers: () => apiRequest<Array<Record<string, unknown>>>('/loyalty'),
  addStamp: (customerId: string) =>
    apiRequest(`/loyalty/customers/${customerId}/stamp`, { method: 'POST' }),
};

export const couponsApi = {
  list: () => apiRequest<Array<Record<string, unknown>>>('/coupons'),
  create: (payload: Record<string, unknown>) =>
    apiRequest('/coupons', { method: 'POST', body: JSON.stringify(payload) }),
};

export const reportsApi = {
  smbSummary: (params?: { outletId?: string; date?: string }) => {
    const search = new URLSearchParams();
    if (params?.outletId) search.set('outletId', params.outletId);
    if (params?.date) search.set('date', params.date);
    const qs = search.toString();
    return apiRequest<Record<string, unknown>>(`/reports/smb-summary${qs ? `?${qs}` : ''}`);
  },
};

export interface StaffUser {
  id: string;
  email: string;
  name: string;
  status: string;
  roles: Array<{ id: string; slug: string; name: string }>;
  outlets: Array<{ id: string; name: string }>;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface Role {
  id: string;
  slug: string;
  name: string;
  isSystem: boolean;
}

export const usersApi = {
  list: () => apiRequest<StaffUser[]>('/users'),
  create: (payload: {
    email: string;
    password: string;
    name: string;
    roleSlug: string;
    outletIds?: string[];
  }) =>
    apiRequest<StaffUser>('/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  deactivate: (id: string) =>
    apiRequest(`/users/${id}/deactivate`, { method: 'PATCH' }),
};

export const rolesApi = {
  list: () => apiRequest<Role[]>('/roles'),
};

export { CULLINOS_BRAND };

import {
  DEFAULT_API_BASE,
  mapStaffLoginResponse,
  type ApiStaffLoginResponse,
  type StaffAuthResponse,
} from '@cullinos/shared';
import { CULLINOS_BRAND } from '@cullinos/shared';
import type { ApiError } from '@cullinos/shared';
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
  isActive: boolean;
}

export interface Table {
  id: string;
  outletId: string;
  sectionId: string | null;
  name: string;
  capacity: number;
  status: string;
  qrCode: string | null;
  section?: { id: string; name: string } | null;
}

export interface OrderItemModifier {
  name: string;
  price: number;
  modifierId?: string;
}

export interface OrderItem {
  menuItemId: string;
  variantId?: string;
  quantity: number;
  modifiers?: OrderItemModifier[];
  notes?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  status: string;
  tableId: string | null;
  outletId: string;
  subtotal: number;
  items?: Array<{
    id: string;
    name: string;
    quantity: number;
    unitPrice: number;
    notes: string | null;
  }>;
}

export interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  isAvailable: boolean;
  categoryId: string | null;
  variants?: Array<{ id: string; name: string; price: number }>;
  modifierGroups?: Array<{
    id: string;
    name: string;
    minSelect: number;
    maxSelect: number;
    modifiers: Array<{ id: string; name: string; price: number }>;
  }>;
}

export interface OutletMenu {
  outletId: string;
  categories: Array<{ id: string; name: string }>;
  items: MenuItem[];
}

export interface PaginatedOrders {
  data: Order[];
  meta: { total: number; page: number; limit: number };
}

export const outletsApi = {
  list: () => apiRequest<Outlet[]>('/outlets'),
};

export const tablesApi = {
  list: (outletId: string) => apiRequest<Table[]>(`/tables/outlets/${outletId}`),

  updateStatus: (outletId: string, tableId: string, status: string) =>
    apiRequest<Table>(`/tables/outlets/${outletId}/${tableId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
};

export const ordersApi = {
  list: (params: { outletId?: string; tableId?: string; status?: string }) => {
    const search = new URLSearchParams();
    if (params.outletId) search.set('outletId', params.outletId);
    if (params.tableId) search.set('tableId', params.tableId);
    if (params.status) search.set('status', params.status);
    const q = search.toString();
    return apiRequest<PaginatedOrders>(`/orders${q ? `?${q}` : ''}`);
  },

  get: (id: string) => apiRequest<Order>(`/orders/${id}`),

  create: (payload: {
    outletId: string;
    source: 'WAITER';
    tableId?: string;
    items?: OrderItem[];
  }) =>
    apiRequest<Order>('/orders', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  addItems: (orderId: string, items: OrderItem[]) =>
    apiRequest<Order>(`/orders/${orderId}/items`, {
      method: 'POST',
      body: JSON.stringify({ items }),
    }),

  confirm: (orderId: string) =>
    apiRequest<Order>(`/orders/${orderId}/confirm`, { method: 'POST' }),
};

export const menuApi = {
  getOutletMenu: (outletId: string) => apiRequest<OutletMenu>(`/menu/outlets/${outletId}`),
};

export const posApi = {
  quickOrder: (payload: {
    outletId: string;
    tableId?: string;
    items: OrderItem[];
    autoConfirm?: boolean;
  }) =>
    apiRequest<Order>('/pos/quick-order', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

export { CULLINOS_BRAND };

export const TABLE_STATUS_COLORS: Record<string, string> = {
  AVAILABLE: 'bg-table-available',
  OCCUPIED: 'bg-table-occupied',
  RESERVED: 'bg-table-reserved',
  CLEANING: 'bg-table-cleaning',
  BILLING: 'bg-table-billing',
};

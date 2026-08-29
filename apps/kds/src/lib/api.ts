import { API_PREFIX, CULLINOS_BRAND } from '@cullinos/shared';
import type { ApiError } from '@cullinos/shared';
import { useAuthStore } from '../stores/auth';

const API_BASE = import.meta.env.VITE_API_URL ?? API_PREFIX;

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

export interface KitchenStation {
  id: string;
  name: string;
  code: string | null;
  isActive: boolean;
}

export interface KotItem {
  id: string;
  kotId: string;
  kitchenStationId: string | null;
  name: string;
  quantity: number;
  status: 'NEW' | 'PREPARING' | 'READY' | 'SERVED';
  notes: string | null;
  startedAt: string | null;
  readyAt: string | null;
  createdAt: string;
  kitchenStation?: KitchenStation | null;
}

export interface Kot {
  id: string;
  orderId: string;
  kotNumber: string;
  status: 'NEW' | 'PREPARING' | 'READY' | 'SERVED';
  priority: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  items: KotItem[];
  order: {
    orderNumber: string;
    tableId: string | null;
    orderType: string;
    table: { name: string } | null;
  };
}

export interface KitchenDisplayData {
  outletId: string;
  stations: Array<{
    station: KitchenStation;
    kots: Kot[];
  }>;
  allKots: Kot[];
}

export type KotItemStatus = 'PREPARING' | 'READY' | 'SERVED';

export const authApi = {
  login: (payload: LoginPayload) =>
    apiRequest<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, false),
};

export const outletsApi = {
  list: () => apiRequest<Outlet[]>('/outlets'),
};

export const kitchenApi = {
  getDisplay: (outletId: string, stationId?: string) => {
    const query = stationId ? `?stationId=${stationId}` : '';
    return apiRequest<KitchenDisplayData>(`/kitchen/outlets/${outletId}/display${query}`);
  },

  updateItemStatus: (itemId: string, status: KotItemStatus) =>
    apiRequest<KotItem>(`/kitchen/items/${itemId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
};

export { CULLINOS_BRAND };

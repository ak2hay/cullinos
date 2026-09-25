import {
  CULLINOS_BRAND,
  mapStaffLoginResponse,
  resolveViteApiBase,
  type ApiStaffLoginResponse,
  type StaffAuthResponse,
} from '@cullinos/shared';
import type { ApiError } from '@cullinos/shared';
import { useAuthStore } from '../stores/auth';
import { usePortalStore } from '../stores/portal';

export const PORTAL_ID = 'kds';

const API_BASE = resolveViteApiBase({
  viteApiUrl: import.meta.env.VITE_API_URL,
  isProd: import.meta.env.PROD,
});

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

function handleUnauthorized() {
  const { accessToken, logout } = useAuthStore.getState();
  if (!accessToken) return;
  logout();
  const search = typeof window !== 'undefined' ? window.location.search : '';
  const next = search ? `/login${search}` : '/login';
  if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
    window.location.assign(next);
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  authenticated = true,
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  headers.set('X-Cullinos-Portal', PORTAL_ID);

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

  if (response.status === 401 && authenticated) {
    handleUnauthorized();
    throw new ApiRequestError('Session expired — please sign in again', 'UNAUTHORIZED', 401);
  }

  if (!response.ok) {
    const err = await parseError(response);
    if (err.status === 503 && err.code === 'PORTAL_DISABLED') {
      usePortalStore.getState().setDisabled(err.message);
      useAuthStore.getState().logout();
    }
    if (err.status === 503 && err.code === 'PORTAL_MAINTENANCE') {
      usePortalStore.getState().setMaintenance(err.message);
      useAuthStore.getState().logout();
    }
    throw err;
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export interface LoginPayload {
  email: string;
  password: string;
  captchaToken?: string;
}

export interface AuthResponse extends StaffAuthResponse {}

export interface PortalEntryStatus {
  enabled: boolean;
  maintenanceMessage: string | null;
}

export interface PortalStatusResponse {
  portals: Record<string, PortalEntryStatus>;
  message: string;
}

export const portalApi = {
  status: () => apiRequest<PortalStatusResponse>('/public/portal-status', {}, false),
};

export type LoginChallengeResponse = {
  requiresOtp: true;
  challengeToken: string;
};

export const authApi = {
  login: async (payload: LoginPayload) => {
    const raw = await apiRequest<ApiStaffLoginResponse | LoginChallengeResponse>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify(payload) },
      false,
    );
    if ('requiresOtp' in raw && raw.requiresOtp) {
      return raw;
    }
    return mapStaffLoginResponse(raw as ApiStaffLoginResponse);
  },

  verifyOtp: async (payload: { challengeToken: string; otp: string }) => {
    const raw = await apiRequest<ApiStaffLoginResponse>(
      '/auth/verify-otp',
      { method: 'POST', body: JSON.stringify(payload) },
      false,
    );
    return mapStaffLoginResponse(raw);
  },

  resendOtp: (payload: { challengeToken: string }) =>
    apiRequest<LoginChallengeResponse>(
      '/auth/resend-otp',
      { method: 'POST', body: JSON.stringify(payload) },
      false,
    ),
};

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

export const outletsApi = {
  list: () => apiRequest<Outlet[]>('/outlets'),
};

export const kitchenApi = {
  getDisplay: (outletId: string, stationId?: string) => {
    const query = stationId ? `?stationId=${encodeURIComponent(stationId)}` : '';
    return apiRequest<KitchenDisplayData>(`/kitchen/outlets/${outletId}/display${query}`);
  },

  updateItemStatus: (itemId: string, status: KotItemStatus) =>
    apiRequest<KotItem>(`/kitchen/items/${itemId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
};

export { CULLINOS_BRAND };

import type { ApiError } from '@cullinos/shared';
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

export interface LoginResponse {
  accessToken: string;
  admin: { id: string; email: string; name: string };
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  email: string | null;
  isActive: boolean;
  plan: string | null;
  subscriptionStatus: string | null;
  outletCount: number;
  userCount: number;
  createdAt: string;
}

export interface TenantListResponse {
  data: Tenant[];
  meta: { total: number; page: number; limit: number; hasMore: boolean };
}

export interface SystemHealth {
  status: string;
  timestamp: string;
  database: string;
  metrics: {
    totalOrganizations: number;
    activeOrganizations: number;
    ordersToday: number;
    pendingSyncEvents: number;
    failedNotifications: number;
  };
}

export interface ManageSubscriptionPayload {
  planId: string;
  status: string;
}

export const superAdminApi = {
  login: (payload: LoginPayload) =>
    apiRequest<LoginResponse>(
      '/super-admin/login',
      { method: 'POST', body: JSON.stringify(payload) },
      false,
    ),

  listOrganizations: (page = 1, limit = 20) =>
    apiRequest<TenantListResponse>(`/super-admin/organizations?page=${page}&limit=${limit}`),

  suspendOrganization: (id: string, reason: string) =>
    apiRequest(`/super-admin/organizations/${id}/suspend`, {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    }),

  activateOrganization: (id: string) =>
    apiRequest(`/super-admin/organizations/${id}/activate`, { method: 'PATCH' }),

  manageSubscription: (id: string, payload: ManageSubscriptionPayload) =>
    apiRequest(`/super-admin/organizations/${id}/subscription`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  health: () => apiRequest<SystemHealth>('/super-admin/health'),
};

export const RKYVES_BRAND = {
  name: 'Rkyves',
  product: 'Cullinos',
  tagline: 'Platform administration',
} as const;

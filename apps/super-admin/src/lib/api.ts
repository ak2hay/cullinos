import { DEFAULT_API_BASE } from '@cullinos/shared';
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
    const body = (await response.json()) as ApiError & {
      message?: string | string[];
      statusCode?: number;
      error?: string | ApiError['error'];
    };

    if (body.error && typeof body.error === 'object' && body.error.message) {
      return new ApiRequestError(body.error.message, body.error.code ?? 'UNKNOWN', response.status);
    }

    if (body.message) {
      const message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
      const code = typeof body.error === 'string' ? body.error : 'HTTP_ERROR';
      return new ApiRequestError(message, code, response.status);
    }

    return new ApiRequestError('Request failed', 'UNKNOWN', response.status);
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
  planId?: string;
  planSlug?: string;
  status: string;
}

export interface PlanSummary {
  id: string;
  slug: string;
  name: string;
  priceMonthly: number;
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

  listPlans: () => apiRequest<PlanSummary[]>('/super-admin/plans'),

  onboardRestaurant: (payload: {
    companyName: string;
    planSlug: string;
    ownerEmail: string;
    ownerPassword: string;
    ownerName?: string;
    outletName?: string;
  }) =>
    apiRequest<{
      organizationId: string;
      organizationSlug: string;
      ownerEmail: string;
      adminUrl: string;
    }>('/super-admin/organizations', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  health: () => apiRequest<SystemHealth>('/super-admin/health'),
};

export const RKYVES_BRAND = {
  name: 'Rkyves',
  product: 'Cullinos',
  tagline: 'Platform administration',
} as const;

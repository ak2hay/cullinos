import { resolveViteApiBase } from '@cullinos/shared';
import type { ApiError } from '@cullinos/shared';
import { useAuthStore } from '../stores/auth';
import { usePortalStore } from '../stores/portal';

export const PORTAL_ID = 'app_ops';

export const API_BASE = resolveViteApiBase({
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
  headers.set('X-Cullinos-Portal', PORTAL_ID);
  if (!(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

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

export interface LoginPayload {
  email: string;
  password: string;
  captchaToken?: string;
}

export type LoginChallengeResponse = {
  requiresOtp: true;
  challengeToken: string;
};

export type LoginSuccessResponse = {
  accessToken: string;
  admin: { id: string; email: string; name: string };
};

export type LoginResponse = LoginChallengeResponse | LoginSuccessResponse;

export const superAdminApi = {
  login: (payload: LoginPayload) =>
    apiRequest<LoginResponse>(
      '/super-admin/login',
      { method: 'POST', body: JSON.stringify(payload) },
      false,
    ),

  verifyOtp: (payload: { challengeToken: string; otp: string }) =>
    apiRequest<LoginSuccessResponse>(
      '/super-admin/verify-otp',
      { method: 'POST', body: JSON.stringify(payload) },
      false,
    ),

  resendOtp: (payload: { challengeToken: string }) =>
    apiRequest<LoginChallengeResponse>(
      '/super-admin/resend-otp',
      { method: 'POST', body: JSON.stringify({ challengeToken: payload.challengeToken }) },
      false,
    ),

  forgotPassword: (payload: { email: string }) =>
    apiRequest<{ ok: boolean }>(
      '/auth/forgot-password',
      { method: 'POST', body: JSON.stringify(payload) },
      false,
    ),

  resetPassword: (payload: { email: string; otp: string; newPassword: string }) =>
    apiRequest<{ success: boolean }>(
      '/auth/reset-password',
      { method: 'POST', body: JSON.stringify(payload) },
      false,
    ),

  listOrganizations: (page = 1, limit = 20) =>
    apiRequest<{
      data: Array<{ id: string; name: string; slug: string }>;
      total: number;
    }>(`/super-admin/organizations?page=${page}&limit=${limit}`),

  listGuestCoupons: () =>
    apiRequest<GuestCouponOversightRow[]>('/super-admin/guest-marketing/coupons'),

  createGuestCoupon: (payload: Record<string, unknown>) =>
    apiRequest<GuestCouponOversightRow>('/super-admin/guest-marketing/coupons', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateGuestCoupon: (id: string, payload: Record<string, unknown>) =>
    apiRequest<GuestCouponOversightRow>(`/super-admin/guest-marketing/coupons/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  deactivateGuestCoupon: (id: string) =>
    apiRequest<GuestCouponOversightRow>(
      `/super-admin/guest-marketing/coupons/${id}/deactivate`,
      { method: 'POST', body: JSON.stringify({}) },
    ),

  deleteGuestCoupon: (id: string) =>
    apiRequest<{ success: boolean }>(`/super-admin/guest-marketing/coupons/${id}`, {
      method: 'DELETE',
    }),
};

export interface GuestCouponOversightRow {
  id: string;
  code: string;
  title?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  type: string;
  value: number | string;
  minOrder?: number | string | null;
  maxUses?: number | null;
  usedCount?: number;
  startsAt?: string | null;
  expiresAt?: string | null;
  isActive: boolean;
  marketplaceFeatured?: boolean;
  organizationId: string;
  organization?: { id: string; name: string; slug: string } | null;
}

export interface GuestOpsOverview {
  listedOutlets: number;
  pendingModeration: number;
  reviews: { visible: number; hidden: number };
  campaigns: { draft: number; scheduled: number };
  maintenanceOn: boolean;
  maintenanceMessage: string | null;
  guestUsers: number;
}

export interface GuestOpsAnalytics {
  listedByCity: Array<{ city: string; count: number }>;
  reviewVolume: Array<{ status: string; count: number }>;
  campaignsLast30d: { count: number; sentCount: number; failedCount: number };
  guestUsers: { total: number; active: number; newLast30d: number };
  featuredOutlets: number;
}

export interface GuestOpsRuntime {
  minVersionCode: number;
  forceUpdate: boolean;
  softUpdateMessage: string | null;
  maintenanceMessage: string | null;
  playStoreUrl: string | null;
  supportUrl: string | null;
  privacyUrl: string | null;
  termsUrl: string | null;
  featureFlags: Record<string, unknown>;
  phoneMenuQrEnabled: boolean;
  fcmConfigured: boolean;
  platformDefaultGuestThemeKey?: string;
  guestThemePresets?: Array<{
    key: string;
    label: string;
    description: string;
    primary: string;
    soft: string;
    deep: string;
    bright: string;
  }>;
}

export interface GuestOpsOutletRow {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  address: string | null;
  status: string;
  marketplaceListed: boolean;
  marketplaceFeatured: boolean;
  marketplaceFeaturedRank: number | null;
  marketplaceModerationStatus: string | null;
  marketplaceUnlistedByPlatform: boolean;
  cuisineTags: string[];
  coverImageUrl: string | null;
  averagePrepMinutes: number | null;
  latitude: number | null;
  longitude: number | null;
  organization: { id: string; name: string; slug: string };
  brand?: { id: string; name: string } | null;
}

export interface GuestBannerRow {
  id: string;
  scope: string;
  organizationId?: string | null;
  title: string;
  subtitle?: string | null;
  imageUrl?: string | null;
  linkType: string;
  linkPayload?: Record<string, unknown>;
  sortOrder: number;
  startsAt?: string | null;
  endsAt?: string | null;
  isActive: boolean;
}

export interface GuestOpsBannerRow extends GuestBannerRow {
  organization?: { id: string; name: string; slug: string } | null;
}

export type StylePreset = 'offer' | 'alert' | 'promo' | 'custom';

export interface PushCreative {
  titleColor?: string;
  bodyColor?: string;
  bgColor?: string;
  accentColor?: string;
  fontFamily?: string;
  ctaLabel?: string;
  headlineSize?: number;
}

export interface GuestOpsPushCampaignRow {
  id: string;
  title: string;
  body: string;
  audience: string;
  audienceFilter?: Record<string, unknown>;
  deepLink?: string | null;
  imageUrl?: string | null;
  stylePreset?: string | null;
  creative?: PushCreative | Record<string, unknown> | null;
  scope: string;
  organizationId?: string | null;
  organization?: { id: string; name: string; slug: string } | null;
  status: string;
  sentCount: number;
  failedCount?: number;
  sentAt?: string | null;
  scheduledAt?: string | null;
  createdAt: string;
}

export interface GuestOpsDiscoverSection {
  id: string;
  title: string;
  subtitle: string | null;
  type: string;
  payload: Record<string, unknown>;
  sortOrder: number;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  createdAt?: string;
}

export interface GuestOpsReviewRow {
  id: string;
  rating: number;
  comment: string | null;
  status: string;
  createdAt: string;
  moderatedAt?: string | null;
  moderationNote?: string | null;
  outlet: { id: string; name: string; city: string | null; organizationId: string };
  guestUser: { id: string; name: string | null; phone: string | null; email: string | null } | null;
}

export interface GuestOpsUserSearchRow {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  createdAt: string;
  suspendedAt?: string | null;
  suspendReason?: string | null;
  counts: { memberships: number; devices: number; reviews: number };
}

function guestOpsQuery(params: Record<string, string | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') sp.set(k, v);
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : '';
}

export const guestOpsApi = {
  overview: () => apiRequest<GuestOpsOverview>('/super-admin/guest-ops/overview'),

  analytics: () => apiRequest<GuestOpsAnalytics>('/super-admin/guest-ops/analytics'),

  runtime: () => apiRequest<GuestOpsRuntime>('/super-admin/guest-ops/runtime'),

  updateRuntime: (values: Record<string, string | null | undefined>) =>
    apiRequest<unknown>('/super-admin/guest-ops/runtime', {
      method: 'PUT',
      body: JSON.stringify(values),
    }),

  listOutlets: (params?: {
    q?: string;
    listed?: string;
    featured?: string;
    moderationStatus?: string;
    city?: string;
    limit?: string;
    offset?: string;
  }) =>
    apiRequest<{ total: number; limit: number; offset: number; items: GuestOpsOutletRow[] }>(
      `/super-admin/guest-ops/outlets${guestOpsQuery(params ?? {})}`,
    ),

  updateOutlet: (
    id: string,
    body: {
      marketplaceListed?: boolean;
      marketplaceFeatured?: boolean;
      marketplaceFeaturedRank?: number | null;
      marketplaceModerationStatus?: string;
      marketplaceUnlistedByPlatform?: boolean;
    },
  ) =>
    apiRequest<GuestOpsOutletRow>(`/super-admin/guest-ops/outlets/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  listBanners: (scope?: 'platform' | 'organization' | 'all') =>
    apiRequest<GuestOpsBannerRow[]>(
      `/super-admin/guest-ops/banners${guestOpsQuery({ scope })}`,
    ),

  createBanner: (payload: Record<string, unknown>) =>
    apiRequest<GuestOpsBannerRow>('/super-admin/guest-ops/banners', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateBanner: (id: string, payload: Record<string, unknown>) =>
    apiRequest<GuestOpsBannerRow>(`/super-admin/guest-ops/banners/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  deleteBanner: (id: string) =>
    apiRequest<{ success: boolean }>(`/super-admin/guest-ops/banners/${id}`, {
      method: 'DELETE',
    }),

  listPushCampaigns: (params?: { status?: string; limit?: string }) =>
    apiRequest<GuestOpsPushCampaignRow[]>(
      `/super-admin/guest-ops/push-campaigns${guestOpsQuery(params ?? {})}`,
    ),

  createPushDraft: (payload: Record<string, unknown>) =>
    apiRequest<GuestOpsPushCampaignRow>('/super-admin/guest-ops/push-campaigns', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updatePushCampaign: (id: string, payload: Record<string, unknown>) =>
    apiRequest<GuestOpsPushCampaignRow>(`/super-admin/guest-ops/push-campaigns/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  schedulePush: (id: string, scheduledAt?: string) =>
    apiRequest<GuestOpsPushCampaignRow>(
      `/super-admin/guest-ops/push-campaigns/${id}/schedule`,
      { method: 'POST', body: JSON.stringify({ scheduledAt }) },
    ),

  cancelPush: (id: string) =>
    apiRequest<GuestOpsPushCampaignRow>(
      `/super-admin/guest-ops/push-campaigns/${id}/cancel`,
      { method: 'POST', body: JSON.stringify({}) },
    ),

  deletePushCampaign: (id: string) =>
    apiRequest<{ success: boolean }>(`/super-admin/guest-ops/push-campaigns/${id}`, {
      method: 'DELETE',
    }),

  sendPushCampaign: (id: string) =>
    apiRequest<GuestOpsPushCampaignRow>(
      `/super-admin/guest-ops/push-campaigns/${id}/send`,
      { method: 'POST', body: JSON.stringify({}) },
    ),

  uploadPushImage: async (file: File): Promise<string> => {
    const form = new FormData();
    form.append('file', file);
    const result = await apiRequest<{ imageUrl: string }>(
      '/super-admin/guest-ops/push-campaigns/upload-image',
      { method: 'POST', body: form },
    );
    return result.imageUrl;
  },

  listDiscoverSections: () =>
    apiRequest<GuestOpsDiscoverSection[]>('/super-admin/guest-ops/discover-sections'),

  createDiscoverSection: (payload: Record<string, unknown>) =>
    apiRequest<GuestOpsDiscoverSection>('/super-admin/guest-ops/discover-sections', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateDiscoverSection: (id: string, payload: Record<string, unknown>) =>
    apiRequest<GuestOpsDiscoverSection>(
      `/super-admin/guest-ops/discover-sections/${id}`,
      { method: 'PATCH', body: JSON.stringify(payload) },
    ),

  deleteDiscoverSection: (id: string) =>
    apiRequest<{ success: boolean }>(`/super-admin/guest-ops/discover-sections/${id}`, {
      method: 'DELETE',
    }),

  listReviews: (params?: { status?: string; outletId?: string; q?: string; limit?: string }) =>
    apiRequest<GuestOpsReviewRow[]>(
      `/super-admin/guest-ops/reviews${guestOpsQuery(params ?? {})}`,
    ),

  moderateReview: (
    id: string,
    body: { status: 'hidden' | 'removed' | 'visible'; note?: string },
  ) =>
    apiRequest<GuestOpsReviewRow>(`/super-admin/guest-ops/reviews/${id}/moderate`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  searchUsers: (params?: { q?: string; limit?: string }) =>
    apiRequest<GuestOpsUserSearchRow[]>(
      `/super-admin/guest-ops/users${guestOpsQuery(params ?? {})}`,
    ),

  getUser: (id: string) => apiRequest<Record<string, unknown>>(`/super-admin/guest-ops/users/${id}`),

  getUserActivity: (id: string) =>
    apiRequest<Record<string, unknown>>(`/super-admin/guest-ops/users/${id}/activity`),

  exportUser: (id: string) =>
    apiRequest<Record<string, unknown>>(`/super-admin/guest-ops/users/${id}/export`),

  eraseUser: (id: string) =>
    apiRequest<{ success: boolean }>(`/super-admin/guest-ops/users/${id}/erase`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),

  suspendUser: (id: string, reason?: string) =>
    apiRequest<{ id: string; suspendedAt: string | null; message: string }>(
      `/super-admin/guest-ops/users/${id}/suspend`,
      {
        method: 'POST',
        body: JSON.stringify({ reason }),
      },
    ),

  unsuspendUser: (id: string) =>
    apiRequest<{ id: string; suspendedAt: null; message: string }>(
      `/super-admin/guest-ops/users/${id}/unsuspend`,
      {
        method: 'POST',
        body: JSON.stringify({}),
      },
    ),
};

export const RKYVES_BRAND = {
  name: 'Rkyves',
  product: 'Cullinos',
  tagline: 'App operations',
} as const;

export const PLATFORM_APP_URL = (
  import.meta.env.VITE_PLATFORM_URL?.trim() ||
  (import.meta.env.PROD ? 'https://platform.cullinos.com' : 'http://localhost:5183')
).replace(/\/$/, '');

/** Allowed Google Fonts for in-app notification creative (must match Guest app). */
export const NOTIFICATION_FONT_ALLOWLIST = [
  'Inter',
  'Poppins',
  'Montserrat',
  'Playfair Display',
] as const;

export const STYLE_PRESET_DEFAULTS: Record<
  Exclude<StylePreset, 'custom'>,
  PushCreative
> = {
  offer: {
    titleColor: '#0F0F1A',
    bodyColor: '#3D3D4A',
    bgColor: '#FFF8E7',
    accentColor: '#D4A017',
    fontFamily: 'Poppins',
    ctaLabel: 'Claim offer',
  },
  alert: {
    titleColor: '#FFFFFF',
    bodyColor: '#F5F5F7',
    bgColor: '#1A1A2E',
    accentColor: '#E85D4C',
    fontFamily: 'Inter',
    ctaLabel: 'View details',
  },
  promo: {
    titleColor: '#0F0F1A',
    bodyColor: '#3D3D4A',
    bgColor: '#F0F7FF',
    accentColor: '#2B6CB0',
    fontFamily: 'Montserrat',
    ctaLabel: 'Explore',
  },
};

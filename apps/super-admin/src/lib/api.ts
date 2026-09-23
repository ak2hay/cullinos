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

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  email: string | null;
  status?: string;
  isActive: boolean;
  environmentClass?: number;
  sandboxSkipEmailOtp?: boolean;
  sandboxSkipSmsOtp?: boolean;
  sandboxRelaxPassword?: boolean;
  plan: string | null;
  priceMonthly?: number;
  mrrContribution?: number;
  subscriptionStatus: string | null;
  trialEndsAt: string | null;
  graceUntil?: string | null;
  checkoutUrl: string | null;
  razorpaySubId: string | null;
  lastRazorpayPaymentId?: string | null;
  outletCount: number;
  userCount: number;
  createdAt: string;
}

export interface TenantListResponse {
  data: Tenant[];
  meta: { total: number; page: number; limit: number; hasMore: boolean };
}

export interface TenantDetail {
  id: string;
  name: string;
  slug: string;
  email: string | null;
  phone: string | null;
  status: string;
  businessType: string;
  restaurantSize: string | null;
  city: string | null;
  state: string | null;
  country: string;
  timezone: string;
  currency: string;
  environmentClass: number;
  sandboxSkipEmailOtp: boolean;
  sandboxSkipSmsOtp: boolean;
  sandboxRelaxPassword: boolean;
  createdAt: string;
  updatedAt: string;
  counts: { users: number; outlets: number; orders: number };
  outlets: Array<{ id: string; name: string; slug: string; status: string }>;
  subscription: {
    id: string;
    status: string;
    planId: string;
    planSlug: string;
    planName: string;
    priceMonthly: number;
    trialEndsAt: string | null;
    graceUntil: string | null;
    currentPeriodEnd: string | null;
    razorpaySubId: string | null;
    razorpayShortUrl: string | null;
    lastRazorpayPaymentId: string | null;
    entitlements: Array<{ module: string; enabled: boolean }>;
  } | null;
  recentAudit: Array<{
    id: string;
    action: string;
    entityType: string;
    entityId: string | null;
    metadata: unknown;
    createdAt: string;
    user: { id: string; email: string; name: string } | null;
  }>;
}

export interface TenantUser {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  status: string;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  roles: Array<{ slug: string; name: string }>;
}

export interface SystemHealth {
  status: string;
  timestamp: string;
  database: string;
  metrics: {
    totalOrganizations: number;
    activeOrganizations: number;
    trialOrganizations?: number;
    ordersToday: number;
    pendingSyncEvents: number;
    failedNotifications: number;
    failedSyncEvents?: number;
    unreadNotifications?: number;
  };
}

export type AnalyticsRange = '7d' | '30d' | '90d';

export interface AnalyticsOverview {
  range: AnalyticsRange;
  rangeStart: string;
  generatedAt: string;
  saas: {
    mrr: number;
    arr: number;
    trialCount: number;
    cancelledInRange: number;
    planMix: Array<{ planSlug: string; planName: string; count: number; mrr: number }>;
    newOrganizationsByDay: Array<{ date: string; count: number }>;
    trialsEndingSoon: Array<{
      organizationId: string;
      organizationName: string;
      organizationSlug: string;
      planSlug: string;
      planName: string;
      trialEndsAt: string | null;
    }>;
  };
  ops: {
    totalOrganizations: number;
    activeOrganizations: number;
    ordersToday: number;
    pendingSyncEvents: number;
    failedSyncEvents: number;
    unreadNotifications: number;
    failedNotifications: number;
    ordersByDay: Array<{ date: string; count: number }>;
  };
  alerts: Array<{ severity: 'error' | 'warning' | 'info'; message: string }>;
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
  description?: string | null;
  priceMonthly: number;
  priceYearly?: number;
  maxOutlets?: number;
  maxTerminals?: number;
  isActive?: boolean;
  sortOrder?: number;
  subscriptionCount?: number;
  modules?: string[];
  features?: Array<{ module: string; enabled: boolean }>;
}

export interface ImpersonationResponse {
  expiresAt: string;
  expiresIn?: number;
  adminUrl: string;
  handoffCode?: string;
  organization: { id: string; name: string; slug: string };
  user: {
    id: string;
    email: string;
    name?: string;
    firstName?: string;
    lastName?: string;
    organizationId?: string;
    organizationName?: string;
    mustChangePassword?: boolean;
  };
}

export interface SmsStatus {
  configured: boolean;
  widgetConfigured?: boolean;
  flowConfigured?: boolean;
  senderId: string | null;
  widgetId?: string | null;
  templateId: string | null;
  otpTtlSeconds: number;
}

export type ConfigSource = 'database' | 'environment' | 'missing';

export type PlatformSettingsField = {
  key: string;
  label: string;
  isSecret: boolean;
  configured: boolean;
  source: ConfigSource;
  value?: string | null;
  masked?: string | null;
};

export type PlatformSettingsGroup = {
  id: string;
  label: string;
  description: string;
  fields: PlatformSettingsField[];
};

export type PlatformSettingsResponse = {
  encryptionConfigured: boolean;
  groups: PlatformSettingsGroup[];
};

function orgQuery(params: {
  page?: number;
  limit?: number;
  q?: string;
  status?: string;
  planSlug?: string;
}) {
  const sp = new URLSearchParams();
  sp.set('page', String(params.page ?? 1));
  sp.set('limit', String(params.limit ?? 20));
  if (params.q) sp.set('q', params.q);
  if (params.status) sp.set('status', params.status);
  if (params.planSlug) sp.set('planSlug', params.planSlug);
  return sp.toString();
}

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
      { method: 'POST', body: JSON.stringify(payload) },
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

  analyticsOverview: (range: AnalyticsRange = '30d') =>
    apiRequest<AnalyticsOverview>(`/super-admin/analytics/overview?range=${range}`),

  listOrganizations: (
    page = 1,
    limit = 20,
    filters?: { q?: string; status?: string; planSlug?: string },
  ) =>
    apiRequest<TenantListResponse>(
      `/super-admin/organizations?${orgQuery({ page, limit, ...filters })}`,
    ),

  getOrganization: (id: string) =>
    apiRequest<TenantDetail>(`/super-admin/organizations/${id}`),

  updateOrganizationEnvironment: (
    id: string,
    payload: {
      environmentClass: number;
      sandboxSkipEmailOtp?: boolean;
      sandboxSkipSmsOtp?: boolean;
      sandboxRelaxPassword?: boolean;
    },
  ) =>
    apiRequest<{
      id: string;
      name: string;
      slug: string;
      status: string;
      environmentClass: number;
      sandboxSkipEmailOtp: boolean;
      sandboxSkipSmsOtp: boolean;
      sandboxRelaxPassword: boolean;
    }>(`/super-admin/organizations/${id}/environment`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  runLabsSql: (sql: string) =>
    apiRequest<{
      columns: string[];
      rows: Record<string, unknown>[];
      truncated: boolean;
      durationMs: number;
    }>('/super-admin/labs/sql', {
      method: 'POST',
      body: JSON.stringify({ sql }),
    }),

  listLabsSqlAudits: (limit = 50) =>
    apiRequest<
      Array<{
        id: string;
        actorEmail: string;
        sqlPreview: string;
        rowCount: number | null;
        durationMs: number | null;
        success: boolean;
        error: string | null;
        createdAt: string;
      }>
    >(`/super-admin/labs/sql-audits?limit=${limit}`),

  getOrganizationWallet: (id: string) =>
    apiRequest<{
      balancePaise: number;
      balanceRupees: number;
      pricePer100Paise: number;
      pricePer100Rupees: number;
      updatedAt: string;
    }>(`/super-admin/orgs/${id}/wallet`),

  adjustOrganizationWallet: (
    id: string,
    payload: { amountPaise: number; note: string },
  ) =>
    apiRequest<{
      balancePaise: number;
      balanceRupees: number;
      pricePer100Paise: number;
      pricePer100Rupees: number;
      updatedAt: string;
    }>(`/super-admin/orgs/${id}/wallet/adjust`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  listOrganizationUsers: (id: string) =>
    apiRequest<TenantUser[]>(`/super-admin/organizations/${id}/users`),

  resetOrganizationUserPassword: (orgId: string, userId: string) =>
    apiRequest<{
      userId: string;
      email: string;
      temporaryPassword: string;
      emailSent: boolean;
      adminUrl: string;
    }>(`/super-admin/organizations/${orgId}/users/${userId}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),

  deactivateOrganizationUser: (orgId: string, userId: string) =>
    apiRequest<{ id: string; email: string; status: string }>(
      `/super-admin/organizations/${orgId}/users/${userId}/deactivate`,
      { method: 'PATCH' },
    ),

  activateOrganizationUser: (orgId: string, userId: string) =>
    apiRequest<{ id: string; email: string; status: string }>(
      `/super-admin/organizations/${orgId}/users/${userId}/activate`,
      { method: 'PATCH' },
    ),

  impersonateOrganization: (id: string, reason: string) =>
    apiRequest<ImpersonationResponse>(`/super-admin/organizations/${id}/impersonate`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  listAuditLogs: (page = 1, limit = 50, organizationId?: string) => {
    const sp = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (organizationId) sp.set('organizationId', organizationId);
    return apiRequest<{
      data: Array<{
        id: string;
        action: string;
        entityType: string;
        entityId: string | null;
        metadata: unknown;
        createdAt: string;
        user: { id: string; email: string; name: string } | null;
        organization: { id: string; name: string; slug: string };
      }>;
      meta: { total: number; page: number; limit: number; hasMore: boolean };
    }>(`/super-admin/audit-logs?${sp}`);
  },

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

  collectSubscription: (id: string) =>
    apiRequest<{
      organizationId: string;
      subscriptionId: string;
      razorpaySubId: string | null;
      shortUrl: string | null;
      status: string;
    }>(`/super-admin/organizations/${id}/subscription/collect`, { method: 'POST' }),

  listPlans: () => apiRequest<PlanSummary[]>('/super-admin/plans'),

  createPlan: (payload: {
    name: string;
    slug: string;
    description?: string;
    priceMonthly?: number;
    priceYearly?: number;
    maxOutlets?: number;
    maxTerminals?: number;
    modules?: string[];
  }) =>
    apiRequest<PlanSummary>('/super-admin/plans', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updatePlan: (
    id: string,
    payload: {
      name?: string;
      description?: string | null;
      priceMonthly?: number;
      priceYearly?: number;
      maxOutlets?: number;
      maxTerminals?: number;
      isActive?: boolean;
      sortOrder?: number;
    },
  ) =>
    apiRequest<PlanSummary>(`/super-admin/plans/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  deactivatePlan: (id: string) =>
    apiRequest<{ deactivated: boolean; deleted: boolean; id: string }>(
      `/super-admin/plans/${id}`,
      { method: 'DELETE' },
    ),

  updatePlanModules: (id: string, modules: string[]) =>
    apiRequest<PlanSummary>(`/super-admin/plans/${id}/modules`, {
      method: 'PATCH',
      body: JSON.stringify({ modules }),
    }),

  onboardRestaurant: (payload: {
    companyName: string;
    planSlug: string;
    ownerEmail: string;
    ownerName?: string;
    outletName?: string;
    businessType?: string;
    restaurantSize?: string | null;
  }) =>
    apiRequest<{
      organizationId: string;
      organizationSlug: string;
      ownerEmail: string;
      adminUrl: string;
      temporaryPassword: string;
      emailSent: boolean;
    }>('/super-admin/organizations', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  deleteOrganization: (id: string) =>
    apiRequest<{ deleted: boolean; id: string }>(`/super-admin/organizations/${id}`, {
      method: 'DELETE',
    }),

  health: () => apiRequest<SystemHealth>('/super-admin/health'),

  smsStatus: () => apiRequest<SmsStatus>('/super-admin/sms-status'),

  getSettings: () => apiRequest<PlatformSettingsResponse>('/super-admin/settings'),

  updateSettingsGroup: (group: string, values: Record<string, string>) =>
    apiRequest<PlatformSettingsGroup>(`/super-admin/settings/${group}`, {
      method: 'PUT',
      body: JSON.stringify({ values }),
    }),

  testSmtp: (to?: string) =>
    apiRequest<{ ok: boolean; message: string }>('/super-admin/settings/smtp/test', {
      method: 'POST',
      body: JSON.stringify({ to }),
    }),

  testMsg91: (phone?: string) =>
    apiRequest<{ ok: boolean; message: string }>('/super-admin/settings/msg91/test', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    }),

  listOwnerRecipients: () =>
    apiRequest<
      Array<{
        id: string;
        email: string;
        name: string;
        organizationId: string;
        organizationName: string;
      }>
    >('/super-admin/promo/recipients/owners'),

  listPromoCampaigns: (page = 1, limit = 20) =>
    apiRequest<
      Array<{
        id: string;
        subject: string;
        recipientCount: number;
        sentCount: number;
        failedCount: number;
        status: string;
        createdAt: string;
      }>
    >(`/super-admin/promo/campaigns?page=${page}&limit=${limit}`),

  sendPromoCampaign: (payload: {
    subject: string;
    body: string;
    ownerUserIds?: string[];
  }) =>
    apiRequest<{
      id: string;
      subject: string;
      recipientCount: number;
      sentCount: number;
      failedCount: number;
      status: string;
    }>('/super-admin/promo/campaigns', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  listGuestBanners: () =>
    apiRequest<GuestBannerRow[]>('/super-admin/guest-marketing/banners'),
  createGuestBanner: (payload: Record<string, unknown>) =>
    apiRequest<GuestBannerRow>('/super-admin/guest-marketing/banners', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateGuestBanner: (id: string, payload: Record<string, unknown>) =>
    apiRequest<GuestBannerRow>(`/super-admin/guest-marketing/banners/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteGuestBanner: (id: string) =>
    apiRequest<{ success: boolean }>(`/super-admin/guest-marketing/banners/${id}`, {
      method: 'DELETE',
    }),
  listGuestPushCampaigns: () =>
    apiRequest<GuestPushCampaignRow[]>('/super-admin/guest-marketing/push-campaigns'),
  sendGuestPushCampaign: (payload: {
    title: string;
    body: string;
    data?: Record<string, string>;
  }) =>
    apiRequest<GuestPushCampaignRow>('/super-admin/guest-marketing/push-campaigns', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
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
      { method: 'POST' },
    ),
  deleteGuestCoupon: (id: string) =>
    apiRequest<{ success: boolean; id: string }>(
      `/super-admin/guest-marketing/coupons/${id}`,
      { method: 'DELETE' },
    ),
};

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

export interface GuestPushCampaignRow {
  id: string;
  title: string;
  body: string;
  audience: string;
  status: string;
  sentCount: number;
  sentAt?: string | null;
  createdAt: string;
}

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

// —— Guest Ops (/super-admin/guest-ops/*) ——

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

export interface GuestOpsBannerRow extends GuestBannerRow {
  organization?: { id: string; name: string; slug: string } | null;
}

export interface GuestOpsPushCampaignRow {
  id: string;
  title: string;
  body: string;
  audience: string;
  audienceFilter?: Record<string, unknown>;
  deepLink?: string | null;
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

  exportUser: (id: string) =>
    apiRequest<Record<string, unknown>>(`/super-admin/guest-ops/users/${id}/export`),

  eraseUser: (id: string) =>
    apiRequest<{ success: boolean }>(`/super-admin/guest-ops/users/${id}/erase`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),
};

export const RKYVES_BRAND = {
  name: 'Rkyves',
  product: 'Cullinos',
  tagline: 'Platform administration',
} as const;

export const ADMIN_APP_URL =
  import.meta.env.VITE_ADMIN_URL?.replace(/\/$/, '') ?? 'http://localhost:5173';

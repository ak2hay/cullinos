import { CULLINOS_BRAND, DEFAULT_API_BASE } from '@cullinos/shared';
import type { ApiError } from '@cullinos/shared';

const API_BASE = import.meta.env.VITE_API_URL ?? DEFAULT_API_BASE;

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

async function parseError(response: Response): Promise<ApiRequestError> {
  try {
    const body = (await response.json()) as ApiError & {
      error?: { details?: Record<string, unknown> };
    };
    return new ApiRequestError(
      body.error?.message ?? 'Request failed',
      body.error?.code ?? 'UNKNOWN',
      response.status,
      body.error?.details,
    );
  } catch {
    return new ApiRequestError(response.statusText || 'Request failed', 'UNKNOWN', response.status);
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
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

export interface StorefrontBootstrap {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  outletId: string;
  outletName: string;
  outletSlug: string;
  brandName: string;
  logoUrl?: string | null;
  coverImageUrl?: string | null;
  accentColor?: string | null;
  orderModes: string[];
  menu: OutletMenu;
}

export interface MenuCategory {
  id: string;
  name: string;
  description?: string | null;
}

export interface MenuModifier {
  id: string;
  name: string;
  price: number;
}

export interface MenuModifierGroup {
  id: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  modifiers: MenuModifier[];
}

export interface MenuVariant {
  id: string;
  name: string;
  price: number;
}

export interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  isAvailable: boolean;
  categoryId: string | null;
  imageUrl?: string | null;
  variants?: MenuVariant[];
  modifierGroups?: MenuModifierGroup[];
}

export interface OutletMenu {
  outletId: string;
  categories: MenuCategory[];
  items: MenuItem[];
}

export interface OrderPayload {
  orgSlug: string;
  outletSlug: string;
  source: 'QR' | 'ONLINE';
  type?: string;
  tableId?: string;
  notes?: string;
  customerId?: string;
  customerName?: string;
  scheduledPickupAt?: string;
  tipAmount?: number;
  items: Array<{
    menuItemId: string;
    variantId?: string;
    quantity: number;
    modifiers?: Array<{ name: string; price: number; modifierId?: string }>;
    notes?: string;
  }>;
}

export interface Order {
  id: string;
  orderNumber: string;
  pickupCode?: string | null;
  status: string;
  source?: string;
  type?: string;
  notes?: string | null;
  subtotal: number;
  customerName?: string | null;
  items?: Array<{
    id: string;
    name: string;
    quantity: number;
    unitPrice: number;
    notes?: string | null;
  }>;
}

export interface CustomerAuthProfile {
  id: string;
  name: string;
  phone: string;
  loyaltyPoints: number;
  stampCount: number;
  organizationId?: string;
}

export interface LoyaltySettings {
  pointsPerCurrency: number;
  redemptionValue: number;
  minRedeem: number;
  stampCardEnabled: boolean;
}

export const storefrontApi = {
  bootstrap: (orgSlug: string, outletSlug: string) =>
    apiRequest<StorefrontBootstrap>(`/storefront/${orgSlug}/${outletSlug}`),
};

export const menuApi = {
  getOutletMenu: (outletId: string) =>
    apiRequest<OutletMenu>(`/public/menu/outlets/${outletId}`),
};

export const ordersApi = {
  create: (payload: OrderPayload) =>
    apiRequest<Order>('/public/orders', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  confirm: (orderId: string) =>
    apiRequest<Order>(`/public/orders/${orderId}/confirm`, { method: 'POST' }),
};

export const paymentsApi = {
  createIntent: (payload: { organizationId: string; orderId: string; amount: number }) =>
    apiRequest<{ clientSecret: string; provider: string }>('/payments/online/intent', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

export const tablesApi = {
  list: (outletId: string) =>
    apiRequest<Array<{ id: string; name: string; qrCode: string | null }>>(
      `/public/tables/outlets/${outletId}`,
    ),
};

export interface PublicSessionInfo {
  sessionId: string;
  sessionToken: string;
  sessionActive: boolean;
  tableId: string;
  tableName: string;
  organizationId: string;
  organizationSlug: string;
  organizationName: string;
  outletId: string;
  outletSlug: string;
  outletName: string;
  orderId: string | null;
  orderNumber: string | null;
}

export const sessionsApi = {
  validate: (token: string) =>
    apiRequest<PublicSessionInfo>(`/public/sessions/${token}`),

  addItems: (
    token: string,
    payload: {
      items: OrderPayload['items'];
      customerName?: string;
      notes?: string;
    },
  ) =>
    apiRequest<Order>(`/public/sessions/${token}/items`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  submit: (token: string) =>
    apiRequest<Order>(`/public/sessions/${token}/submit`, { method: 'POST' }),

  requestWaiter: (token: string, payload?: { note?: string }) =>
    apiRequest<{
      id: string;
      tableId: string;
      tableName: string | null;
      type: string;
      status: string;
      reused: boolean;
      reminded?: boolean;
      createdAt: string;
      cooldownRemainingMs?: number;
    }>(`/public/sessions/${token}/service-requests`, {
      method: 'POST',
      body: JSON.stringify({ type: 'waiter', ...payload }),
    }),
};

export const customerAuthApi = {
  getWidgetConfig: () =>
    apiRequest<{
      enabled: boolean;
      widgetId: string | null;
      tokenAuth: string | null;
      noticeVersion?: string;
      noticeSummary?: string;
    }>('/public/auth/otp/widget-config'),

  requestOtp: (payload: { phone: string; orgId: string }) =>
    apiRequest<{
      challengeToken: string;
      expiresIn: number;
      sent: boolean;
      provider: string;
      debugOtp?: string;
      noticeVersion?: string;
      purpose?: string;
    }>('/public/auth/otp/request', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  verifyOtp: (payload: {
    challengeToken: string;
    code: string;
    name?: string;
    marketingEmailOptIn?: boolean;
    marketingSmsOptIn?: boolean;
  }) =>
    apiRequest<{ accessToken: string; customer: CustomerAuthProfile }>(
      '/public/auth/otp/verify',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    ),

  verifyWidget: (payload: {
    orgId: string;
    accessToken: string;
    phone?: string;
    identifier?: string;
    name?: string;
    marketingEmailOptIn?: boolean;
    marketingSmsOptIn?: boolean;
  }) =>
    apiRequest<{ accessToken: string; customer: CustomerAuthProfile }>(
      '/public/auth/otp/widget-verify',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    ),

  me: (accessToken: string) =>
    apiRequest<CustomerAuthProfile>('/public/auth/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
};

export const loyaltyApi = {
  getSettings: (orgId: string) =>
    apiRequest<LoyaltySettings>(`/public/loyalty/${orgId}/settings`),

  getMe: (orgId: string, accessToken: string) =>
    apiRequest<{
      loyaltyPoints: number;
      stampCount: number;
      customer: { id: string; name: string; phone: string };
      settings: LoyaltySettings;
      recentTransactions: Array<{
        id: string;
        points: number;
        type: string;
        reference: string | null;
        createdAt: string;
      }>;
    }>(`/public/loyalty/${orgId}/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),

  listRewards: (orgId: string) =>
    apiRequest<
      Array<{
        id: string;
        name: string;
        pointsCost: number;
        menuItemId: string | null;
        menuItem?: { id: string; name: string } | null;
      }>
    >(`/public/loyalty/${orgId}/rewards`),

  redeem: (
    orgId: string,
    accessToken: string,
    payload: { points: number; orderId?: string },
  ) =>
    apiRequest<{
      pointsRedeemed: number;
      discountAmount: number;
      remainingPoints: number;
      customer: CustomerAuthProfile;
    }>(`/public/loyalty/${orgId}/redeem`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(payload),
    }),

  redeemReward: (
    orgId: string,
    accessToken: string,
    payload: { rewardId: string; orderId?: string },
  ) =>
    apiRequest<{
      remainingPoints: number;
      freeMenuItem: { id: string; name: string; unitPrice: number } | null;
      reward: { name: string; pointsCost: number };
    }>(`/public/loyalty/${orgId}/redeem-reward`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(payload),
    }),
};

export { CULLINOS_BRAND };

export function formatPrice(paise: number): string {
  return `₹${(paise / 100).toFixed(0)}`;
}

export function hasApiAccess(): boolean {
  return true;
}

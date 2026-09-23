import {
  CULLINOS_BRAND,
  DEFAULT_API_BASE,
  mapStaffLoginResponse,
  type ApiStaffLoginResponse,
  type StaffAuthResponse,
} from '@cullinos/shared';
import type { ApiError, OrderStatus } from '@cullinos/shared';
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
  captchaToken?: string;
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
  operatingMode?: string;
  isActive: boolean;
}

export interface MenuCategory {
  id: string;
  name: string;
  sortOrder: number;
}

export interface OutletMenuItem {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  price: number;
  isAvailable: boolean;
}

export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  notes?: string | null;
}

export interface Order {
  id: string;
  orderNumber: string;
  pickupCode?: string | null;
  status: OrderStatus;
  totalAmount: number;
  subtotal?: number;
  customerName?: string | null;
  notes?: string | null;
  items?: OrderItem[];
}

export interface CashPaymentResult {
  success: boolean;
  orderId: string;
  paymentId?: string;
  alreadyPaid?: boolean;
  remaining?: number;
  paidAmount?: number;
}

export interface OnlineIntent {
  provider: 'razorpay' | 'cashfree' | string;
  orderId: string;
  paymentId: string;
  keyId?: string;
  razorpayOrderId?: string;
  cashfreeOrderId?: string;
  paymentSessionId?: string;
  mode?: 'sandbox' | 'production';
  amount: number;
  amountPaise: number;
  currency: string;
  status: string;
}

export const paymentsApi = {
  payCash: (orderId: string, amount?: number) =>
    apiRequest<CashPaymentResult>('/payments/cash', {
      method: 'POST',
      body: JSON.stringify({ orderId, amount }),
    }),

  getBalance: (orderId: string) =>
    apiRequest<{ orderId: string; total: number; remaining: number; paid: number }>(
      `/payments/orders/${orderId}/balance`,
    ),

  createIntent: (orderId: string, amount?: number, provider?: 'razorpay' | 'cashfree') =>
    apiRequest<OnlineIntent>('/payments/online/intent', {
      method: 'POST',
      body: JSON.stringify({ orderId, amount, provider }),
    }),

  verify: (payload: {
    provider?: 'razorpay' | 'cashfree';
    razorpayOrderId?: string;
    razorpayPaymentId?: string;
    razorpaySignature?: string;
    cashfreeOrderId?: string;
  }) =>
    apiRequest<{ success: boolean; orderId: string }>('/payments/online/verify', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

export interface QuickOrderItem {
  menuItemId: string;
  quantity: number;
}

export const outletsApi = {
  list: () => apiRequest<Outlet[]>('/outlets'),
};

export const menuApi = {
  getOutletMenu: (outletId: string) =>
    apiRequest<{
      outletId: string;
      categories: MenuCategory[];
      items: OutletMenuItem[];
    }>(`/menu/outlets/${outletId}`),
};

export const posApi = {
  quickOrder: (
    payload: {
      outletId: string;
      items: QuickOrderItem[];
      autoConfirm?: boolean;
      type?: string;
      customerId?: string;
      customerName?: string;
      tipAmount?: number;
      notes?: string;
    },
    idempotencyKey?: string,
  ) =>
    apiRequest<Order>(
      '/pos/quick-order',
      {
        method: 'POST',
        body: JSON.stringify({ ...payload, autoConfirm: payload.autoConfirm ?? true }),
        headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
      },
    ),

  holdOrder: (orderId: string) =>
    apiRequest<Order>(`/pos/orders/${orderId}/hold`, { method: 'POST' }),

  resumeOrder: (orderId: string) =>
    apiRequest<Order>(`/pos/orders/${orderId}/resume`, { method: 'POST' }),

  getOpenShift: (outletId: string) =>
    apiRequest<{ id: string; openedAt: string; openingCash: number; status: string } | null>(
      `/pos/shifts/open?outletId=${encodeURIComponent(outletId)}`,
    ),

  openShift: (outletId: string, openingCash = 0) =>
    apiRequest('/pos/shifts/open', {
      method: 'POST',
      body: JSON.stringify({ outletId, openingCash }),
    }),

  closeShift: (shiftId: string, closingCash?: number) =>
    apiRequest(`/pos/shifts/${shiftId}/close`, {
      method: 'POST',
      body: JSON.stringify({ closingCash }),
    }),
};

export const ordersApi = {
  get: (id: string) => apiRequest<Order>(`/orders/${id}`),

  create: (
    payload: {
      outletId: string;
      source: 'POS';
      items: QuickOrderItem[];
      customerId?: string;
    },
    idempotencyKey?: string,
  ) =>
    apiRequest<Order>(
      '/orders',
      {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
      },
    ),

  hold: (orderId: string) =>
    apiRequest<Order>(`/orders/${orderId}/hold`, { method: 'POST' }),

  resume: (orderId: string) =>
    apiRequest<Order>(`/orders/${orderId}/resume`, { method: 'POST' }),

  applyDiscount: (
    orderId: string,
    payload: { discountAmount?: number; reason?: string; couponCode?: string },
  ) =>
    apiRequest<Order>(`/orders/${orderId}/discount`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  split: (orderId: string, itemIds: string[]) =>
    apiRequest<{ original: Order; split: Order }>(`/orders/${orderId}/split`, {
      method: 'POST',
      body: JSON.stringify({ itemIds }),
    }),

  sendEbill: (orderId: string, channel: 'email' | 'sms') =>
    apiRequest<{ success: boolean; channel: string }>(`/orders/${orderId}/ebill`, {
      method: 'POST',
      body: JSON.stringify({ channel }),
    }),
};

export interface PosCustomer {
  id: string;
  name: string;
  phone: string | null;
  loyaltyPoints: number;
}

export const customersApi = {
  search: (q: string) =>
    apiRequest<PosCustomer[]>(`/customers?q=${encodeURIComponent(q)}`),
  create: (data: { name: string; phone?: string }) =>
    apiRequest<PosCustomer>('/customers', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

export interface LoyaltySettings {
  pointsPerCurrency: number;
  redemptionValue: number;
  minRedeem: number;
  stampCardEnabled: boolean;
}

export interface LoyaltyReward {
  id: string;
  name: string;
  pointsCost: number;
  menuItemId: string | null;
  isActive: boolean;
  menuItem?: { id: string; name: string } | null;
}

export const loyaltyApi = {
  getSettings: () => apiRequest<LoyaltySettings>('/loyalty/settings'),
  listRewards: () => apiRequest<LoyaltyReward[]>('/loyalty/rewards'),
  redeemReward: (customerId: string, rewardId: string) =>
    apiRequest<{
      remainingPoints: number;
      freeMenuItem: { id: string; name: string; unitPrice: number } | null;
      reward: { name: string; pointsCost: number };
    }>(`/loyalty/customers/${customerId}/redeem-reward`, {
      method: 'POST',
      body: JSON.stringify({ rewardId }),
    }),
  redeem: (customerId: string, points: number, orderId?: string) =>
    apiRequest<{
      pointsRedeemed: number;
      discountAmount: number;
      remainingPoints: number;
    }>(`/loyalty/customers/${customerId}/redeem`, {
      method: 'POST',
      body: JSON.stringify({ points, orderId }),
    }),
};

export const feedbackApi = {
  surveyLink: (orderId: string) =>
    apiRequest<{ url: string; surveyToken: string; orderNumber: string }>(
      `/feedback/orders/${orderId}/survey-link`,
      { method: 'POST' },
    ),
};

export { CULLINOS_BRAND };

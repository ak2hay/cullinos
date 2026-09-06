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
    signal: options.signal ?? AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    throw await parseError(response);
  }

  // Nest void handlers often return 200 with an empty body (not only 204).
  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return undefined as T;
  }

  const text = await response.text();
  if (!text) {
    return undefined as T;
  }

  return JSON.parse(text) as T;
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
  slug?: string;
  code: string | null;
  city: string | null;
  operatingMode?: string;
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
  /** API field — soft-deleted items are omitted from list endpoints */
  isActive: boolean;
  isAvailable?: boolean;
  sortOrder: number;
}

export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  notes: string | null;
}

export interface Order {
  id: string;
  orderNumber: string;
  pickupCode?: string | null;
  status: OrderStatus;
  source?: string;
  type?: string;
  notes?: string | null;
  totalAmount: number;
  subtotal: number;
  tipAmount?: number;
  createdAt: string;
  scheduledPickupAt?: string | null;
  outletId: string;
  tableId: string | null;
  customerName?: string | null;
  items?: OrderItem[];
}

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  loyaltyPoints: number;
  stampCount: number;
  loyaltyTier?: { id: string; name: string } | null;
}

export interface LoyaltySettings {
  pointsPerCurrency: number;
  redemptionValue: number;
  minRedeem: number;
  stampCardEnabled: boolean;
}

export interface LoyaltyTier {
  id: string;
  name: string;
  minPoints: number;
  multiplier: number | string;
}

export interface LoyaltyReward {
  id: string;
  name: string;
  pointsCost: number;
  menuItemId: string | null;
  isActive: boolean;
  menuItem?: { id: string; name: string; basePrice: number | string } | null;
}

export interface RecipeRow {
  id: string;
  menuItemId: string;
  yield: number | string;
  menuItem?: { id: string; name: string };
  ingredients?: Array<{
    id: string;
    quantity: number | string;
    inventoryItemId?: string;
    inventoryItem?: { id: string; name: string; unit: string };
  }>;
}

export interface DeliveryZone {
  id: string;
  outletId: string;
  name: string;
  deliveryFee: number | string;
  minOrder: number | string;
  polygon?: { pincode?: string; estimatedMinutes?: number } | null;
}

export interface Brand {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  isDefault: boolean;
  _count?: { outlets: number };
}

export interface BanquetPackage {
  id: string;
  name: string;
  capacity: number;
  baseRate: number | string;
  _count?: { bookings: number };
}

export interface BanquetBooking {
  id: string;
  banquetId: string;
  eventDate: string;
  guestCount: number;
  total: number | string;
  status: string;
  banquet?: { id: string; name: string; capacity?: number };
  guest?: { id: string; name: string; phone?: string | null; email?: string | null };
}

export interface OrganizationSettings {
  settings: Record<string, unknown>;
}

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

  changePassword: (payload: { currentPassword: string; newPassword: string }) =>
    apiRequest<{ success: boolean; mustChangePassword: boolean }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  logout: (refreshToken: string) =>
    apiRequest<{ success: boolean }>('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }),
};

export const outletsApi = {
  list: () => apiRequest<Outlet[]>('/outlets'),
  create: (data: { name: string; city?: string; phone?: string; operatingMode?: string }) =>
    apiRequest<Outlet>('/outlets', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: { name?: string; phone?: string; operatingMode?: string }) =>
    apiRequest<Outlet>(`/outlets/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
};

export interface OrganizationCurrent {
  id: string;
  name: string;
  slug?: string;
  businessType: string | null;
  restaurantSize: string | null;
  gstin: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  timezone?: string;
  currency?: string;
  setupCompleted: boolean;
  loyaltySettings?: Record<string, unknown> | null;
}

export const organizationsApi = {
  current: () => apiRequest<OrganizationCurrent>('/organizations/current'),
  updateCurrent: (data: {
    name?: string;
    gstin?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    city?: string | null;
    businessType?: string;
  }) =>
    apiRequest<OrganizationCurrent>('/organizations/current', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
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
    payload: Partial<{
      name: string;
      description: string;
      basePrice: number;
      isActive: boolean;
      isAvailable: boolean;
    }>,
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
  create: (
    payload: {
      outletId: string;
      source: 'POS';
      items: QuickOrderItem[];
      customerId?: string;
    },
    idempotencyKey?: string,
  ) =>
    apiRequest<Order>('/orders', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    }),
  hold: (orderId: string) =>
    apiRequest<Order>(`/orders/${orderId}/hold`, { method: 'POST' }),
  resume: (orderId: string) =>
    apiRequest<Order>(`/orders/${orderId}/resume`, { method: 'POST' }),
  updateStatus: (id: string, status: OrderStatus | string) =>
    apiRequest<Order>(`/orders/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
};

export const customersApi = {
  list: (q?: string) => {
    const qs = q ? `?q=${encodeURIComponent(q)}` : '';
    return apiRequest<Customer[]>(`/customers${qs}`);
  },
  get: (id: string) => apiRequest<Customer>(`/customers/${id}`),
  create: (payload: { name: string; phone?: string; email?: string }) =>
    apiRequest<Customer>('/customers', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  update: (id: string, payload: { name?: string; phone?: string; email?: string }) =>
    apiRequest<Customer>(`/customers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
};

export const recipesApi = {
  list: () => apiRequest<RecipeRow[]>('/recipes'),
  create: (payload: {
    menuItemId: string;
    name?: string;
    yieldQty?: number;
    ingredients: Array<{ inventoryItemId: string; quantity: number; unit?: string }>;
  }) =>
    apiRequest<RecipeRow>('/recipes', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

export const deliveryApi = {
  list: () => apiRequest<DeliveryZone[]>('/delivery'),
  createZone: (payload: {
    name: string;
    outletId?: string;
    pincode?: string;
    minOrder?: number;
    fee?: number;
    estimatedMinutes?: number;
  }) =>
    apiRequest<DeliveryZone>('/delivery/zones', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

export const brandsApi = {
  list: () => apiRequest<Brand[]>('/brands'),
  create: (payload: { name: string; code?: string; description?: string }) =>
    apiRequest<Brand>('/brands', { method: 'POST', body: JSON.stringify(payload) }),
};

export const banquetsApi = {
  list: () => apiRequest<BanquetPackage[]>('/banquets'),
  create: (payload: { name: string; capacity?: number; baseRate?: number }) =>
    apiRequest<BanquetPackage>('/banquets', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  listBookings: () => apiRequest<BanquetBooking[]>('/banquets/bookings'),
  createBooking: (payload: {
    banquetId: string;
    guestName?: string;
    guestPhone?: string;
    eventDate: string;
    guestCount?: number;
    total?: number;
  }) =>
    apiRequest<BanquetBooking>('/banquets/bookings', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

export interface HospitalityGuest {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  documentType: string | null;
  documentNumber: string | null;
}

export interface HospitalityRoom {
  id: string;
  outletId: string;
  number: string;
  floor: number | null;
  status: string;
  roomType?: { id: string; name: string } | null;
}

export const hospitalityApi = {
  listGuests: () => apiRequest<HospitalityGuest[]>('/hospitality/guests'),
  listRooms: (outletId?: string) => {
    const qs = outletId ? `?outletId=${encodeURIComponent(outletId)}` : '';
    return apiRequest<HospitalityRoom[]>(`/hospitality/rooms${qs}`);
  },
};

export const settingsApi = {
  get: () => apiRequest<OrganizationSettings>('/organizations/settings'),
  update: async (data: Record<string, unknown>) => {
    const {
      businessType,
      restaurantSize,
      name,
      gstin,
      phone,
      email,
      address,
      city,
      timezone,
      currency,
      operatingMode,
      enabledOrderTypes,
      sampleCategories,
      ...rest
    } = data;
    if (
      businessType ||
      restaurantSize !== undefined ||
      name ||
      gstin ||
      phone ||
      email ||
      address ||
      city ||
      timezone ||
      currency
    ) {
      await apiRequest('/organizations/current', {
        method: 'PATCH',
        body: JSON.stringify({
          businessType,
          restaurantSize,
          name,
          gstin,
          phone,
          email,
          address,
          city,
          timezone,
          currency,
        }),
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

export interface DiningTable {
  id: string;
  outletId: string;
  sectionId: string;
  name: string;
  capacity: number;
  status: string;
  qrCode: string | null;
  section: { id: string; name: string } | null;
}

export const tablesApi = {
  listByOutlet: (outletId: string) =>
    apiRequest<DiningTable[]>(`/tables/outlets/${outletId}`),
  create: (payload: {
    outletId: string;
    name: string;
    capacity?: number;
    sectionName?: string;
  }) =>
    apiRequest<DiningTable>('/tables', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateStatus: (outletId: string, tableId: string, status: string) =>
    apiRequest<DiningTable>(`/tables/outlets/${outletId}/${tableId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
};

export interface InventoryItemRow {
  id: string;
  name: string;
  sku: string | null;
  unit: string;
  currentStock: number;
  reorderLevel?: number;
  outletId?: string | null;
}

export const inventoryApi = {
  listItems: () => apiRequest<InventoryItemRow[]>('/inventory/items'),
  listLowStock: () => apiRequest<InventoryItemRow[]>('/inventory/low-stock'),
  createItem: (payload: {
    outletId?: string;
    name: string;
    sku?: string;
    unit?: string;
    currentStock?: number;
    reorderLevel?: number;
  }) =>
    apiRequest<InventoryItemRow>('/inventory/items', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  adjust: (
    id: string,
    payload: { quantity: number; type: 'in' | 'out' | 'waste'; notes?: string },
  ) =>
    apiRequest<InventoryItemRow>(`/inventory/items/${id}/adjust`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
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
  listTiers: () => apiRequest<LoyaltyTier[]>('/loyalty'),
  getSettings: () => apiRequest<LoyaltySettings>('/loyalty/settings'),
  updateSettings: (payload: Partial<LoyaltySettings>) =>
    apiRequest<LoyaltySettings>('/loyalty/settings', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  createTier: (payload: { name: string; minPoints?: number; multiplier?: number }) =>
    apiRequest<LoyaltyTier>('/loyalty/tiers', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  deleteTier: (id: string) =>
    apiRequest<{ ok: boolean }>(`/loyalty/tiers/${id}`, { method: 'DELETE' }),
  listRewards: () => apiRequest<LoyaltyReward[]>('/loyalty/rewards'),
  createReward: (payload: {
    name: string;
    pointsCost: number;
    menuItemId?: string | null;
    isActive?: boolean;
  }) =>
    apiRequest<LoyaltyReward>('/loyalty/rewards', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateReward: (
    id: string,
    payload: Partial<{
      name: string;
      pointsCost: number;
      menuItemId: string | null;
      isActive: boolean;
    }>,
  ) =>
    apiRequest<LoyaltyReward>(`/loyalty/rewards/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteReward: (id: string) =>
    apiRequest<{ ok: boolean }>(`/loyalty/rewards/${id}`, { method: 'DELETE' }),
  redeemReward: (customerId: string, rewardId: string, orderId?: string) =>
    apiRequest<{
      remainingPoints: number;
      freeMenuItem: { id: string; name: string; unitPrice: number } | null;
      reward: { name: string; pointsCost: number };
    }>(`/loyalty/customers/${customerId}/redeem-reward`, {
      method: 'POST',
      body: JSON.stringify({ rewardId, orderId }),
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
  addStamp: (customerId: string) =>
    apiRequest(`/loyalty/customers/${customerId}/stamp`, { method: 'POST' }),
  redeemStamps: (customerId: string) =>
    apiRequest(`/loyalty/customers/${customerId}/redeem-stamps`, { method: 'POST' }),
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
  export: (params?: { from?: string; to?: string }) => {
    const search = new URLSearchParams();
    if (params?.from) search.set('from', params.from);
    if (params?.to) search.set('to', params.to);
    const qs = search.toString();
    return apiRequest<{
      from: string;
      to: string;
      count: number;
      rows: Array<Record<string, unknown>>;
    }>(`/reports/export${qs ? `?${qs}` : ''}`);
  },
};

export interface TaxRateRow {
  id: string;
  name: string;
  rate: number | string;
  type: string;
}

export interface TaxGroupRow {
  id: string;
  name: string;
  isInclusive: boolean;
  rates: TaxRateRow[];
}

export const taxApi = {
  list: () => apiRequest<TaxGroupRow[]>('/tax'),
  createGroup: (payload: {
    name: string;
    rates: Array<{ name: string; rate: number; type?: string }>;
    isInclusive?: boolean;
  }) =>
    apiRequest<TaxGroupRow>('/tax/groups', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

export interface DeviceRow {
  id: string;
  name: string;
  type: string;
  outletId: string | null;
  identifier: string | null;
  lastSeenAt: string | null;
}

export const devicesApi = {
  list: () => apiRequest<DeviceRow[]>('/devices'),
  create: (payload: {
    name: string;
    type: 'printer' | 'kds' | 'pos' | string;
    outletId?: string;
    identifier?: string;
  }) =>
    apiRequest<DeviceRow>('/devices', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
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
  activate: (id: string) =>
    apiRequest(`/users/${id}/activate`, { method: 'PATCH' }),
};

export const rolesApi = {
  list: () => apiRequest<Role[]>('/roles'),
};

export interface TenantSubscription {
  id: string;
  status: string;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  graceUntil: string | null;
  razorpaySubId: string | null;
  razorpayShortUrl: string | null;
  plan: {
    id: string;
    slug: string;
    name: string;
    priceMonthly: number | string;
  };
}

export const subscriptionsApi = {
  list: () => apiRequest<TenantSubscription[]>('/subscriptions'),
  checkout: () =>
    apiRequest<{
      organizationId: string;
      subscriptionId: string;
      razorpaySubId: string | null;
      shortUrl: string | null;
      status: string;
    }>('/subscriptions/checkout', { method: 'POST', body: JSON.stringify({}) }),
};

export interface PromoCustomerRecipient {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

export interface PromoCampaignResult {
  id: string;
  subject: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  status: string;
}

export const promoApi = {
  listCustomerRecipients: () =>
    apiRequest<PromoCustomerRecipient[]>('/promo/recipients/customers'),
  sendCampaign: (payload: { subject: string; body: string; customerIds?: string[] }) =>
    apiRequest<PromoCampaignResult>('/promo/campaigns', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

export interface PosOrderResult {
  id: string;
  orderNumber: string;
}

export interface QuickOrderItem {
  menuItemId: string;
  quantity: number;
}

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
    apiRequest<PosOrderResult>('/pos/quick-order', {
      method: 'POST',
      body: JSON.stringify({ ...payload, autoConfirm: payload.autoConfirm ?? true }),
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    }),

  holdOrder: (orderId: string) =>
    apiRequest<PosOrderResult>(`/pos/orders/${orderId}/hold`, { method: 'POST' }),

  resumeOrder: (orderId: string) =>
    apiRequest<PosOrderResult>(`/pos/orders/${orderId}/resume`, { method: 'POST' }),
};

export const paymentsApi = {
  payCash: (orderId: string) =>
    apiRequest<{ success: boolean; orderId: string }>('/payments/cash', {
      method: 'POST',
      body: JSON.stringify({ orderId }),
    }),

  createIntent: (orderId: string) =>
    apiRequest<{
      keyId?: string;
      razorpayOrderId: string;
      amountPaise: number;
      currency: string;
    }>('/payments/online/intent', {
      method: 'POST',
      body: JSON.stringify({ orderId }),
    }),

  verify: (payload: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }) =>
    apiRequest<{ success: boolean; orderId: string }>('/payments/online/verify', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

export { CULLINOS_BRAND };

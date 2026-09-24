import {
  CULLINOS_BRAND,
  mapStaffLoginResponse,
  resolveViteApiBase,
  type ApiStaffLoginResponse,
  type StaffAuthResponse,
} from '@cullinos/shared';
import type { ApiError, OrderStatus, PaginatedResponse } from '@cullinos/shared';
import { useAuthStore } from '../stores/auth';

const API_BASE = resolveViteApiBase({
  viteApiUrl: import.meta.env.VITE_API_URL,
  isProd: import.meta.env.PROD,
});
export { API_BASE };
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
  captchaToken?: string;
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
  state?: string | null;
  address?: string | null;
  pincode?: string | null;
  phone?: string | null;
  gstin?: string | null;
  operatingMode?: string;
  isActive: boolean;
  latitude?: number | null;
  longitude?: number | null;
  cuisineTags?: string[];
  coverImageUrl?: string | null;
  marketplaceListed?: boolean;
  averagePrepMinutes?: number | null;
  openingHours?: unknown;
  guestThemeKey?: string | null;
  primaryColor?: string | null;
  accentColor?: string | null;
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

export interface MenuItemVariant {
  id?: string;
  name: string;
  price: number;
  sku?: string | null;
  isDefault?: boolean;
  sortOrder?: number;
}

export interface MenuModifier {
  id?: string;
  name: string;
  price: number;
  isDefault?: boolean;
  sortOrder?: number;
}

export interface MenuModifierGroup {
  id?: string;
  name: string;
  minSelect?: number;
  maxSelect?: number;
  isRequired?: boolean;
  modifiers?: MenuModifier[];
}

export interface MenuItem {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  imageUrl?: string | null;
  basePrice: number;
  packagingCharge?: number;
  /** Soft-deleted items are omitted from list endpoints */
  isActive: boolean;
  onlineAvailable?: boolean;
  stockBasedAvailability?: boolean;
  isVeg?: boolean;
  isSpecial?: boolean;
  taxGroupId?: string | null;
  hsnCode?: string | null;
  sortOrder: number;
  variants?: MenuItemVariant[];
  modifierGroups?: MenuModifierGroup[];
}

export interface MenuSchedule {
  id: string;
  name: string;
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  categoryIds: string[];
  isActive: boolean;
}

export interface MenuCombo {
  id: string;
  name: string;
  price: number;
  isActive: boolean;
  items: Array<{
    id: string;
    menuItemId: string;
    menuItemName: string;
    quantity: number;
  }>;
}

export interface OutletMenuPriceRow {
  menuItemId: string;
  name: string;
  basePrice: number;
  packagingCharge: number;
  onlineAvailable: boolean;
  outletPrice: number | null;
  isAvailable: boolean;
}

export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  taxAmount?: number;
  lineTotal?: number;
  notes: string | null;
}

export interface OrderTaxLine {
  taxName: string;
  rate: number;
  amount: number;
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
  taxTotal?: number;
  discountTotal?: number;
  taxLines?: OrderTaxLine[];
  tipAmount?: number;
  tableName?: string | null;
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
  marketingEmailOptIn?: boolean;
  marketingSmsOptIn?: boolean;
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
  parentRecipeId?: string | null;
  yield: number | string;
  menuItem?: { id: string; name: string };
  ingredients?: Array<{
    id: string;
    quantity: number | string;
    inventoryItemId?: string | null;
    subRecipeId?: string | null;
    inventoryItem?: { id: string; name: string; unit: string } | null;
    subRecipe?: { id: string; menuItem?: { id: string; name: string } } | null;
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
  platformCapabilities?: {
    phoneMenuQrEnabled: boolean;
  };
}

export type LoginChallengeResponse = {
  requiresOtp: true;
  challengeToken: string;
};

export const authApi = {
  registerOwner: (payload: {
    companyName: string;
    ownerName: string;
    ownerEmail: string;
    ownerPhone?: string;
    captchaToken?: string;
  }) =>
    apiRequest<{
      success: boolean;
      organizationId: string;
      emailSent: boolean;
      smsSent: boolean;
      message: string;
    }>('/auth/register-owner', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, false),

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
  create: (data: {
    name: string;
    city?: string;
    phone?: string;
    gstin?: string;
    operatingMode?: string;
  }) => apiRequest<Outlet>('/outlets', { method: 'POST', body: JSON.stringify(data) }),
  update: (
    id: string,
    data: Partial<{
      name: string;
      phone: string;
      gstin: string | null;
      operatingMode: string;
      address: string;
      city: string;
      state: string;
      pincode: string;
      latitude: number | null;
      longitude: number | null;
      cuisineTags: string[];
      coverImageUrl: string | null;
      marketplaceListed: boolean;
      averagePrepMinutes: number | null;
      guestThemeKey: string | null;
      primaryColor: string | null;
      accentColor: string | null;
      openingHours: unknown;
    }>,
  ) => apiRequest<Outlet>(`/outlets/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  uploadCoverImage: async (id: string, file: File): Promise<{ coverImageUrl: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    const token = useAuthStore.getState().accessToken;
    const headers = new Headers();
    if (token) headers.set('Authorization', `Bearer ${token}`);
    const response = await fetch(`${API_BASE}/outlets/${id}/cover-upload`, {
      method: 'POST',
      headers,
      body: formData,
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw await parseError(response);
    return response.json() as Promise<{ coverImageUrl: string }>;
  },
  listPhotos: (id: string) =>
    apiRequest<OutletPhoto[]>(`/outlets/${id}/photos`),
  uploadPhoto: async (
    id: string,
    file: File,
    opts?: { caption?: string; setAsCover?: boolean },
  ): Promise<OutletPhoto> => {
    const formData = new FormData();
    formData.append('file', file);
    if (opts?.caption) formData.append('caption', opts.caption);
    if (opts?.setAsCover) formData.append('setAsCover', 'true');
    const token = useAuthStore.getState().accessToken;
    const headers = new Headers();
    if (token) headers.set('Authorization', `Bearer ${token}`);
    const response = await fetch(`${API_BASE}/outlets/${id}/photos/upload`, {
      method: 'POST',
      headers,
      body: formData,
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw await parseError(response);
    return response.json() as Promise<OutletPhoto>;
  },
  setPhotoCover: (id: string, photoId: string) =>
    apiRequest<{ coverImageUrl: string }>(`/outlets/${id}/photos/${photoId}/set-cover`, {
      method: 'POST',
    }),
  deletePhoto: (id: string, photoId: string) =>
    apiRequest<{ success: boolean }>(`/outlets/${id}/photos/${photoId}`, {
      method: 'DELETE',
    }),
};

export interface OutletPhoto {
  id: string;
  url: string;
  caption: string | null;
  sortOrder: number;
  createdAt?: string;
}

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
  language?: string | null;
  subscriptionStatus?: string | null;
  trialEndsAt?: string | null;
  trialExpired?: boolean;
  subscriptionActive?: boolean;
  planSlug?: string | null;
  planName?: string | null;
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
  trend: (params?: { outletId?: string; days?: number }) => {
    const search = new URLSearchParams();
    if (params?.outletId) search.set('outletId', params.outletId);
    if (params?.days) search.set('days', String(params.days));
    const qs = search.toString();
    return apiRequest<{
      from: string;
      to: string;
      days: Array<{ date: string; revenue: number; orders: number }>;
    }>(`/analytics/trend${qs ? `?${qs}` : ''}`);
  },
  outletComparison: (params?: { date?: string }) => {
    const search = new URLSearchParams();
    if (params?.date) search.set('date', params.date);
    const qs = search.toString();
    return apiRequest<
      Array<{
        outletId: string;
        outletName: string;
        revenue: number;
        orders: number;
        averageOrderValue: number;
      }>
    >(`/analytics/outlet-comparison${qs ? `?${qs}` : ''}`);
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
  getItem: (id: string) => apiRequest<MenuItem>(`/menu/items/${id}`),
  createItem: (payload: {
    categoryId: string;
    name: string;
    description?: string;
    imageUrl?: string | null;
    basePrice: number;
    packagingCharge?: number;
    onlineAvailable?: boolean;
    stockBasedAvailability?: boolean;
    isVeg?: boolean;
    isSpecial?: boolean;
    taxGroupId?: string | null;
    hsnCode?: string | null;
    variants?: MenuItemVariant[];
    modifierGroups?: MenuModifierGroup[];
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
      imageUrl: string | null;
      basePrice: number;
      packagingCharge: number;
      onlineAvailable: boolean;
      stockBasedAvailability: boolean;
      isVeg: boolean;
      isSpecial: boolean;
      taxGroupId: string | null;
      hsnCode: string | null;
      variants: MenuItemVariant[];
      modifierGroups: MenuModifierGroup[];
    }>,
  ) =>
    apiRequest<MenuItem>(`/menu/items/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  uploadItemImage: async (id: string, file: File): Promise<{ imageUrl: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    const token = useAuthStore.getState().accessToken;
    const headers = new Headers();
    if (token) headers.set('Authorization', `Bearer ${token}`);
    const response = await fetch(`${API_BASE}/menu/items/${id}/image-upload`, {
      method: 'POST',
      headers,
      body: formData,
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw await parseError(response);
    return response.json() as Promise<{ imageUrl: string }>;
  },
  deleteItem: (id: string) => apiRequest<void>(`/menu/items/${id}`, { method: 'DELETE' }),

  listSchedules: () => apiRequest<MenuSchedule[]>('/menu/schedules'),
  createSchedule: (payload: {
    name: string;
    daysOfWeek: number[];
    startTime: string;
    endTime: string;
    categoryIds: string[];
  }) =>
    apiRequest<MenuSchedule>('/menu/schedules', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateSchedule: (
    id: string,
    payload: Partial<{
      name: string;
      daysOfWeek: number[];
      startTime: string;
      endTime: string;
      categoryIds: string[];
      isActive: boolean;
    }>,
  ) =>
    apiRequest<MenuSchedule>(`/menu/schedules/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteSchedule: (id: string) =>
    apiRequest<void>(`/menu/schedules/${id}`, { method: 'DELETE' }),

  listCombos: () => apiRequest<MenuCombo[]>('/menu/combos'),
  createCombo: (payload: {
    name: string;
    price: number;
    isActive?: boolean;
    items: Array<{ menuItemId: string; quantity?: number }>;
  }) =>
    apiRequest<MenuCombo>('/menu/combos', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateCombo: (
    id: string,
    payload: Partial<{
      name: string;
      price: number;
      isActive: boolean;
      items: Array<{ menuItemId: string; quantity?: number }>;
    }>,
  ) =>
    apiRequest<MenuCombo>(`/menu/combos/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteCombo: (id: string) => apiRequest<void>(`/menu/combos/${id}`, { method: 'DELETE' }),

  listOutletPrices: (outletId: string) =>
    apiRequest<OutletMenuPriceRow[]>(`/menu/outlets/${outletId}/prices`),
  setOutletPrice: (
    outletId: string,
    menuItemId: string,
    payload: { price: number; isAvailable?: boolean },
  ) =>
    apiRequest(`/menu/outlets/${outletId}/items/${menuItemId}/prices`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getOutletMenu: (outletId: string) =>
    apiRequest<{
      outletId: string;
      categories: MenuCategory[];
      items: Array<MenuItem & { price: number; packagingCharge?: number; isAvailable: boolean }>;
    }>(`/menu/outlets/${outletId}`),
};

export const ordersApi = {
  list: (params?: {
    outletId?: string;
    status?: OrderStatus | OrderStatus[];
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }) => {
    const search = new URLSearchParams();
    if (params?.outletId) search.set('outletId', params.outletId);
    if (params?.status) {
      search.set('status', Array.isArray(params.status) ? params.status.join(',') : params.status);
    }
    if (params?.from) search.set('from', params.from);
    if (params?.to) search.set('to', params.to);
    if (params?.page) search.set('page', String(params.page));
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
  create: (payload: {
    name: string;
    phone?: string;
    email?: string;
    marketingEmailOptIn?: boolean;
    marketingSmsOptIn?: boolean;
  }) =>
    apiRequest<Customer>('/customers', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  update: (
    id: string,
    payload: {
      name?: string;
      phone?: string;
      email?: string;
      marketingEmailOptIn?: boolean;
      marketingSmsOptIn?: boolean;
    },
  ) =>
    apiRequest<Customer>(`/customers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  export: (id: string) => apiRequest<unknown>(`/customers/${id}/export`),
  erase: (id: string) =>
    apiRequest<{ id: string; anonymizedAt: string | null; message: string }>(
      `/customers/${id}/erase`,
      { method: 'POST' },
    ),
};

export const recipesApi = {
  list: () => apiRequest<RecipeRow[]>('/recipes'),
  get: (id: string) => apiRequest<RecipeRow>(`/recipes/${id}`),
  create: (payload: {
    menuItemId: string;
    name?: string;
    yieldQty?: number;
    parentRecipeId?: string | null;
    ingredients: Array<{
      inventoryItemId?: string | null;
      subRecipeId?: string | null;
      quantity: number;
      unit?: string;
    }>;
  }) =>
    apiRequest<RecipeRow>('/recipes', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  update: (
    id: string,
    payload: {
      yieldQty?: number;
      parentRecipeId?: string | null;
      ingredients?: Array<{
        inventoryItemId?: string | null;
        subRecipeId?: string | null;
        quantity: number;
      }>;
    },
  ) =>
    apiRequest<RecipeRow>(`/recipes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  remove: (id: string) =>
    apiRequest<{ ok: boolean }>(`/recipes/${id}`, { method: 'DELETE' }),
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
  updateOrderStatus: (
    orderId: string,
    payload: {
      status: string;
      driverName?: string;
      driverPhone?: string;
      estimatedAt?: string;
    },
  ) =>
    apiRequest(`/delivery/orders/${orderId}`, {
      method: 'PATCH',
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
  eraseGuest: (id: string) =>
    apiRequest<{ id: string; anonymizedAt: string | null; message: string }>(
      `/hospitality/guests/${id}/erase`,
      { method: 'POST' },
    ),
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
  qrUrl?: string | null;
  section: {
    id: string;
    name: string;
    floor?: { id: string; name: string; sortOrder: number } | null;
  } | null;
}

export interface FloorPlanFloor {
  id: string;
  outletId: string;
  name: string;
  sortOrder: number;
  sections: Array<{
    id: string;
    name: string;
    sortOrder: number;
    tableCount: number;
  }>;
}

export const tablesApi = {
  listByOutlet: (outletId: string) =>
    apiRequest<DiningTable[]>(`/tables/outlets/${outletId}`),
  listFloors: (outletId: string) =>
    apiRequest<FloorPlanFloor[]>(`/tables/outlets/${outletId}/floors`),
  createFloor: (outletId: string, payload: { name: string; sortOrder?: number }) =>
    apiRequest<FloorPlanFloor>(`/tables/outlets/${outletId}/floors`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateFloor: (
    outletId: string,
    floorId: string,
    payload: { name?: string; sortOrder?: number },
  ) =>
    apiRequest<FloorPlanFloor>(`/tables/outlets/${outletId}/floors/${floorId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteFloor: (outletId: string, floorId: string) =>
    apiRequest<{ id: string; deleted: boolean }>(`/tables/outlets/${outletId}/floors/${floorId}`, {
      method: 'DELETE',
    }),
  createSection: (
    outletId: string,
    floorId: string,
    payload: { name: string; sortOrder?: number },
  ) =>
    apiRequest(`/tables/outlets/${outletId}/floors/${floorId}/sections`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  create: (payload: {
    outletId: string;
    name: string;
    capacity?: number;
    sectionName?: string;
    floorId?: string;
    sectionId?: string;
    floorName?: string;
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
  update: (
    outletId: string,
    tableId: string,
    payload: {
      name?: string;
      capacity?: number;
      floorId?: string;
      sectionId?: string;
      sectionName?: string;
      floorName?: string;
    },
  ) =>
    apiRequest<DiningTable>(`/tables/outlets/${outletId}/${tableId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  remove: (outletId: string, tableId: string) =>
    apiRequest<{ success: boolean; id: string }>(`/tables/outlets/${outletId}/${tableId}`, {
      method: 'DELETE',
    }),
  regenerateQr: (outletId: string, tableId: string) =>
    apiRequest<DiningTable>(`/tables/outlets/${outletId}/${tableId}/regenerate-qr`, {
      method: 'POST',
    }),
  merge: (outletId: string, primaryTableId: string, tableIds: string[]) =>
    apiRequest(`/tables/outlets/${outletId}/merge`, {
      method: 'POST',
      body: JSON.stringify({ primaryTableId, tableIds }),
    }),
  transfer: (outletId: string, fromTableId: string, toTableId: string) =>
    apiRequest(`/tables/outlets/${outletId}/transfer`, {
      method: 'POST',
      body: JSON.stringify({ fromTableId, toTableId }),
    }),
};

export interface InventoryItemRow {
  id: string;
  name: string;
  sku: string | null;
  unit: string;
  currentStock: number;
  reorderLevel?: number;
  costPerUnit?: number;
  outletId?: string | null;
}

export interface InventoryLotRow {
  id: string;
  qtyRemaining: number;
  unitCost: number;
  receivedAt: string;
  expiryDate: string | null;
  grnItemId: string | null;
}

export const inventoryApi = {
  listItems: () => apiRequest<InventoryItemRow[]>('/inventory/items'),
  listLowStock: () => apiRequest<InventoryItemRow[]>('/inventory/low-stock'),
  listLots: (itemId: string) =>
    apiRequest<InventoryLotRow[]>(`/inventory/items/${itemId}/lots`),
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
  updateItem: (
    id: string,
    payload: { name?: string; sku?: string; unit?: string; currentStock?: number; reorderLevel?: number },
  ) =>
    apiRequest<InventoryItemRow>(`/inventory/items/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteItem: (id: string) =>
    apiRequest<{ id: string; deleted: boolean }>(`/inventory/items/${id}`, { method: 'DELETE' }),
  adjust: (
    id: string,
    payload: { quantity: number; type: 'in' | 'out' | 'waste'; notes?: string },
  ) =>
    apiRequest<InventoryItemRow>(`/inventory/items/${id}/adjust`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  transfer: (payload: {
    fromOutletId: string;
    toOutletId: string;
    inventoryItemId: string;
    quantity: number;
    notes?: string;
  }) =>
    apiRequest<{ id: string }>('/inventory/transfers', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

export interface SupplierRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
}

export interface PurchaseOrderRow {
  id: string;
  poNumber: string;
  status: string;
  total: number | string;
  orderedAt: string | null;
  createdAt: string;
  supplier?: { id: string; name: string };
  items?: Array<{
    id: string;
    name: string;
    quantity: number | string;
    unitPrice: number | string;
    inventoryItemId: string | null;
  }>;
  grns?: Array<{ id: string; grnNumber: string; status: string }>;
}

export interface WastageRow {
  id: string;
  quantity: number | string;
  reason: string | null;
  recordedAt: string;
  inventoryItem?: { id: string; name: string; unit: string };
}

export const purchasingApi = {
  list: () => apiRequest<PurchaseOrderRow[]>('/purchasing'),
  get: (id: string) => apiRequest<PurchaseOrderRow>(`/purchasing/${id}`),
  create: (payload: {
    supplierId: string;
    items: Array<{
      inventoryItemId?: string;
      name: string;
      quantity: number;
      unitPrice: number;
    }>;
  }) =>
    apiRequest<PurchaseOrderRow>('/purchasing', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  send: (id: string) =>
    apiRequest<PurchaseOrderRow>(`/purchasing/${id}/send`, { method: 'POST' }),
  createGrn: (
    poId: string,
    payload: {
      items: Array<{
        inventoryItemId?: string;
        quantity: number;
        unitPrice: number;
      }>;
    },
  ) =>
    apiRequest<{ id: string; grnNumber: string; status: string }>(`/purchasing/${poId}/grn`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  confirmGrn: (grnId: string) =>
    apiRequest<{ id: string; status: string }>(`/purchasing/grn/${grnId}/confirm`, {
      method: 'POST',
    }),
  listSuppliers: () => apiRequest<SupplierRow[]>('/purchasing/suppliers'),
  createSupplier: (payload: {
    name: string;
    email?: string;
    phone?: string;
    address?: string;
  }) =>
    apiRequest<SupplierRow>('/purchasing/suppliers', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateSupplier: (
    id: string,
    payload: { name?: string; email?: string; phone?: string; address?: string },
  ) =>
    apiRequest<SupplierRow>(`/purchasing/suppliers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteSupplier: (id: string) =>
    apiRequest<{ ok: boolean }>(`/purchasing/suppliers/${id}`, { method: 'DELETE' }),
};

export const wastageApi = {
  list: (outletId?: string) => {
    const qs = outletId ? `?outletId=${encodeURIComponent(outletId)}` : '';
    return apiRequest<WastageRow[]>(`/wastage${qs}`);
  },
  create: (payload: {
    inventoryItemId: string;
    quantity: number;
    reason?: string;
    outletId?: string;
  }) =>
    apiRequest<WastageRow>('/wastage', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

export interface CentralKitchenRow {
  id: string;
  name: string;
  outletId: string;
  isActive: boolean;
  outlet?: { id: string; name: string };
  linkedOutlets?: Array<{ outlet: { id: string; name: string } }>;
}

export interface CentralKitchenIndentRow {
  id: string;
  status: string;
  notes: string | null;
  routeCode?: string | null;
  sequence?: number | null;
  fulfilledAt: string | null;
  createdAt: string;
  requestingOutlet?: { id: string; name: string; city?: string | null; zone?: string | null };
  centralKitchen?: { id: string; name: string };
  items?: Array<{
    id: string;
    quantity: number | string;
    inventoryItem?: { id: string; name: string; unit: string };
  }>;
}

export const centralKitchenApi = {
  list: () => apiRequest<CentralKitchenRow[]>('/central-kitchen'),
  create: (payload: {
    outletId: string;
    name: string;
    linkedOutletIds?: string[];
  }) =>
    apiRequest<CentralKitchenRow>('/central-kitchen', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateLinks: (id: string, linkedOutletIds: string[]) =>
    apiRequest<CentralKitchenRow>(`/central-kitchen/${id}/links`, {
      method: 'PATCH',
      body: JSON.stringify({ linkedOutletIds }),
    }),
  listIndents: (centralKitchenId?: string) => {
    const qs = centralKitchenId
      ? `?centralKitchenId=${encodeURIComponent(centralKitchenId)}`
      : '';
    return apiRequest<CentralKitchenIndentRow[]>(`/central-kitchen/indents${qs}`);
  },
  planRoutes: (centralKitchenId?: string) =>
    apiRequest<CentralKitchenIndentRow[]>('/central-kitchen/indents/plan-routes', {
      method: 'POST',
      body: JSON.stringify({ centralKitchenId }),
    }),
  createIndent: (payload: {
    centralKitchenId: string;
    requestingOutletId: string;
    notes?: string;
    items: Array<{ inventoryItemId: string; quantity: number }>;
  }) =>
    apiRequest<CentralKitchenIndentRow>('/central-kitchen/indents', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  fulfillIndent: (id: string) =>
    apiRequest<CentralKitchenIndentRow>(`/central-kitchen/indents/${id}/fulfill`, {
      method: 'POST',
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

export interface CouponRow {
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
}

export const couponsApi = {
  list: () => apiRequest<CouponRow[]>('/coupons'),
  create: (payload: Record<string, unknown>) =>
    apiRequest<CouponRow>('/coupons', { method: 'POST', body: JSON.stringify(payload) }),
  update: (id: string, payload: Record<string, unknown>) =>
    apiRequest<CouponRow>(`/coupons/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deactivate: (id: string) =>
    apiRequest<CouponRow>(`/coupons/${id}/deactivate`, { method: 'POST' }),
  remove: (id: string) =>
    apiRequest<{ success: boolean; id: string }>(`/coupons/${id}`, { method: 'DELETE' }),
  uploadImage: async (file: File): Promise<{ imageUrl: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    const token = useAuthStore.getState().accessToken;
    const headers = new Headers();
    if (token) headers.set('Authorization', `Bearer ${token}`);
    const response = await fetch(`${API_BASE}/coupons/upload-image`, {
      method: 'POST',
      headers,
      body: formData,
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw await parseError(response);
    return response.json() as Promise<{ imageUrl: string }>;
  },
  validate: (code: string, orderTotal: number) =>
    apiRequest<{ coupon: CouponRow; discountAmount: number }>('/coupons/validate', {
      method: 'POST',
      body: JSON.stringify({ code, orderTotal }),
    }),
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

export const guestMarketingApi = {
  listBanners: () => apiRequest<GuestBannerRow[]>('/guest-marketing/banners'),
  createBanner: (payload: Record<string, unknown>) =>
    apiRequest<GuestBannerRow>('/guest-marketing/banners', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateBanner: (id: string, payload: Record<string, unknown>) =>
    apiRequest<GuestBannerRow>(`/guest-marketing/banners/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteBanner: (id: string) =>
    apiRequest<{ success: boolean }>(`/guest-marketing/banners/${id}`, {
      method: 'DELETE',
    }),
  uploadBannerImage: async (file: File): Promise<{ imageUrl: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    const token = useAuthStore.getState().accessToken;
    const headers = new Headers();
    if (token) headers.set('Authorization', `Bearer ${token}`);
    const response = await fetch(`${API_BASE}/guest-marketing/banners/upload-image`, {
      method: 'POST',
      headers,
      body: formData,
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw await parseError(response);
    return response.json() as Promise<{ imageUrl: string }>;
  },
  listCampaigns: () =>
    apiRequest<GuestPushCampaignRow[]>('/guest-marketing/push-campaigns'),
  sendCampaign: (payload: { title: string; body: string; data?: Record<string, string> }) =>
    apiRequest<GuestPushCampaignRow>('/guest-marketing/push-campaigns', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

export interface AggregatorOutletConfigRow {
  connected: boolean;
  menuSyncEnabled: boolean;
  externalStoreId?: string;
}

export interface AggregatorProviderRow {
  provider: 'swiggy' | 'zomato';
  isActive: boolean;
  integrationId: string | null;
  webhookSecret: string | null;
  webhookSecretFingerprint?: string | null;
  webhookPath: string;
  outlets: Record<string, AggregatorOutletConfigRow>;
}

export interface AggregatorReconciliationRow {
  id: string;
  provider: string;
  externalOrderId: string;
  orderDate: string;
  outletName: string | null;
  orderNumber: string | null;
  grossAmount: number;
  commission: number;
  payout: number;
  posTotal: number | null;
  variance: number | null;
  matched: boolean;
}

export const aggregatorsApi = {
  list: () => apiRequest<AggregatorProviderRow[]>('/aggregators'),
  get: (provider: 'swiggy' | 'zomato') =>
    apiRequest<AggregatorProviderRow>(`/aggregators/${provider}`),
  upsert: (
    provider: 'swiggy' | 'zomato',
    payload: {
      isActive?: boolean;
      webhookSecret?: string;
      outlets?: Record<string, AggregatorOutletConfigRow>;
    },
  ) =>
    apiRequest<AggregatorProviderRow>(`/aggregators/${provider}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  regenerateWebhookSecret: (provider: 'swiggy' | 'zomato') =>
    apiRequest<AggregatorProviderRow>(`/aggregators/${provider}/regenerate-webhook-secret`, {
      method: 'POST',
    }),
  updateOutlet: (
    provider: 'swiggy' | 'zomato',
    outletId: string,
    payload: { connected?: boolean; menuSyncEnabled?: boolean },
  ) =>
    apiRequest<AggregatorProviderRow>(`/aggregators/${provider}/outlets/${outletId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  syncMenu: (provider: 'swiggy' | 'zomato', outletId: string) =>
    apiRequest<{ synced: number; skipped: number; message?: string }>(
      `/aggregators/${provider}/outlets/${outletId}/menu-sync`,
      { method: 'POST' },
    ),
  importSettlements: (payload: { format?: 'csv' | 'json'; csv?: string; rows?: unknown[] }) =>
    apiRequest<{ batchId: string; imported: number; skipped: number; total: number }>(
      '/aggregators/settlements/import',
      { method: 'POST', body: JSON.stringify(payload) },
    ),
  reconciliation: (params?: {
    from?: string;
    to?: string;
    outletId?: string;
    provider?: string;
  }) => {
    const search = new URLSearchParams();
    if (params?.from) search.set('from', params.from);
    if (params?.to) search.set('to', params.to);
    if (params?.outletId) search.set('outletId', params.outletId);
    if (params?.provider) search.set('provider', params.provider);
    const qs = search.toString();
    return apiRequest<{
      from: string;
      to: string;
      summary: {
        count: number;
        matched: number;
        unmatched: number;
        totalGross: number;
        totalCommission: number;
        totalPayout: number;
        totalVariance: number;
      };
      rows: AggregatorReconciliationRow[];
    }>(`/aggregators/reconciliation${qs ? `?${qs}` : ''}`);
  },
};

export const reportsApi = {
  smbSummary: (params?: { outletId?: string; date?: string }) => {
    const search = new URLSearchParams();
    if (params?.outletId) search.set('outletId', params.outletId);
    if (params?.date) search.set('date', params.date);
    const qs = search.toString();
    return apiRequest<Record<string, unknown>>(`/reports/smb-summary${qs ? `?${qs}` : ''}`);
  },
  export: (params?: { from?: string; to?: string; outletId?: string }) => {
    const search = new URLSearchParams();
    if (params?.from) search.set('from', params.from);
    if (params?.to) search.set('to', params.to);
    if (params?.outletId) search.set('outletId', params.outletId);
    const qs = search.toString();
    return apiRequest<{
      from: string;
      to: string;
      count: number;
      rows: Array<Record<string, unknown>>;
    }>(`/reports/export${qs ? `?${qs}` : ''}`);
  },
  items: (params?: { outletId?: string; from?: string; to?: string }) => {
    const search = new URLSearchParams();
    if (params?.outletId) search.set('outletId', params.outletId);
    if (params?.from) search.set('from', params.from);
    if (params?.to) search.set('to', params.to);
    const qs = search.toString();
    return apiRequest<{
      from: string;
      to: string;
      items: Array<{ name: string; quantity: number; revenue: number }>;
      totalItems: number;
      totalRevenue: number;
    }>(`/reports/items${qs ? `?${qs}` : ''}`);
  },
  categories: (params?: { outletId?: string; from?: string; to?: string }) => {
    const search = new URLSearchParams();
    if (params?.outletId) search.set('outletId', params.outletId);
    if (params?.from) search.set('from', params.from);
    if (params?.to) search.set('to', params.to);
    const qs = search.toString();
    return apiRequest<{
      from: string;
      to: string;
      categories: Array<{ category: string; quantity: number; revenue: number }>;
    }>(`/reports/categories${qs ? `?${qs}` : ''}`);
  },
  paymentMethods: (params?: { outletId?: string; from?: string; to?: string }) => {
    const search = new URLSearchParams();
    if (params?.outletId) search.set('outletId', params.outletId);
    if (params?.from) search.set('from', params.from);
    if (params?.to) search.set('to', params.to);
    const qs = search.toString();
    return apiRequest<{
      from: string;
      to: string;
      methods: Array<{ method: string; count: number; amount: number }>;
    }>(`/reports/payment-methods${qs ? `?${qs}` : ''}`);
  },
  discounts: (params?: { outletId?: string; from?: string; to?: string }) => {
    const search = new URLSearchParams();
    if (params?.outletId) search.set('outletId', params.outletId);
    if (params?.from) search.set('from', params.from);
    if (params?.to) search.set('to', params.to);
    const qs = search.toString();
    return apiRequest<{
      from: string;
      to: string;
      orderCount: number;
      totalDiscount: number;
      byType: Array<{ type: string; count: number; amount: number }>;
    }>(`/reports/discounts${qs ? `?${qs}` : ''}`);
  },
  cancellations: (params?: { outletId?: string; from?: string; to?: string }) => {
    const search = new URLSearchParams();
    if (params?.outletId) search.set('outletId', params.outletId);
    if (params?.from) search.set('from', params.from);
    if (params?.to) search.set('to', params.to);
    const qs = search.toString();
    return apiRequest<{
      from: string;
      to: string;
      count: number;
      lostRevenue: number;
      byStatus: Array<{ status: string; count: number }>;
      orders: Array<Record<string, unknown>>;
    }>(`/reports/cancellations${qs ? `?${qs}` : ''}`);
  },
  foodCost: (params?: { outletId?: string; from?: string; to?: string }) => {
    const search = new URLSearchParams();
    if (params?.outletId) search.set('outletId', params.outletId);
    if (params?.from) search.set('from', params.from);
    if (params?.to) search.set('to', params.to);
    const qs = search.toString();
    return apiRequest<{
      from: string;
      to: string;
      items: Array<{
        name: string;
        qtySold: number;
        revenue: number;
        ingredientCost: number;
        foodCostPct: number;
      }>;
    }>(`/reports/food-cost${qs ? `?${qs}` : ''}`);
  },
  taxCollection: (params?: { outletId?: string; from?: string; to?: string }) => {
    const search = new URLSearchParams();
    if (params?.outletId) search.set('outletId', params.outletId);
    if (params?.from) search.set('from', params.from);
    if (params?.to) search.set('to', params.to);
    const qs = search.toString();
    return apiRequest<{
      from: string;
      to: string;
      days: Array<{
        date: string;
        cgst: number;
        sgst: number;
        igst: number;
        excise: number;
        other: number;
        total: number;
      }>;
      totals: {
        cgst: number;
        sgst: number;
        igst: number;
        excise: number;
        other: number;
        total: number;
      };
    }>(`/reports/tax-collection${qs ? `?${qs}` : ''}`);
  },
  salesByTaxGroup: (params?: { outletId?: string; from?: string; to?: string }) => {
    const search = new URLSearchParams();
    if (params?.outletId) search.set('outletId', params.outletId);
    if (params?.from) search.set('from', params.from);
    if (params?.to) search.set('to', params.to);
    const qs = search.toString();
    return apiRequest<{
      from: string;
      to: string;
      groups: Array<{
        taxGroupId: string | null;
        taxGroupName: string;
        quantity: number;
        revenue: number;
        tax: number;
      }>;
    }>(`/reports/sales-by-tax-group${qs ? `?${qs}` : ''}`);
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
  updateGroup: (
    id: string,
    payload: {
      name?: string;
      rates?: Array<{ name: string; rate: number; type?: string }>;
      isInclusive?: boolean;
    },
  ) =>
    apiRequest<TaxGroupRow>(`/tax/groups/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteGroup: (id: string) =>
    apiRequest<{ ok: boolean }>(`/tax/groups/${id}`, { method: 'DELETE' }),
  ensurePresets: () =>
    apiRequest<{ created: string[]; groups: TaxGroupRow[] }>(
      '/tax/groups/ensure-presets',
      { method: 'POST' },
    ),
};

export interface DeviceRow {
  id: string;
  name: string;
  type: string;
  outletId: string | null;
  identifier: string | null;
  lastSeenAt: string | null;
  metadata?: {
    connectionType?: 'wifi' | 'bluetooth' | 'usb' | string;
    paperWidthMm?: number;
    printCategories?: Array<'kitchen' | 'bar' | 'billing' | string>;
    [key: string]: unknown;
  } | null;
}

export interface PrintJobRow {
  id: string;
  outletId: string | null;
  deviceId: string | null;
  orderId: string | null;
  kind: string;
  status: string;
  error: string | null;
  payloadSummary: string | null;
  createdAt: string;
  device?: { id: string; name: string; type: string } | null;
}

export type PrintProfileRow = {
  kind: 'receipt' | 'kot';
  outletId: string;
  paperWidthMm: number;
  fontSize: 'small' | 'normal' | 'large';
  headerText?: string;
  footerText?: string;
  showLogo: boolean;
  showTaxBreakdown: boolean;
  copies: number;
  cutPaper: boolean;
  deviceId?: string | null;
};

export const devicesApi = {
  list: (opts?: { includeVirtual?: boolean }) => {
    const qs = opts?.includeVirtual ? '?includeVirtual=1' : '';
    return apiRequest<DeviceRow[]>(`/devices${qs}`);
  },
  create: (payload: {
    name: string;
    type: 'printer' | 'kds' | 'pos' | string;
    outletId?: string;
    identifier?: string;
    metadata?: Record<string, unknown>;
  }) =>
    apiRequest<DeviceRow>('/devices', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  update: (
    id: string,
    payload: {
      name?: string;
      type?: string;
      outletId?: string | null;
      identifier?: string | null;
      metadata?: Record<string, unknown>;
    },
  ) =>
    apiRequest<DeviceRow>(`/devices/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  remove: (id: string) =>
    apiRequest<{ ok: boolean }>(`/devices/${id}`, { method: 'DELETE' }),
  createPairingSession: (payload: {
    type?: string;
    outletId?: string;
    nameHint?: string;
  }) =>
    apiRequest<{ code: string; expiresInSeconds: number; qrPayload: string }>(
      '/devices/pairing-sessions',
      { method: 'POST', body: JSON.stringify(payload) },
    ),
  claimPairing: (payload: { code: string; name?: string; platform?: string }) =>
    apiRequest<{ device: DeviceRow; token: string }>('/devices/pair', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  listPrintJobs: (status?: string) => {
    const qs = status ? `?status=${encodeURIComponent(status)}` : '';
    return apiRequest<PrintJobRow[]>(`/devices/print-jobs${qs}`);
  },
  createPrintJob: (payload: {
    outletId?: string;
    deviceId?: string;
    orderId?: string;
    kind?: string;
    status?: 'pending' | 'sent' | 'failed' | 'done';
    error?: string;
    payloadSummary?: string;
  }) =>
    apiRequest<PrintJobRow>('/devices/print-jobs', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updatePrintJob: (id: string, payload: { status?: string; error?: string | null }) =>
    apiRequest<PrintJobRow>(`/devices/print-jobs/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  /** Stamp lastSeenAt for an authenticated display (e.g. KDS). */
  displayHeartbeat: (outletId: string, mode: 'kds' | 'cds' | 'pickup' | 'playlist') =>
    apiRequest<{ ok: boolean }>('/devices/display-heartbeat', {
      method: 'POST',
      body: JSON.stringify({ outletId, mode }),
    }),
  printProfiles: (outletId: string) =>
    apiRequest<{ outletId: string; receipt: PrintProfileRow; kot: PrintProfileRow }>(
      `/devices/print-profiles?outletId=${encodeURIComponent(outletId)}`,
    ),
  updatePrintProfile: (
    kind: 'receipt' | 'kot',
    outletId: string,
    payload: Partial<Omit<PrintProfileRow, 'kind' | 'outletId'>>,
  ) =>
    apiRequest<PrintProfileRow>(
      `/devices/print-profiles/${kind}?outletId=${encodeURIComponent(outletId)}`,
      { method: 'PUT', body: JSON.stringify(payload) },
    ),
};

export const erpExportApi = {
  dayBook: (params: { outletId: string; date?: string; format?: 'csv' | 'xml' }) => {
    const search = new URLSearchParams();
    search.set('outletId', params.outletId);
    if (params.date) search.set('date', params.date);
    if (params.format) search.set('format', params.format);
    return apiRequest<{
      date: string;
      outletId: string;
      outletName: string;
      format: 'csv' | 'xml';
      filename: string;
      mimeType: string;
      content: string;
      rowCount: number;
    }>(`/erp-export/day-book?${search.toString()}`);
  },
};

export interface StaffUser {
  id: string;
  email: string;
  name: string;
  phone?: string | null;
  status: string;
  roles: Array<{ id: string; slug: string; name: string }>;
  outlets: Array<{ id: string; name: string; isDefault?: boolean }>;
  defaultOutletId?: string | null;
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
    defaultOutletId?: string;
    phone?: string;
  }) =>
    apiRequest<StaffUser>('/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  update: (
    id: string,
    payload: { name?: string; phone?: string | null; roleSlug?: string },
  ) =>
    apiRequest<Pick<StaffUser, 'id' | 'email' | 'name' | 'phone' | 'status'>>(`/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deactivate: (id: string) =>
    apiRequest(`/users/${id}/deactivate`, { method: 'PATCH' }),
  activate: (id: string) =>
    apiRequest(`/users/${id}/activate`, { method: 'PATCH' }),
  delete: (id: string) =>
    apiRequest<{ success: boolean; id: string }>(`/users/${id}`, { method: 'DELETE' }),
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
  plans: () =>
    apiRequest<
      Array<{
        id: string;
        slug: string;
        name: string;
        description: string | null;
        priceMonthly: number;
        priceYearly: number;
        maxOutlets: number;
      }>
    >('/subscriptions/plans', {}, false),
  checkout: () =>
    apiRequest<{
      organizationId: string;
      subscriptionId: string;
      razorpaySubId: string | null;
      shortUrl: string | null;
      status: string;
    }>('/subscriptions/checkout', { method: 'POST', body: JSON.stringify({}) }),
  activatePlan: (planSlug: string) =>
    apiRequest<{
      organizationId: string;
      subscriptionId: string;
      razorpaySubId: string | null;
      shortUrl: string | null;
      status: string;
    }>('/subscriptions/activate-plan', {
      method: 'POST',
      body: JSON.stringify({ planSlug }),
    }),
};

export interface PromoCustomerRecipient {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

export interface PromoCampaignResult {
  id: string;
  subject?: string;
  body?: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  chargedPaise?: number;
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
  listSmsRecipients: () =>
    apiRequest<Array<PromoCustomerRecipient & { marketingSmsOptIn?: boolean }>>(
      '/promo/recipients/sms',
    ),
  listSmsCampaigns: () =>
    apiRequest<
      Array<{
        id: string;
        body: string;
        recipientCount: number;
        sentCount: number;
        failedCount: number;
        chargedPaise?: number;
        status: string;
        createdAt: string;
      }>
    >('/promo/sms-campaigns'),
  sendSmsCampaign: (payload: { body: string; customerIds?: string[] }) =>
    apiRequest<PromoCampaignResult>('/promo/sms-campaigns', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

export const walletApi = {
  get: () =>
    apiRequest<{
      balancePaise: number;
      balanceRupees: number;
      pricePer100Paise: number;
      pricePer100Rupees: number;
      updatedAt: string;
    }>('/wallet'),
  ledger: (take = 50) =>
    apiRequest<
      Array<{
        id: string;
        type: string;
        amountPaise: number;
        balanceAfter: number;
        note: string | null;
        createdAt: string;
      }>
    >(`/wallet/ledger?take=${take}`),
  smsEstimate: (recipients: number) =>
    apiRequest<{
      recipients: number;
      estimatePaise: number;
      pricePer100Paise: number;
      balancePaise: number;
      balanceRupees: number;
      canAfford: boolean;
    }>(`/wallet/sms-estimate?recipients=${recipients}`),
  createTopUp: (amountRupees: number) =>
    apiRequest<{
      orderId: string;
      amountPaise: number;
      amountRupees: number;
      currency: string;
      keyId: string | undefined;
    }>('/wallet/top-up', {
      method: 'POST',
      body: JSON.stringify({ amountRupees }),
    }),
  confirmTopUp: (payload: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }) =>
    apiRequest<{
      balancePaise: number;
      balanceRupees: number;
      alreadyCredited?: boolean;
    }>('/wallet/top-up/confirm', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

export interface ReservationRow {
  id: string;
  outletId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  partySize: number;
  reservedAt: string;
  status: string;
  notes: string | null;
  bookingToken: string;
  outlet?: { id: string; name: string };
  table?: { id: string; name: string } | null;
  emailSent?: boolean;
  smsSent?: boolean;
}

export interface ReservationSlot {
  startAt: string;
  endAt: string;
  coversBooked: number;
  coversAvailable: number;
  available: boolean;
}

export interface ReservationSlotsResult {
  outletId: string;
  outletName: string;
  date: string;
  reservationSlotMinutes: number;
  reservationMaxCoversPerSlot: number;
  slots: ReservationSlot[];
}

export const reservationsApi = {
  list: (params?: { outletId?: string; from?: string; to?: string }) => {
    const search = new URLSearchParams();
    if (params?.outletId) search.set('outletId', params.outletId);
    if (params?.from) search.set('from', params.from);
    if (params?.to) search.set('to', params.to);
    const qs = search.toString();
    return apiRequest<ReservationRow[]>(`/reservations${qs ? `?${qs}` : ''}`);
  },
  create: (payload: {
    outletId: string;
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    partySize: number;
    reservedAt: string;
    tableId?: string;
    notes?: string;
    status?: string;
  }) =>
    apiRequest<ReservationRow>('/reservations', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  update: (
    id: string,
    payload: Partial<{
      customerName: string;
      customerPhone: string;
      partySize: number;
      reservedAt: string;
      status: string;
      notes: string;
    }>,
  ) =>
    apiRequest<ReservationRow>(`/reservations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  remove: (id: string) =>
    apiRequest<{ success: boolean; id: string }>(`/reservations/${id}`, { method: 'DELETE' }),
  bookLink: (orgSlug: string, outletSlug: string) =>
    apiRequest<{ url: string }>(
      `/reservations/book-link?orgSlug=${encodeURIComponent(orgSlug)}&outletSlug=${encodeURIComponent(outletSlug)}`,
    ),
  slots: (params: { outletId: string; date: string; partySize?: number }) => {
    const search = new URLSearchParams({
      outletId: params.outletId,
      date: params.date,
    });
    if (params.partySize) search.set('partySize', String(params.partySize));
    return apiRequest<ReservationSlotsResult>(`/reservations/slots?${search}`);
  },
  getSettings: (outletId: string) =>
    apiRequest<{
      outletId: string;
      reservationSlotMinutes: number;
      reservationMaxCoversPerSlot: number;
    }>(`/reservations/settings?outletId=${encodeURIComponent(outletId)}`),
  updateSettings: (payload: {
    outletId: string;
    reservationSlotMinutes?: number;
    reservationMaxCoversPerSlot?: number;
  }) =>
    apiRequest<{
      outletId: string;
      reservationSlotMinutes: number;
      reservationMaxCoversPerSlot: number;
    }>('/reservations/settings', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  createInvite: (payload: {
    outletId: string;
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
  }) =>
    apiRequest<{
      id: string;
      token: string;
      bookUrl: string;
      emailSent: boolean;
      smsSent: boolean;
      expiresAt: string;
    }>('/reservations/invites', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

export interface PromoDisplaySlideRow {
  id: string;
  outletId: string;
  title: string | null;
  subtitle: string | null;
  imageUrl: string | null;
  slideType: string;
  sortOrder: number;
  durationSeconds: number;
  isActive: boolean;
}

export const promoDisplayApi = {
  list: (outletId: string) =>
    apiRequest<PromoDisplaySlideRow[]>(`/promo-display?outletId=${encodeURIComponent(outletId)}`),
  create: (payload: {
    outletId: string;
    title?: string;
    subtitle?: string;
    imageUrl?: string;
    slideType?: string;
    sortOrder?: number;
    durationSeconds?: number;
    isActive?: boolean;
  }) =>
    apiRequest<PromoDisplaySlideRow>('/promo-display', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  update: (id: string, payload: Partial<Omit<PromoDisplaySlideRow, 'id' | 'outletId'>>) =>
    apiRequest<PromoDisplaySlideRow>(`/promo-display/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  remove: (id: string) =>
    apiRequest<{ success: boolean; id: string }>(`/promo-display/${id}`, { method: 'DELETE' }),
  uploadImage: async (file: File): Promise<{ imageUrl: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    const token = useAuthStore.getState().accessToken;
    const headers = new Headers();
    if (token) headers.set('Authorization', `Bearer ${token}`);
    const response = await fetch(`${API_BASE}/promo-display/slides/upload-image`, {
      method: 'POST',
      headers,
      body: formData,
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw await parseError(response);
    return response.json() as Promise<{ imageUrl: string }>;
  },
};

export const feedbackApi = {
  list: (params?: { outletId?: string; from?: string; to?: string }) => {
    const search = new URLSearchParams();
    if (params?.outletId) search.set('outletId', params.outletId);
    if (params?.from) search.set('from', params.from);
    if (params?.to) search.set('to', params.to);
    const qs = search.toString();
    return apiRequest<
      Array<{
        id: string;
        rating: number | null;
        comment: string | null;
        createdAt: string;
        order: { orderNumber: string };
        outlet: { name: string };
      }>
    >(`/feedback${qs ? `?${qs}` : ''}`);
  },
  surveyLink: (orderId: string) =>
    apiRequest<{ url: string; surveyToken: string; orderNumber: string }>(
      `/feedback/orders/${orderId}/survey-link`,
      { method: 'POST' },
    ),
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

  getOpenShift: (outletId: string) =>
    apiRequest(`/pos/shifts/open?outletId=${encodeURIComponent(outletId)}`),

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

export const paymentsApi = {
  payCash: (orderId: string, amount?: number) =>
    apiRequest<{
      success: boolean;
      orderId: string;
      remaining?: number;
      paidAmount?: number;
    }>('/payments/cash', {
      method: 'POST',
      body: JSON.stringify({ orderId, amount }),
    }),

  getBalance: (orderId: string) =>
    apiRequest<{ orderId: string; total: number; remaining: number; paid: number }>(
      `/payments/orders/${orderId}/balance`,
    ),
  gatewayStatus: (outletId: string) =>
    apiRequest<{ onlineEnabled: boolean; provider: 'razorpay' | 'cashfree' | null }>(
      `/payments/gateways/status?outletId=${encodeURIComponent(outletId)}`,
    ),

  createIntent: (orderId: string, amount?: number, provider?: 'razorpay' | 'cashfree') =>
    apiRequest<{
      provider: 'razorpay' | 'cashfree';
      keyId?: string;
      razorpayOrderId?: string;
      cashfreeOrderId?: string;
      paymentSessionId?: string;
      mode?: 'sandbox' | 'production';
      amountPaise: number;
      amount?: number;
      currency: string;
      paymentId?: string;
      orderId?: string;
    }>('/payments/online/intent', {
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

export type PaymentGatewayRow = {
  provider: 'razorpay' | 'cashfree';
  isActive: boolean;
  isDefault: boolean;
  configured: boolean;
  keyIdMasked: string | null;
  hasWebhookSecret: boolean;
  mode: 'sandbox' | 'production' | null;
  webhookPath: string;
  outlets: Record<
    string,
    {
      override: boolean;
      configured: boolean;
      keyIdMasked: string | null;
      preferProvider: boolean;
      mode: 'sandbox' | 'production' | null;
    }
  >;
};

export const paymentGatewaysApi = {
  list: () => apiRequest<PaymentGatewayRow[]>('/payments/gateways'),
  get: (provider: 'razorpay' | 'cashfree') =>
    apiRequest<PaymentGatewayRow>(`/payments/gateways/${provider}`),
  upsert: (
    provider: 'razorpay' | 'cashfree',
    body: {
      isActive?: boolean;
      isDefault?: boolean;
      mode?: 'sandbox' | 'production';
      keyId?: string;
      secret?: string;
      webhookSecret?: string;
      clearWebhookSecret?: boolean;
    },
  ) =>
    apiRequest<PaymentGatewayRow>(`/payments/gateways/${provider}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  upsertOutlet: (
    provider: 'razorpay' | 'cashfree',
    outletId: string,
    body: {
      override: boolean;
      preferProvider?: boolean;
      mode?: 'sandbox' | 'production';
      keyId?: string;
      secret?: string;
      webhookSecret?: string;
      clearWebhookSecret?: boolean;
    },
  ) =>
    apiRequest<PaymentGatewayRow>(`/payments/gateways/${provider}/outlets/${outletId}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
};

export { CULLINOS_BRAND };

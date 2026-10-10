import { resolveViteApiBase, type ApiError } from '@cullinos/shared';
import { parsePhoneValue } from '@cullinos/ui';

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
    const body = (await response.json()) as ApiError & { message?: string | string[] };
    const fallback = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    return new ApiRequestError(
      body.error?.message ?? fallback ?? 'Request failed',
      body.error?.code ?? 'UNKNOWN',
      response.status,
    );
  } catch {
    return new ApiRequestError(response.statusText || 'Request failed', 'UNKNOWN', response.status);
  }
}

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!response.ok) throw await parseError(response);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export interface MenuCategory {
  id: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
}

export interface MenuModifier {
  id: string;
  name: string;
  /** Paise */
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
  /** Paise */
  price: number;
}

export interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  /** Paise */
  price: number;
  isAvailable: boolean;
  categoryId: string | null;
  /** Paise, before any happy-hour discount */
  regularPrice?: number;
  happyHour?: { name: string; endTime: string } | null;
  imageUrl?: string | null;
  isVeg?: boolean | null;
  isSpecial?: boolean;
  isAlcohol?: boolean;
  variants?: MenuVariant[];
  modifierGroups?: MenuModifierGroup[];
}

export interface DayHours {
  closed: boolean;
  /** HH:MM, 24h */
  open: string;
  close: string;
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
  photoUrls?: string[];
  accentColor?: string | null;
  /** null when the outlet has not configured opening hours */
  openNow?: boolean | null;
  todayHours?: DayHours | null;
  popularItemIds?: string[];
  menu: {
    outletId: string;
    categories: MenuCategory[];
    items: MenuItem[];
  };
}

export interface OrderLineInput {
  menuItemId: string;
  variantId?: string;
  quantity: number;
  notes?: string;
  modifiers?: Array<{ modifierId: string; name: string; price: number }>;
}

export interface PlacedOrder {
  id: string;
  orderNumber: string;
  pickupCode?: string | null;
}

export interface PublicSession {
  sessionToken: string;
  sessionActive: boolean;
  tableId: string;
  tableName: string;
}

export interface JoinedTable {
  sessionToken: string;
  tableName: string;
}

export interface AppConfig {
  playStoreUrl?: string | null;
}

export function phoneError(value: string): string | null {
  const { dial, national } = parsePhoneValue(value);
  if (!national) return 'Enter your phone number';
  if (dial === '91' && national.length !== 10) return 'Enter a 10-digit mobile number';
  if (national.length < 6 || national.length > 15) return 'Enter a valid phone number';
  return null;
}

export const orderApi = {
  storefront: (orgSlug: string, outletSlug: string) =>
    apiRequest<StorefrontBootstrap>(
      `/storefront/${encodeURIComponent(orgSlug)}/${encodeURIComponent(outletSlug)}`,
    ),

  validateSession: (token: string) =>
    apiRequest<PublicSession>(`/public/sessions/${encodeURIComponent(token)}`),

  joinTable: (qrCode: string) =>
    apiRequest<JoinedTable>(`/public/tables/by-qr/${encodeURIComponent(qrCode)}/join`, {
      method: 'POST',
    }),

  addSessionItems: (
    token: string,
    payload: {
      items: OrderLineInput[];
      customerName: string;
      customerPhone?: string;
      notes?: string;
      ageConfirmed?: boolean;
    },
  ) =>
    apiRequest<PlacedOrder>(`/public/sessions/${encodeURIComponent(token)}/items`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  submitSession: (token: string) =>
    apiRequest<PlacedOrder>(`/public/sessions/${encodeURIComponent(token)}/submit`, {
      method: 'POST',
    }),

  placeOrder: (payload: {
    orgSlug: string;
    outletSlug: string;
    type: 'takeaway' | 'dine_in';
    customerName: string;
    customerPhone?: string;
    notes: string;
    items: OrderLineInput[];
    ageConfirmed?: boolean;
  }) =>
    apiRequest<PlacedOrder>('/public/orders', {
      method: 'POST',
      body: JSON.stringify({ ...payload, source: 'QR' }),
    }),

  appConfig: () => apiRequest<AppConfig>('/public/marketplace/app-config'),
};

export function formatPrice(paise: number): string {
  const rupees = paise / 100;
  return `₹${Number.isInteger(rupees) ? rupees.toFixed(0) : rupees.toFixed(2)}`;
}

/** "23:00" → "11:00 PM" */
export function formatClock(hhmm: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return hhmm;
  const h = Number(m[1]) % 24;
  const suffix = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 === 0 ? 12 : h % 12}:${m[2]} ${suffix}`;
}

export function isAndroid(): boolean {
  return /Android/i.test(navigator.userAgent || '');
}

/** Open the installed Cullinos app. Does not navigate by itself. */
export function appOpenHref(opts: {
  org?: string;
  outlet?: string;
  table?: string;
  session?: string;
}): string {
  const q = new URLSearchParams();
  if (opts.table) q.set('table', opts.table);
  if (opts.session) q.set('session', opts.session);
  const qs = q.toString() ? `?${q.toString()}` : '';
  const outletPath =
    opts.org && opts.outlet
      ? `outlet/${encodeURIComponent(opts.org)}/${encodeURIComponent(opts.outlet)}${qs}`
      : 'outlet';
  if (isAndroid()) {
    return `intent://${outletPath}#Intent;scheme=cullinos;package=com.cullinos.guest;end`;
  }
  return `cullinos://${outletPath}`;
}

export function playStoreHref(playStoreUrl: string, deepLink: string): string {
  const referrer = encodeURIComponent(`utm_source=table_qr&utm_medium=qr&deep_link=${encodeURIComponent(deepLink)}`);
  return `${playStoreUrl}${playStoreUrl.includes('?') ? '&' : '?'}referrer=${referrer}`;
}

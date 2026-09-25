import { resolveViteApiBase } from '@cullinos/shared';
import type { ApiError } from '@cullinos/shared';

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
  imageUrl?: string | null;
  isVeg?: boolean | null;
  variants?: MenuVariant[];
  modifierGroups?: MenuModifierGroup[];
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
  menu: {
    outletId: string;
    categories: MenuCategory[];
    items: MenuItem[];
  };
}

export interface KioskOrderPayload {
  orgSlug: string;
  outletSlug: string;
  source: 'QR';
  type: 'takeaway' | 'dine_in';
  customerName: string;
  notes: string;
  items: Array<{
    menuItemId: string;
    variantId?: string;
    quantity: number;
    notes?: string;
    modifiers?: Array<{ modifierId: string; name: string; price: number }>;
  }>;
}

export interface PlacedOrder {
  id: string;
  orderNumber: string;
  pickupCode?: string | null;
}

export const kioskApi = {
  storefront: (orgSlug: string, outletSlug: string) =>
    apiRequest<StorefrontBootstrap>(
      `/storefront/${encodeURIComponent(orgSlug)}/${encodeURIComponent(outletSlug)}`,
    ),
  placeOrder: (payload: KioskOrderPayload) =>
    apiRequest<PlacedOrder>('/public/orders', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

export function formatPrice(paise: number): string {
  const rupees = paise / 100;
  return `₹${Number.isInteger(rupees) ? rupees.toFixed(0) : rupees.toFixed(2)}`;
}

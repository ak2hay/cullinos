/**
 * UrbanPiper (Swiggy / Zomato middleware) client and payload helpers.
 *
 * Paths and payload shapes follow UrbanPiper's POS integration API
 * (store actions, inventory push, item actions, order status, order relay webhooks).
 * Credentials are per restaurant (tenant Integration row), never platform env.
 */

export type UrbanPiperMode = "sandbox" | "production";

export type UrbanPiperPlatform = "swiggy" | "zomato";

export const URBANPIPER_PLATFORMS: UrbanPiperPlatform[] = ["swiggy", "zomato"];

export const URBANPIPER_BASE_URLS: Record<UrbanPiperMode, string> = {
  sandbox: "https://pos-int.urbanpiper.com",
  production: "https://api.urbanpiper.com",
};

export type UrbanPiperCredentials = {
  username: string;
  apiKey: string;
  mode: UrbanPiperMode;
};

/** Order states UrbanPiper accepts from the POS. */
export type UrbanPiperOrderStatus =
  | "Acknowledged"
  | "Food Ready"
  | "Dispatched"
  | "Completed"
  | "Cancelled";

/** Per-outlet UrbanPiper link stored in Integration.config.outlets. */
export type UrbanPiperOutletConfig = {
  connected: boolean;
  /** UrbanPiper location ref_id (we use the Cullinos outlet id unless overridden). */
  storeRefId?: string;
  platforms: Record<UrbanPiperPlatform, boolean>;
  /** Cullinos menu item ids switched off on aggregators for this outlet. */
  disabledItemIds?: string[];
  storeOnline?: boolean;
  lastMenuPushAt?: string;
  lastMenuPushError?: string | null;
  /** UrbanPiper / aggregator item id -> Cullinos menu item id. */
  itemSkuMap?: Record<string, string>;
};

export type UrbanPiperUnmappedItem = {
  externalItemId: string;
  name: string;
  platform?: string;
  outletId: string;
  lastSeenAt: string;
  count: number;
};

/** Stored Integration.config for provider "urbanpiper" (secrets encrypted at rest). */
export type UrbanPiperIntegrationConfig = {
  username: string;
  apiKeyEnc?: string;
  mode: UrbanPiperMode;
  webhookSecretEnc?: string;
  /** Minutes staff have to accept a new order; 0 disables the timer. */
  acceptTimeoutMinutes: number;
  /** When the timer runs out: reject the order, or only alert staff. */
  autoRejectOnTimeout: boolean;
  defaultPrepTimeMinutes: number;
  /** Re-push the catalogue shortly after menu edits. */
  autoPushMenu: boolean;
  outlets: Record<string, UrbanPiperOutletConfig>;
  unmappedItems?: UrbanPiperUnmappedItem[];
};

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

export type UrbanPiperMenuItemInput = {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  categoryId: string;
  isVeg: boolean;
  imageUrl?: string | null;
  available: boolean;
  sortOrder?: number;
  variants?: Array<{ id: string; name: string; price: number; isDefault?: boolean }>;
  modifierGroups?: Array<{
    id: string;
    name: string;
    minSelect: number;
    maxSelect: number;
    modifiers: Array<{ id: string; name: string; price: number }>;
  }>;
};

export type UrbanPiperCategoryInput = {
  id: string;
  name: string;
  description?: string | null;
  sortOrder?: number;
};

/** Option ref ids encode what they map back to on incoming orders. */
export const UP_VARIANT_PREFIX = "variant:";
export const UP_MODIFIER_PREFIX = "mod:";
const UP_VARIANT_GROUP_PREFIX = "vg:";
const UP_MODIFIER_GROUP_PREFIX = "mg:";

export function buildUrbanPiperCataloguePayload(input: {
  categories: UrbanPiperCategoryInput[];
  items: UrbanPiperMenuItemInput[];
}) {
  const usedCategoryIds = new Set(input.items.map((i) => i.categoryId));
  const categories = input.categories
    .filter((c) => usedCategoryIds.has(c.id))
    .map((c) => ({
      ref_id: c.id,
      name: c.name,
      description: c.description ?? "",
      sort_order: c.sortOrder ?? 0,
      active: true,
    }));

  const items = input.items.map((item) => ({
    ref_id: item.id,
    title: item.name,
    description: item.description ?? "",
    price: round2(item.price),
    current_stock: -1,
    available: item.available,
    sold_at_store: true,
    sort_order: item.sortOrder ?? 0,
    category_ref_ids: [item.categoryId],
    food_type: item.isVeg ? "1" : "2",
    ...(item.imageUrl ? { img_url: item.imageUrl } : {}),
    fulfillment_modes: ["delivery", "pickup"],
  }));

  const optionGroups: Array<Record<string, unknown>> = [];
  const options: Array<Record<string, unknown>> = [];

  for (const item of input.items) {
    if (item.variants?.length) {
      const groupRef = `${UP_VARIANT_GROUP_PREFIX}${item.id}`;
      optionGroups.push({
        ref_id: groupRef,
        title: "Choose size",
        min_selectable: 1,
        max_selectable: 1,
        active: true,
        item_ref_ids: [item.id],
      });
      for (const v of item.variants) {
        options.push({
          ref_id: `${UP_VARIANT_PREFIX}${v.id}`,
          title: v.name,
          // Variant price replaces the base price, so the option carries the difference.
          price: round2(Math.max(0, v.price - item.price)),
          available: true,
          sold_at_store: true,
          opt_grp_ref_ids: [groupRef],
        });
      }
    }
    for (const group of item.modifierGroups ?? []) {
      if (!group.modifiers.length) continue;
      const groupRef = `${UP_MODIFIER_GROUP_PREFIX}${group.id}`;
      const existing = optionGroups.find((g) => g.ref_id === groupRef);
      if (existing) {
        (existing.item_ref_ids as string[]).push(item.id);
        continue;
      }
      optionGroups.push({
        ref_id: groupRef,
        title: group.name,
        min_selectable: Math.max(0, group.minSelect),
        max_selectable: Math.max(1, group.maxSelect),
        active: true,
        item_ref_ids: [item.id],
      });
      for (const m of group.modifiers) {
        options.push({
          ref_id: `${UP_MODIFIER_PREFIX}${m.id}`,
          title: m.name,
          price: round2(m.price),
          available: true,
          sold_at_store: true,
          opt_grp_ref_ids: [groupRef],
        });
      }
    }
  }

  return {
    flush_categories: true,
    flush_items: true,
    flush_option_groups: true,
    flush_options: true,
    categories,
    items,
    option_groups: optionGroups,
    options,
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

// ---------------------------------------------------------------------------
// Incoming webhooks
// ---------------------------------------------------------------------------

export type UrbanPiperNormalizedOption = {
  externalId?: string;
  merchantId?: string;
  name: string;
  price: number;
};

export type UrbanPiperNormalizedItem = {
  /** UrbanPiper's own item id. */
  externalItemId?: string;
  /** Our ref_id echoed back (Cullinos menu item id when pushed from Cullinos). */
  merchantId?: string;
  name: string;
  quantity: number;
  /** Per-unit price including selected options. */
  unitPrice: number;
  notes?: string;
  options: UrbanPiperNormalizedOption[];
};

export type UrbanPiperNormalizedOrder = {
  upOrderId: string;
  platform: UrbanPiperPlatform | string;
  channelOrderId?: string;
  storeRefId?: string;
  orderType: "delivery" | "takeaway";
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  instructions?: string;
  subtotal?: number;
  taxTotal?: number;
  total?: number;
  placedAt?: string;
  items: UrbanPiperNormalizedItem[];
};

function rec(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function str(obj: Record<string, unknown>, key: string): string | undefined {
  const v = obj[key];
  if (typeof v === "string" && v.trim()) return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return undefined;
}

function num(obj: Record<string, unknown>, key: string): number | undefined {
  const v = obj[key];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function toIso(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    // UrbanPiper sends epoch milliseconds.
    return new Date(value > 1e12 ? value : value * 1000).toISOString();
  }
  if (typeof value === "string" && value.trim()) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
  }
  return undefined;
}

function formatAddress(address: Record<string, unknown>): string | undefined {
  const parts = ["line_1", "line_2", "sub_locality", "landmark", "city", "pin"]
    .map((k) => str(address, k))
    .filter(Boolean);
  return parts.length ? parts.join(", ") : undefined;
}

/** Map an UrbanPiper order relay webhook into a Cullinos-friendly shape. */
export function normalizeUrbanPiperOrder(payload: unknown): UrbanPiperNormalizedOrder {
  const body = rec(payload);
  const order = rec(body.order);
  const details = rec(order.details);
  const store = rec(order.store);
  const customer = rec(body.customer ?? order.customer);
  const address = rec(customer.address);

  const extPlatforms = Array.isArray(details.ext_platforms) ? details.ext_platforms : [];
  const ext = rec(extPlatforms[0]);
  const platform = (str(ext, "name") ?? str(details, "channel") ?? "unknown").toLowerCase();

  const upOrderId = str(details, "id") ?? str(order, "id") ?? "";
  const rawItems = Array.isArray(order.items) ? order.items : [];
  const items: UrbanPiperNormalizedItem[] = rawItems.map((entry) => {
    const row = rec(entry);
    const quantity = Math.max(1, Math.floor(num(row, "quantity") ?? 1));
    const rawOptions = Array.isArray(row.options_to_add) ? row.options_to_add : [];
    const options = rawOptions.map((o) => {
      const opt = rec(o);
      return {
        externalId: str(opt, "id"),
        merchantId: str(opt, "merchant_id"),
        name: str(opt, "title") ?? "Option",
        price: num(opt, "price") ?? 0,
      };
    });
    const basePrice = num(row, "price") ?? 0;
    const optionTotal = options.reduce((s, o) => s + o.price, 0);
    return {
      externalItemId: str(row, "id"),
      merchantId: str(row, "merchant_id"),
      name: str(row, "title") ?? "Item",
      quantity,
      unitPrice: round2(basePrice + optionTotal),
      notes: str(row, "instructions"),
      options,
    };
  });

  const orderType = (str(details, "order_type") ?? "").toLowerCase() === "pickup"
    ? "takeaway"
    : "delivery";

  return {
    upOrderId,
    platform,
    channelOrderId: str(ext, "id") ?? str(details, "channel_order_id"),
    storeRefId: str(store, "merchant_ref_id") ?? str(store, "id"),
    orderType,
    customerName: str(customer, "name"),
    customerPhone: str(customer, "phone"),
    deliveryAddress: formatAddress(address),
    instructions: str(details, "instructions"),
    subtotal: num(details, "order_subtotal"),
    taxTotal: num(details, "total_taxes"),
    total: num(details, "order_total") ?? num(details, "total"),
    placedAt: toIso(details.created),
    items,
  };
}

export type UrbanPiperStatusEvent = {
  upOrderId: string;
  newState: string;
  message?: string;
};

export function parseUrbanPiperStatusWebhook(payload: unknown): UrbanPiperStatusEvent | null {
  const body = rec(payload);
  const upOrderId = str(body, "order_id");
  const newState = str(body, "new_state");
  if (!upOrderId || !newState) return null;
  return { upOrderId, newState, message: str(body, "message") };
}

export type UrbanPiperRiderEvent = {
  upOrderId: string;
  state: string;
  riderName?: string;
  riderPhone?: string;
};

export function parseUrbanPiperRiderWebhook(payload: unknown): UrbanPiperRiderEvent | null {
  const body = rec(payload);
  const info = rec(body.delivery_info);
  const person = rec(info.delivery_person_details);
  const upOrderId = str(body, "order_id");
  const state = str(info, "current_state");
  if (!upOrderId || !state) return null;
  return {
    upOrderId,
    state,
    riderName: str(person, "name"),
    riderPhone: str(person, "phone"),
  };
}

/** UrbanPiper status to push when a Cullinos order reaches `status`; null = nothing to send. */
export function urbanPiperStatusFor(status: string): UrbanPiperOrderStatus | null {
  switch (status) {
    case "confirmed":
      return "Acknowledged";
    case "ready":
      return "Food Ready";
    case "served":
    case "completed":
      return "Dispatched";
    case "cancelled":
    case "voided":
      return "Cancelled";
    default:
      return null;
  }
}

const UP_STATUS_RANK: Record<UrbanPiperOrderStatus, number> = {
  Acknowledged: 1,
  "Food Ready": 2,
  Dispatched: 3,
  Completed: 4,
  Cancelled: 5,
};

/** Only move UrbanPiper forward: never resend or step back to an earlier state. */
export function shouldPushUrbanPiperStatus(
  next: UrbanPiperOrderStatus,
  lastPushed: UrbanPiperOrderStatus | undefined,
): boolean {
  if (!lastPushed) return true;
  if (lastPushed === "Cancelled" || lastPushed === "Completed") return false;
  return UP_STATUS_RANK[next] > UP_STATUS_RANK[lastPushed];
}

/** Aggregator-side states that mean the order will not be fulfilled. */
export function isUrbanPiperCancelState(state: string): boolean {
  return state.trim().toLowerCase() === "cancelled";
}

// ---------------------------------------------------------------------------
// HTTP client
// ---------------------------------------------------------------------------

export class UrbanPiperApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(message);
    this.name = "UrbanPiperApiError";
  }
}

type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body?: string; signal?: AbortSignal },
) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

export function urbanPiperAuthHeader(creds: Pick<UrbanPiperCredentials, "username" | "apiKey">) {
  return `apikey ${creds.username}:${creds.apiKey}`;
}

export class UrbanPiperClient {
  private readonly baseUrl: string;

  constructor(
    private readonly creds: UrbanPiperCredentials,
    private readonly fetchImpl: FetchLike = (url, init) => fetch(url, init),
    private readonly timeoutMs = 15_000,
  ) {
    this.baseUrl = URBANPIPER_BASE_URLS[creds.mode];
  }

  async request<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers: {
          Authorization: urbanPiperAuthHeader(this.creds),
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      const text = await res.text();
      let parsed: unknown = text;
      try {
        parsed = text ? JSON.parse(text) : null;
      } catch {
        parsed = text;
      }
      if (!res.ok) {
        const msg = rec(parsed).message ?? rec(parsed).detail ?? `HTTP ${res.status}`;
        throw new UrbanPiperApiError(`UrbanPiper: ${String(msg)}`, res.status, parsed);
      }
      return parsed as T;
    } finally {
      clearTimeout(timer);
    }
  }

  pushCatalogue(storeRefId: string, payload: ReturnType<typeof buildUrbanPiperCataloguePayload>) {
    return this.request("POST", `/external/api/v1/inventory/locations/${encodeURIComponent(storeRefId)}/`, payload);
  }

  setItemsAvailability(
    storeRefId: string,
    itemRefIds: string[],
    available: boolean,
    platforms: UrbanPiperPlatform[],
  ) {
    return this.request("POST", "/hub/api/v1/items/", {
      location_ref_id: storeRefId,
      platforms,
      item_ref_ids: itemRefIds,
      action: available ? "enable" : "disable",
    });
  }

  setStoreAvailability(storeRefId: string, online: boolean, platforms: UrbanPiperPlatform[]) {
    return this.request("POST", "/hub/api/v1/location/", {
      location_ref_id: storeRefId,
      platforms,
      action: online ? "enable" : "disable",
    });
  }

  updateOrderStatus(upOrderId: string, status: UrbanPiperOrderStatus, message?: string) {
    return this.request("PUT", `/external/api/v1/orders/${encodeURIComponent(upOrderId)}/status/`, {
      new_status: status,
      message: message ?? status,
    });
  }
}

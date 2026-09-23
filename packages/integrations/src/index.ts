export type IntegrationProvider =
  | "razorpay"
  | "cashfree"
  | "swiggy"
  | "zomato"
  | "whatsapp"
  | "custom";

export type AggregatorProvider = "swiggy" | "zomato";

/** Diner payment gateway providers (per-restaurant Integration rows). */
export type PaymentGatewayProvider = "razorpay" | "cashfree";

export const PAYMENT_GATEWAY_PROVIDERS: PaymentGatewayProvider[] = [
  "razorpay",
  "cashfree",
];

export type PaymentGatewayMode = "sandbox" | "production";

/** Per-outlet payment credential override stored in Integration.config.outlets */
export type PaymentGatewayOutletConfig = {
  override: boolean;
  keyId?: string;
  secretEnc?: string;
  webhookSecretEnc?: string;
  mode?: PaymentGatewayMode;
  preferProvider?: boolean;
};

/** Stored Integration.config for razorpay / cashfree */
export type PaymentGatewayIntegrationConfig = {
  isDefault: boolean;
  mode?: PaymentGatewayMode;
  keyId: string;
  secretEnc: string;
  webhookSecretEnc?: string;
  outlets?: Record<string, PaymentGatewayOutletConfig>;
};

export type IntegrationConfig = {
  provider: IntegrationProvider;
  apiKey?: string;
  apiSecret?: string;
  webhookUrl?: string;
  metadata?: Record<string, unknown>;
};

/** Per-outlet aggregator connection flags stored in Integration.config.outlets */
export type AggregatorOutletConfig = {
  connected: boolean;
  menuSyncEnabled: boolean;
  externalStoreId?: string;
  itemSkuMap?: Record<string, string>;
};

export type AggregatorIntegrationConfig = {
  webhookSecret: string;
  outlets: Record<string, AggregatorOutletConfig>;
};

/** Normalized order shape consumed by OrdersService.create */
export type CullinosNormalizedOrderItem = {
  externalItemId?: string;
  menuItemId?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  notes?: string;
};

export type CullinosNormalizedOrder = {
  externalOrderId: string;
  outletId: string;
  provider: AggregatorProvider;
  customerName?: string;
  customerPhone?: string;
  orderType: "delivery" | "takeaway" | "dine_in";
  notes?: string;
  items: CullinosNormalizedOrderItem[];
  subtotal?: number;
  taxTotal?: number;
  total?: number;
  commission?: number;
  payout?: number;
  placedAt?: string;
  deliveryAddress?: string;
  idempotencyKey?: string;
};

export interface AggregatorAdapter {
  provider: AggregatorProvider;
  /** Map raw webhook JSON into Cullinos order shape. */
  normalizeWebhookPayload(
    payload: unknown,
    ctx: { outletId: string; itemSkuMap?: Record<string, string> },
  ): CullinosNormalizedOrder;
  /** Stub: push menu to aggregator (MVP no-op). */
  syncMenu?(
    outletId: string,
    menu: Record<string, unknown>[],
  ): Promise<{ synced: number; skipped: number }>;
}

function readString(obj: Record<string, unknown>, key: string): string | undefined {
  const v = obj[key];
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function readNumber(obj: Record<string, unknown>, key: string): number | undefined {
  const v = obj[key];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function mapItems(
  rawItems: unknown,
  itemSkuMap?: Record<string, string>,
): CullinosNormalizedOrderItem[] {
  if (!Array.isArray(rawItems)) return [];
  return rawItems.map((entry) => {
    const row = (entry ?? {}) as Record<string, unknown>;
    const externalItemId = readString(row, "item_id") ?? readString(row, "itemId");
    const menuItemId =
      (externalItemId && itemSkuMap?.[externalItemId]) ||
      readString(row, "menu_item_id") ||
      readString(row, "menuItemId");
    return {
      externalItemId,
      menuItemId,
      name: readString(row, "name") ?? "Item",
      quantity: Math.max(1, Math.floor(readNumber(row, "quantity") ?? 1)),
      unitPrice: readNumber(row, "unit_price") ?? readNumber(row, "unitPrice") ?? 0,
      notes: readString(row, "notes"),
    };
  });
}

export class SwiggyAdapter implements AggregatorAdapter {
  provider = "swiggy" as const;

  normalizeWebhookPayload(
    payload: unknown,
    ctx: { outletId: string; itemSkuMap?: Record<string, string> },
  ): CullinosNormalizedOrder {
    const body = (payload ?? {}) as Record<string, unknown>;
    const order = (body.order ?? body) as Record<string, unknown>;
    const externalOrderId =
      readString(order, "order_id") ??
      readString(order, "orderId") ??
      readString(body, "order_id") ??
      "unknown";
    const customer = (order.customer ?? {}) as Record<string, unknown>;
    const items = mapItems(order.items ?? order.order_items, ctx.itemSkuMap);

    return {
      externalOrderId,
      outletId: ctx.outletId,
      provider: "swiggy",
      customerName: readString(customer, "name") ?? readString(order, "customer_name"),
      customerPhone: readString(customer, "phone") ?? readString(order, "customer_phone"),
      orderType: "takeaway",
      notes: readString(order, "instructions") ?? readString(order, "notes"),
      items,
      subtotal: readNumber(order, "subtotal"),
      taxTotal: readNumber(order, "tax"),
      total: readNumber(order, "order_total") ?? readNumber(order, "total"),
      commission: readNumber(order, "commission"),
      payout: readNumber(order, "restaurant_payout") ?? readNumber(order, "payout"),
      placedAt: readString(order, "placed_at") ?? readString(order, "created_at"),
      deliveryAddress: readString(order, "delivery_address"),
      idempotencyKey: `aggregator:swiggy:${externalOrderId}`,
    };
  }

  async syncMenu(
    _outletId: string,
    menu: Record<string, unknown>[],
  ): Promise<{ synced: number; skipped: number }> {
    return { synced: menu.length, skipped: 0 };
  }
}

export class ZomatoAdapter implements AggregatorAdapter {
  provider = "zomato" as const;

  normalizeWebhookPayload(
    payload: unknown,
    ctx: { outletId: string; itemSkuMap?: Record<string, string> },
  ): CullinosNormalizedOrder {
    const body = (payload ?? {}) as Record<string, unknown>;
    const order = (body.order ?? body.tab ?? body) as Record<string, unknown>;
    const externalOrderId =
      readString(order, "tab_id") ??
      readString(order, "order_id") ??
      readString(order, "orderId") ??
      "unknown";
    const customer = (order.customer ?? order.user ?? {}) as Record<string, unknown>;
    const items = mapItems(order.items ?? order.order_items ?? order.dishes, ctx.itemSkuMap);

    return {
      externalOrderId,
      outletId: ctx.outletId,
      provider: "zomato",
      customerName: readString(customer, "name") ?? readString(order, "customer_name"),
      customerPhone: readString(customer, "phone") ?? readString(order, "customer_phone"),
      orderType: "takeaway",
      notes: readString(order, "special_instructions") ?? readString(order, "notes"),
      items,
      subtotal: readNumber(order, "subtotal"),
      taxTotal: readNumber(order, "tax_amount") ?? readNumber(order, "tax"),
      total: readNumber(order, "total") ?? readNumber(order, "order_total"),
      commission: readNumber(order, "commission_amount") ?? readNumber(order, "commission"),
      payout: readNumber(order, "net_amount") ?? readNumber(order, "payout"),
      placedAt: readString(order, "created_at") ?? readString(order, "placed_at"),
      deliveryAddress: readString(order, "delivery_address"),
      idempotencyKey: `aggregator:zomato:${externalOrderId}`,
    };
  }

  async syncMenu(
    _outletId: string,
    menu: Record<string, unknown>[],
  ): Promise<{ synced: number; skipped: number }> {
    return { synced: menu.length, skipped: 0 };
  }
}

export class AggregatorRegistry {
  private adapters = new Map<AggregatorProvider, AggregatorAdapter>();

  constructor() {
    this.register(new SwiggyAdapter());
    this.register(new ZomatoAdapter());
  }

  register(adapter: AggregatorAdapter): void {
    this.adapters.set(adapter.provider, adapter);
  }

  get(provider: AggregatorProvider): AggregatorAdapter | undefined {
    return this.adapters.get(provider);
  }
}

export const defaultAggregatorRegistry = new AggregatorRegistry();

export interface DeliveryAdapter {
  provider: IntegrationProvider;
  createOrder(order: Record<string, unknown>): Promise<{ externalId: string }>;
  updateStatus(externalId: string, status: string): Promise<void>;
}

export class IntegrationRegistry {
  private adapters: Map<string, DeliveryAdapter> = new Map();

  register(key: string, adapter: DeliveryAdapter): void {
    this.adapters.set(key, adapter);
  }

  get(key: string): DeliveryAdapter | undefined {
    return this.adapters.get(key);
  }
}

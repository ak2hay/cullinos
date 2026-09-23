/**
 * Offline sync event types processed by the API (`SyncService`).
 * Client POS/gateway enqueues these via `@cullinos/sync` SyncQueue then POST /sync.
 */

export const SYNC_EVENT_TYPES = {
  ORDER_CREATE: "order.create",
  PAYMENT_CASH: "payment.cash",
} as const;

export type SyncEventType =
  (typeof SYNC_EVENT_TYPES)[keyof typeof SYNC_EVENT_TYPES];

/** Line item for offline order.create — mirrors POS cart lines. */
export type SyncOrderCreateItem = {
  menuItemId?: string;
  variantId?: string;
  quantity: number;
  notes?: string;
  /** Offline snapshot when menu IDs unavailable */
  name?: string;
  unitPrice?: number;
  modifiers?: Array<{ name: string; price: number; modifierId?: string }>;
};

/**
 * order.create — create a dine-in/takeaway order while offline.
 * `idempotencyKey` on the envelope is stored on Order and deduplicates replays.
 */
export type SyncOrderCreateData = {
  outletId: string;
  type?: "dine_in" | "takeaway" | "delivery" | "counter";
  source?: string;
  tableId?: string;
  tableSessionId?: string;
  customerId?: string;
  customerName?: string;
  guestCount?: number;
  notes?: string;
  tipAmount?: number;
  items: SyncOrderCreateItem[];
  autoConfirm?: boolean;
};

/**
 * payment.cash — record cash tender against an existing order.
 * Partial amounts supported; omitted amount pays remaining balance.
 */
export type SyncPaymentCashData = {
  orderId: string;
  amount?: number;
};

export type SyncEventPayloadByType = {
  [SYNC_EVENT_TYPES.ORDER_CREATE]: SyncOrderCreateData;
  [SYNC_EVENT_TYPES.PAYMENT_CASH]: SyncPaymentCashData;
};

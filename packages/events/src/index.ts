export const DOMAIN_EVENTS = {
  ORDER_CREATED: 'OrderCreated',
  ORDER_UPDATED: 'OrderUpdated',
  ORDER_CONFIRMED: 'OrderConfirmed',
  ORDER_COMPLETED: 'OrderCompleted',
  ORDER_CANCELLED: 'OrderCancelled',
  KOT_CREATED: 'KOTCreated',
  KOT_READY: 'KOTReady',
  PAYMENT_RECEIVED: 'PaymentReceived',
  PAYMENT_REFUNDED: 'PaymentRefunded',
  INVENTORY_CONSUMED: 'InventoryConsumed',
  STOCK_LOW: 'StockLow',
  PURCHASE_CREATED: 'PurchaseCreated',
  PURCHASE_RECEIVED: 'PurchaseReceived',
  CUSTOMER_CREATED: 'CustomerCreated',
  LOYALTY_POINTS_ADDED: 'LoyaltyPointsAdded',
  WASTAGE_RECORDED: 'WastageRecorded',
  SYNC_EVENT_RECEIVED: 'SyncEventReceived',
} as const;

export type DomainEventType = (typeof DOMAIN_EVENTS)[keyof typeof DOMAIN_EVENTS];

export interface DomainEvent<T = Record<string, unknown>> {
  id: string;
  type: DomainEventType;
  organizationId: string;
  outletId?: string;
  payload: T;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface EventPublisher {
  publish(event: DomainEvent): Promise<void>;
}

export interface EventHandler<T = Record<string, unknown>> {
  handle(event: DomainEvent<T>): Promise<void>;
}

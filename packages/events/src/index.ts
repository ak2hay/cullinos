export type DomainEvent = {
  id: string;
  type: string;
  organizationId: string;
  outletId?: string;
  entityId?: string;
  payload: Record<string, unknown>;
  timestamp: Date;
};

export const EventTypes = {
  ORDER_CREATED: "order.created",
  ORDER_UPDATED: "order.updated",
  ORDER_COMPLETED: "order.completed",
  KOT_CREATED: "kot.created",
  KOT_READY: "kot.ready",
  PAYMENT_RECEIVED: "payment.received",
  INVENTORY_LOW: "inventory.low",
  SYNC_REQUIRED: "sync.required",
  TENANT_PROVISIONED: "tenant.provisioned",
  TENANT_SUSPENDED: "tenant.suspended",
} as const;

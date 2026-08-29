export type OrderSource =
  | 'POS'
  | 'QR'
  | 'ONLINE'
  | 'WAITER'
  | 'DELIVERY'
  | 'TAKEAWAY'
  | 'DINE_IN'
  | 'ROOM_SERVICE';

export type OrderStatus =
  | 'DRAFT'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'READY'
  | 'SERVED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REFUNDED'
  | 'HELD';

export type TableStatus =
  | 'AVAILABLE'
  | 'OCCUPIED'
  | 'RESERVED'
  | 'CLEANING'
  | 'BILLING'
  | 'PAYMENT_PENDING'
  | 'MERGED'
  | 'UNAVAILABLE';

export type KOTStatus = 'NEW' | 'PREPARING' | 'READY' | 'SERVED' | 'CANCELLED';

export type PaymentMethod =
  | 'CASH'
  | 'CARD'
  | 'UPI'
  | 'WALLET'
  | 'BANK_TRANSFER'
  | 'ONLINE'
  | 'ROOM_POSTING';

export type PaymentStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED' | 'PARTIAL';

export type CustomerSegment =
  | 'NEW'
  | 'REGULAR'
  | 'VIP'
  | 'INACTIVE'
  | 'HIGH_VALUE'
  | 'LOW_FREQUENCY'
  | 'FREQUENT';

export type SubscriptionPlanKey = 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE' | 'HOSPITALITY';

export type SyncEventStatus = 'PENDING' | 'SYNCED' | 'FAILED' | 'CONFLICT';

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  };
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface TenantContext {
  organizationId: string;
  outletId?: string;
  userId: string;
  permissions: string[];
}

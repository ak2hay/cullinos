import { ForbiddenException } from "@nestjs/common";
import { normalizeOrderStatusFilter } from "../../common/status.util";

/** Generic status updates must not bypass the `order:cancel` gate on cancel / void. */
export function assertCanSetOrderStatus(
  user: { permissions?: string[] } | undefined,
  status: string,
): void {
  const target = normalizeOrderStatusFilter(status ?? "");
  if (target !== "cancelled" && target !== "voided") return;
  if (!user?.permissions?.includes("order:cancel")) {
    throw new ForbiddenException("Insufficient permissions");
  }
}

/** Order metadata keys the server writes and later trusts for totals, stock, compliance or settlements. */
export const RESERVED_ORDER_METADATA_KEYS = [
  "deliveryFee",
  "deliveryAddress",
  "deliveryPincode",
  "deliveryZoneId",
  "stockDeductedAt",
  "stockDeductedItemIds",
  "stockRestoredAt",
  "alcoholAgeConfirmed",
  "aggregator",
] as const;

export function stripReservedOrderMetadata(
  metadata: unknown,
): Record<string, unknown> | undefined {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return undefined;
  const clean = { ...(metadata as Record<string, unknown>) };
  for (const key of RESERVED_ORDER_METADATA_KEYS) delete clean[key];
  return Object.keys(clean).length ? clean : undefined;
}

/** Staff order bodies: everything except server-controlled fields. */
export function sanitizeStaffOrderBody(body: Record<string, unknown>): Record<string, unknown> {
  const dto: Record<string, unknown> = { ...body };
  delete dto.organizationId;
  delete dto.publicOrder;
  delete dto.customerOrder;
  delete dto.deliveryFee;
  dto.metadata = stripReservedOrderMetadata(body.metadata);
  return dto;
}

const PUBLIC_SOURCES = new Set(["ONLINE", "QR", "CUSTOMER"]);

const str = (v: unknown) => (typeof v === "string" ? v : undefined);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

/**
 * Anonymous storefront / kiosk / Cullinos App checkout. Only fields a guest may
 * choose are kept; tables, sessions, metadata and fees are server-owned, and
 * `customerId` is attached separately after ownership is proven.
 */
export function pickPublicOrderFields(body: Record<string, unknown>) {
  const source = str(body.source)?.toUpperCase();
  return {
    type: str(body.type),
    source: source && PUBLIC_SOURCES.has(source) ? source : "ONLINE",
    customerName: str(body.customerName),
    notes: str(body.notes),
    guestCount: num(body.guestCount),
    tipAmount: num(body.tipAmount),
    scheduledPickupAt: str(body.scheduledPickupAt),
    items: Array.isArray(body.items) ? body.items : [],
    idempotencyKey: str(body.idempotencyKey),
    couponCode: str(body.couponCode),
    deliveryAddress: str(body.deliveryAddress),
    deliveryPincode: str(body.deliveryPincode),
    deliveryLat: num(body.deliveryLat),
    deliveryLng: num(body.deliveryLng),
    deliveryZoneId: str(body.deliveryZoneId),
    ageConfirmed: body.ageConfirmed === true,
  };
}

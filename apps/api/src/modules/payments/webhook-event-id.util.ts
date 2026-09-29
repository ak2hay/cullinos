const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const entity = (payload: Record<string, unknown>, key: string) =>
  (payload[key] as { entity?: Record<string, unknown> } | undefined)?.entity;

/**
 * Razorpay sends the unique event id in `x-razorpay-event-id`; the body has none.
 * Falls back to a deterministic key so provider retries still dedupe.
 */
export function razorpayWebhookEventId(
  headerEventId: string | undefined,
  body: Record<string, unknown>,
): string | null {
  const direct = str(headerEventId) ?? str(body.id) ?? str(body.event_id);
  if (direct) return direct;
  const event = str(body.event);
  const payload = (body.payload ?? {}) as Record<string, unknown>;
  const entityId =
    str(entity(payload, "payment")?.id) ??
    str(entity(payload, "order")?.id) ??
    str(entity(payload, "subscription")?.id);
  return event && entityId ? `${event}:${entityId}` : null;
}

/** Stable Cashfree event key: identical for provider retries of the same event. */
export function cashfreeWebhookEventId(
  headerIdempotencyKey: string | undefined,
  body: Record<string, unknown>,
  cashfreeOrderId: string | undefined,
  eventType: string,
): string {
  const direct = str(headerIdempotencyKey);
  if (direct) return direct;
  const data = (body.data ?? body) as Record<string, unknown>;
  const payment = (data.payment ?? {}) as Record<string, unknown>;
  const cfPaymentId =
    typeof payment.cf_payment_id === "number"
      ? String(payment.cf_payment_id)
      : str(payment.cf_payment_id);
  return [cashfreeOrderId ?? "cf", cfPaymentId ?? "-", eventType, str(body.event_time) ?? "-"].join(":");
}

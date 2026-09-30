import { describe, expect, it } from "vitest";
import { cashfreeWebhookEventId, razorpayWebhookEventId } from "./webhook-event-id.util";

const razorpayBody = {
  entity: "event",
  event: "payment.captured",
  payload: { payment: { entity: { id: "pay_123", order_id: "order_9" } } },
};

describe("razorpayWebhookEventId", () => {
  it("prefers the x-razorpay-event-id header (the body has no id)", () => {
    expect(razorpayWebhookEventId("evt_abc", razorpayBody)).toBe("evt_abc");
  });

  it("falls back to a deterministic event + entity key", () => {
    expect(razorpayWebhookEventId(undefined, razorpayBody)).toBe("payment.captured:pay_123");
    expect(razorpayWebhookEventId(undefined, razorpayBody)).toBe(
      razorpayWebhookEventId(undefined, razorpayBody),
    );
  });

  it("returns null when nothing identifies the event", () => {
    expect(razorpayWebhookEventId(undefined, { event: "payment.captured", payload: {} })).toBeNull();
  });
});

describe("cashfreeWebhookEventId", () => {
  const body = {
    type: "PAYMENT_SUCCESS_WEBHOOK",
    event_time: "2026-09-29T10:00:00+05:30",
    data: { payment: { cf_payment_id: 555 } },
  };

  it("prefers the idempotency header", () => {
    expect(cashfreeWebhookEventId("idem-1", body, "cf_order", "PAYMENT_SUCCESS_WEBHOOK")).toBe("idem-1");
  });

  it("is stable across retries of the same event", () => {
    const a = cashfreeWebhookEventId(undefined, body, "cf_order", "PAYMENT_SUCCESS_WEBHOOK");
    const b = cashfreeWebhookEventId(undefined, body, "cf_order", "PAYMENT_SUCCESS_WEBHOOK");
    expect(a).toBe(b);
    expect(a).toBe("cf_order:555:PAYMENT_SUCCESS_WEBHOOK:2026-09-29T10:00:00+05:30");
  });

  it("stays deterministic without event_time", () => {
    const noTime = { type: "PAYMENT_FAILED_WEBHOOK", data: { payment: {} } };
    expect(cashfreeWebhookEventId(undefined, noTime, "cf_order", "PAYMENT_FAILED_WEBHOOK")).toBe(
      "cf_order:-:PAYMENT_FAILED_WEBHOOK:-",
    );
  });
});

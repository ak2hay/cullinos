import { createHmac } from "crypto";
import { describe, expect, it } from "vitest";

/**
 * Mirrors RazorpayClient.verifyPaymentSignature without Nest DI.
 * HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET)
 */
function verifyPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string,
  secret: string,
): boolean {
  const expected = createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  return expected === signature;
}

describe("Razorpay payment signature", () => {
  const secret = "test_secret";
  const orderId = "order_ABC";
  const paymentId = "pay_XYZ";

  it("accepts a matching signature", () => {
    const signature = createHmac("sha256", secret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");
    expect(verifyPaymentSignature(orderId, paymentId, signature, secret)).toBe(true);
  });

  it("rejects a mismatched signature", () => {
    expect(
      verifyPaymentSignature(orderId, paymentId, "deadbeef", secret),
    ).toBe(false);
  });

  it("rejects when payment id differs", () => {
    const signature = createHmac("sha256", secret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");
    expect(
      verifyPaymentSignature(orderId, "pay_OTHER", signature, secret),
    ).toBe(false);
  });
});

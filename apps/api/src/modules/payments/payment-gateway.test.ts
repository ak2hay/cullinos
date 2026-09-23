import { createHmac } from "crypto";
import { describe, expect, it } from "vitest";
import { verifyCashfreeWebhookSignature } from "./cashfree.client";
import {
  emptyPaymentGatewayConfig,
  parsePaymentGatewayConfig,
  resolveCredentialsFromConfigs,
} from "./payment-credentials.service";
import {
  verifyTenantRazorpayPaymentSignature,
  verifyTenantRazorpayWebhookSignature,
} from "./tenant-razorpay";

describe("payment gateway credential resolution", () => {
  it("uses org default provider when no outlet preference", () => {
    const razorpay = emptyPaymentGatewayConfig(true);
    razorpay.keyId = "rzp_test_org";
    razorpay.secretEnc = "enc_rzp";
    const cashfree = emptyPaymentGatewayConfig(false);
    cashfree.keyId = "cf_org";
    cashfree.secretEnc = "enc_cf";
    cashfree.mode = "sandbox";

    const resolved = resolveCredentialsFromConfigs(
      "org1",
      "outlet1",
      null,
      [
        { provider: "razorpay", isActive: true, config: razorpay },
        { provider: "cashfree", isActive: true, config: cashfree },
      ],
      (enc) => enc.replace("enc_", "plain_"),
    );

    expect(resolved.provider).toBe("razorpay");
    expect(resolved.keyId).toBe("rzp_test_org");
    expect(resolved.secret).toBe("plain_rzp");
    expect(resolved.usedOutletOverride).toBe(false);
  });

  it("prefers outlet preferProvider over org default", () => {
    const razorpay = emptyPaymentGatewayConfig(true);
    razorpay.keyId = "rzp_org";
    razorpay.secretEnc = "enc_rzp";
    const cashfree = emptyPaymentGatewayConfig(false);
    cashfree.keyId = "cf_org";
    cashfree.secretEnc = "enc_cf";
    cashfree.outlets = {
      outlet1: { override: false, preferProvider: true },
    };

    const resolved = resolveCredentialsFromConfigs(
      "org1",
      "outlet1",
      null,
      [
        { provider: "razorpay", isActive: true, config: razorpay },
        { provider: "cashfree", isActive: true, config: cashfree },
      ],
      (enc) => enc.replace("enc_", "plain_"),
    );

    expect(resolved.provider).toBe("cashfree");
    expect(resolved.keyId).toBe("cf_org");
  });

  it("uses outlet override credentials when override is true", () => {
    const razorpay = emptyPaymentGatewayConfig(true);
    razorpay.keyId = "rzp_org";
    razorpay.secretEnc = "enc_org";
    razorpay.outlets = {
      outlet1: {
        override: true,
        keyId: "rzp_outlet",
        secretEnc: "enc_outlet",
      },
    };

    const resolved = resolveCredentialsFromConfigs(
      "org1",
      "outlet1",
      "razorpay",
      [{ provider: "razorpay", isActive: true, config: razorpay }],
      (enc) => enc.replace("enc_", "plain_"),
    );

    expect(resolved.keyId).toBe("rzp_outlet");
    expect(resolved.secret).toBe("plain_outlet");
    expect(resolved.usedOutletOverride).toBe(true);
  });

  it("throws when no active gateways", () => {
    expect(() =>
      resolveCredentialsFromConfigs("org1", null, null, [
        {
          provider: "razorpay",
          isActive: false,
          config: emptyPaymentGatewayConfig(true),
        },
      ]),
    ).toThrow(/not configured/i);
  });

  it("parses stored config shape", () => {
    const parsed = parsePaymentGatewayConfig({
      isDefault: true,
      keyId: "k",
      secretEnc: "s",
      mode: "production",
      outlets: {
        o1: { override: true, keyId: "ok", secretEnc: "os", preferProvider: true },
      },
    });
    expect(parsed.isDefault).toBe(true);
    expect(parsed.mode).toBe("production");
    expect(parsed.outlets?.o1?.preferProvider).toBe(true);
  });
});

describe("tenant gateway signatures", () => {
  it("verifies Razorpay payment signature with tenant secret", () => {
    const secret = "tenant_secret";
    const orderId = "order_1";
    const paymentId = "pay_1";
    const signature = createHmac("sha256", secret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");
    expect(
      verifyTenantRazorpayPaymentSignature(secret, orderId, paymentId, signature),
    ).toBe(true);
    expect(
      verifyTenantRazorpayPaymentSignature(secret, orderId, paymentId, "bad"),
    ).toBe(false);
  });

  it("verifies Razorpay webhook signature with tenant webhook secret", () => {
    const secret = "whsec";
    const body = '{"event":"payment.captured"}';
    const signature = createHmac("sha256", secret).update(body).digest("hex");
    expect(verifyTenantRazorpayWebhookSignature(secret, body, signature)).toBe(
      true,
    );
    expect(verifyTenantRazorpayWebhookSignature(secret, body, "nope")).toBe(
      false,
    );
  });

  it("verifies Cashfree webhook signature", () => {
    const secret = "cf_secret";
    const timestamp = String(Math.floor(Date.now() / 1000));
    const body = '{"type":"PAYMENT_SUCCESS"}';
    const signature = createHmac("sha256", secret)
      .update(`${timestamp}${body}`)
      .digest("base64");
    expect(
      verifyCashfreeWebhookSignature(secret, body, signature, timestamp),
    ).toBe(true);
    expect(
      verifyCashfreeWebhookSignature(secret, body, "bad", timestamp),
    ).toBe(false);
  });

  it("rejects Cashfree webhooks with stale timestamps (replay)", () => {
    const secret = "cf_secret";
    const timestamp = "1710000000";
    const body = '{"type":"PAYMENT_SUCCESS"}';
    const signature = createHmac("sha256", secret)
      .update(`${timestamp}${body}`)
      .digest("base64");
    expect(
      verifyCashfreeWebhookSignature(secret, body, signature, timestamp),
    ).toBe(false);
  });
});

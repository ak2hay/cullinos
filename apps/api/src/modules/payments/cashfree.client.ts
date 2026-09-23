import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";
import { createHmac, timingSafeEqual } from "crypto";
import type { ResolvedPaymentCredentials } from "./payment-gateway.types";

const API_VERSION = "2023-08-01";

@Injectable()
export class CashfreeClient {
  private readonly logger = new Logger(CashfreeClient.name);

  private baseUrl(mode: "sandbox" | "production") {
    return mode === "production"
      ? "https://api.cashfree.com/pg"
      : "https://sandbox.cashfree.com/pg";
  }

  async createOrder(
    creds: ResolvedPaymentCredentials,
    input: {
      orderId: string;
      amount: number;
      customerId: string;
      customerPhone?: string;
      customerEmail?: string;
      customerName?: string;
      tags?: Record<string, string>;
      notifyUrl?: string;
      returnUrl?: string;
    },
  ): Promise<{
    cashfreeOrderId: string;
    paymentSessionId: string;
    orderAmount: number;
    orderCurrency: string;
  }> {
    if (!Number.isFinite(input.amount) || input.amount < 1) {
      throw new BadRequestException("Amount must be at least ₹1.00");
    }

    const body = {
      order_id: input.orderId.slice(0, 50),
      order_amount: Math.round(input.amount * 100) / 100,
      order_currency: "INR",
      customer_details: {
        customer_id: input.customerId.slice(0, 50),
        customer_phone: (input.customerPhone || "9999999999").replace(/\D/g, "").slice(-10) || "9999999999",
        customer_email: input.customerEmail || undefined,
        customer_name: input.customerName || undefined,
      },
      order_tags: input.tags,
      order_meta: {
        notify_url: input.notifyUrl,
        return_url: input.returnUrl,
      },
    };

    const res = await this.request(creds, "POST", "/orders", body);
    const paymentSessionId =
      typeof res.payment_session_id === "string" ? res.payment_session_id : "";
    const cashfreeOrderId =
      typeof res.order_id === "string"
        ? res.order_id
        : typeof res.cf_order_id === "string"
          ? String(res.cf_order_id)
          : input.orderId;

    if (!paymentSessionId) {
      throw new InternalServerErrorException(
        "Cashfree did not return a payment session",
      );
    }

    return {
      cashfreeOrderId,
      paymentSessionId,
      orderAmount:
        typeof res.order_amount === "number" ? res.order_amount : input.amount,
      orderCurrency:
        typeof res.order_currency === "string" ? res.order_currency : "INR",
    };
  }

  async getOrder(
    creds: ResolvedPaymentCredentials,
    orderId: string,
  ): Promise<{
    orderId: string;
    orderStatus: string;
    orderAmount?: number;
    orderCurrency?: string;
  }> {
    const res = await this.request(
      creds,
      "GET",
      `/orders/${encodeURIComponent(orderId)}`,
    );
    return {
      orderId:
        typeof res.order_id === "string" ? res.order_id : orderId,
      orderStatus:
        typeof res.order_status === "string" ? res.order_status : "UNKNOWN",
      orderAmount:
        typeof res.order_amount === "number" ? res.order_amount : undefined,
      orderCurrency:
        typeof res.order_currency === "string" ? res.order_currency : undefined,
    };
  }

  verifyWebhookSignature(
    secret: string | undefined,
    rawBody: Buffer | string,
    signature: string | undefined,
    timestamp: string | undefined,
  ): boolean {
    if (!secret || !signature || !timestamp) return false;
    // Reject stale timestamps (replay window: 5 minutes).
    const ts = Number(timestamp);
    if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) {
      return false;
    }
    const body = typeof rawBody === "string" ? rawBody : rawBody.toString("utf8");
    const signedPayload = `${timestamp}${body}`;
    const expected = createHmac("sha256", secret)
      .update(signedPayload)
      .digest("base64");
    try {
      const a = Buffer.from(expected);
      const b = Buffer.from(signature);
      return a.length === b.length && timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  private async request(
    creds: ResolvedPaymentCredentials,
    method: "GET" | "POST",
    path: string,
    body?: unknown,
  ): Promise<Record<string, unknown>> {
    const url = `${this.baseUrl(creds.mode)}${path}`;
    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "x-client-id": creds.keyId,
          "x-client-secret": creds.secret,
          "x-api-version": API_VERSION,
        },
        body: body != null ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      this.logger.error(
        `Cashfree network error: ${err instanceof Error ? err.message : err}`,
      );
      throw new InternalServerErrorException(
        "Could not reach Cashfree payment gateway",
      );
    }

    let json: Record<string, unknown> = {};
    try {
      json = (await res.json()) as Record<string, unknown>;
    } catch {
      /* empty */
    }

    if (!res.ok) {
      const message =
        typeof json.message === "string"
          ? json.message
          : typeof json.error === "string"
            ? json.error
            : `HTTP ${res.status}`;
      this.logger.error(`Cashfree ${method} ${path} failed: ${message}`);
      if (res.status === 400 || res.status === 404 || res.status === 422) {
        throw new BadRequestException(`Cashfree error: ${message}`);
      }
      if (res.status === 401 || res.status === 403) {
        throw new BadRequestException(
          "Cashfree authentication failed. Check this restaurant's Client ID and secret.",
        );
      }
      throw new InternalServerErrorException(`Cashfree error: ${message}`);
    }

    return json;
  }
}

/** Pure helpers for unit tests */
export function verifyCashfreeWebhookSignature(
  secret: string,
  rawBody: string,
  signature: string,
  timestamp: string,
  nowSec: number = Math.floor(Date.now() / 1000),
): boolean {
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(nowSec - ts) > 300) {
    return false;
  }
  const expected = createHmac("sha256", secret)
    .update(`${timestamp}${rawBody}`)
    .digest("base64");
  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

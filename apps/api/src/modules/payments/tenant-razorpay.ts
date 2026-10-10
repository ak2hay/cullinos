import {
  BadRequestException,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { createHmac, timingSafeEqual } from "crypto";
import Razorpay from "razorpay";
import type { ResolvedPaymentCredentials } from "./payment-gateway.types";

const MIN_AMOUNT_PAISE = 100;
const logger = new Logger("TenantRazorpay");

export type RazorpayNotes = Record<string, string>;

export function createTenantRazorpayInstance(creds: ResolvedPaymentCredentials) {
  return new Razorpay({
    key_id: creds.keyId,
    key_secret: creds.secret,
  });
}

export function verifyTenantRazorpayPaymentSignature(
  secret: string,
  orderId: string,
  paymentId: string,
  signature: string,
): boolean {
  const expected = createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function verifyTenantRazorpayWebhookSignature(
  webhookSecret: string | undefined,
  rawBody: Buffer | string,
  signature: string | undefined,
): boolean {
  if (!webhookSecret || !signature) return false;
  const body = typeof rawBody === "string" ? rawBody : rawBody.toString("utf8");
  const expected = createHmac("sha256", webhookSecret).update(body).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

function duplicateRefund(err: unknown): boolean {
  return /already exists|duplicate refund|refund.{0,40}already/i.test(extractMessage(err));
}

/** Full refund of a captured diner payment on the restaurant's Razorpay account. */
export async function refundTenantRazorpayPayment(
  creds: ResolvedPaymentCredentials,
  input: { paymentId: string; amountPaise: number; receipt: string },
): Promise<{ id: string }> {
  if (!input.paymentId.startsWith("pay_")) {
    throw new BadRequestException("Razorpay payment id is missing");
  }
  if (!Number.isFinite(input.amountPaise) || input.amountPaise < MIN_AMOUNT_PAISE) {
    throw new BadRequestException("Refund amount must be at least ₹1.00");
  }
  const instance = createTenantRazorpayInstance(creds);
  const paymentsApi = instance.payments as {
    refund: (
      paymentId: string,
      params: {
        amount: number;
        speed: "normal";
        receipt: string;
        notes: RazorpayNotes;
      },
    ) => Promise<{ id: string }>;
  };
  try {
    const refund = await paymentsApi.refund(input.paymentId, {
      amount: Math.round(input.amountPaise),
      speed: "normal",
      receipt: input.receipt.slice(0, 40),
      notes: { source: "cullinos_order_cancel" },
    });
    return { id: refund.id };
  } catch (err) {
    if (duplicateRefund(err)) return { id: input.receipt };
    return mapTenantRazorpayError(err, "refund payment");
  }
}

export async function createTenantRazorpayOrder(
  creds: ResolvedPaymentCredentials,
  input: {
    amountPaise: number;
    receipt: string;
    notes: RazorpayNotes;
    currency?: string;
  },
): Promise<{ id: string; amount: number; currency: string }> {
  if (!Number.isFinite(input.amountPaise) || input.amountPaise < MIN_AMOUNT_PAISE) {
    throw new BadRequestException(`Amount must be at least ${MIN_AMOUNT_PAISE} paise`);
  }
  const currency = (input.currency || "INR").toUpperCase();
  const instance = createTenantRazorpayInstance(creds);
  try {
    const order = (await instance.orders.create({
      amount: Math.round(input.amountPaise),
      currency,
      receipt: input.receipt.slice(0, 40),
      notes: input.notes,
    })) as { id: string; amount: number; currency: string };
    return {
      id: order.id,
      amount: order.amount,
      currency: order.currency,
    };
  } catch (err) {
    return mapTenantRazorpayError(err, "create order");
  }
}

function extractMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "object" && err && "error" in err) {
    const nested = (err as { error: unknown }).error;
    if (typeof nested === "object" && nested && "description" in nested) {
      const desc = (nested as { description?: unknown }).description;
      if (typeof desc === "string" && desc.trim()) return desc;
    }
  }
  return String(err);
}

function mapTenantRazorpayError(err: unknown, action: string): never {
  const status =
    typeof err === "object" && err && "statusCode" in err
      ? Number((err as { statusCode?: number }).statusCode)
      : undefined;
  const message = extractMessage(err);
  logger.error(`Tenant Razorpay ${action} failed (${status ?? "n/a"}): ${message}`);
  if (status === 401 || status === 403) {
    throw new UnauthorizedException(
      "Razorpay authentication failed. Check this restaurant's Key ID and secret.",
    );
  }
  if (status === 400 || status === 404 || status === 422) {
    throw new BadRequestException(`Razorpay could not ${action}: ${message}`);
  }
  throw new InternalServerErrorException(
    `Payment gateway failed while trying to ${action}. ${message}`,
  );
}

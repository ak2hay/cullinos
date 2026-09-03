import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { createHmac, timingSafeEqual } from "crypto";
import Razorpay from "razorpay";

export type RazorpayNotes = Record<string, string>;

@Injectable()
export class RazorpayClient {
  private readonly logger = new Logger(RazorpayClient.name);
  private instance: Razorpay | null = null;

  keyId(): string | undefined {
    return process.env.RAZORPAY_KEY_ID || undefined;
  }

  secret(): string | undefined {
    return process.env.RAZORPAY_KEY_SECRET || undefined;
  }

  webhookSecret(): string | undefined {
    return process.env.RAZORPAY_WEBHOOK_SECRET || undefined;
  }

  isConfigured(): boolean {
    return Boolean(this.keyId() && this.secret());
  }

  requireConfigured(): void {
    if (!this.isConfigured()) {
      throw new BadRequestException("Razorpay is not configured");
    }
  }

  getInstance(): Razorpay {
    this.requireConfigured();
    if (!this.instance) {
      this.instance = new Razorpay({
        key_id: this.keyId()!,
        key_secret: this.secret()!,
      });
    }
    return this.instance;
  }

  verifyWebhookSignature(rawBody: Buffer | string, signature: string | undefined): boolean {
    const secret = this.webhookSecret();
    if (!secret || !signature) return false;
    const body = typeof rawBody === "string" ? rawBody : rawBody.toString("utf8");
    const expected = createHmac("sha256", secret).update(body).digest("hex");
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  verifyPaymentSignature(orderId: string, paymentId: string, signature: string): boolean {
    this.requireConfigured();
    const expected = createHmac("sha256", this.secret()!)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  async createOrder(input: {
    amountPaise: number;
    receipt: string;
    notes: RazorpayNotes;
  }): Promise<{ id: string }> {
    return this.getInstance().orders.create({
      amount: input.amountPaise,
      currency: "INR",
      receipt: input.receipt.slice(0, 40),
      notes: input.notes,
    }) as Promise<{ id: string }>;
  }

  async createCustomer(input: {
    name: string;
    email?: string | null;
    contact?: string | null;
    notes: RazorpayNotes;
  }): Promise<{ id: string }> {
    return this.getInstance().customers.create({
      name: input.name,
      email: input.email || undefined,
      contact: input.contact || undefined,
      notes: input.notes,
      fail_existing: 0,
    }) as Promise<{ id: string }>;
  }

  async createPlan(input: {
    name: string;
    amountPaise: number;
    description?: string | null;
  }): Promise<{ id: string }> {
    return this.getInstance().plans.create({
      period: "monthly",
      interval: 1,
      item: {
        name: input.name,
        amount: input.amountPaise,
        currency: "INR",
        description: input.description || undefined,
      },
    }) as Promise<{ id: string }>;
  }

  async createSubscription(input: {
    planId: string;
    customerId: string;
    notes: RazorpayNotes;
  }): Promise<{ id: string; short_url?: string }> {
    const params = {
      plan_id: input.planId,
      customer_id: input.customerId,
      total_count: 120,
      customer_notify: 1 as const,
      notes: input.notes,
    };
    return this.getInstance().subscriptions.create(params as never);
  }

  async cancelSubscription(subscriptionId: string) {
    try {
      return await this.getInstance().subscriptions.cancel(subscriptionId, false);
    } catch (err) {
      this.logger.warn(
        `Failed to cancel Razorpay subscription ${subscriptionId}: ${
          err instanceof Error ? err.message : err
        }`,
      );
      return null;
    }
  }
}

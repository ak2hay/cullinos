import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  UnauthorizedException,
} from "@nestjs/common";
import { createHmac, timingSafeEqual } from "crypto";
import Razorpay from "razorpay";
import { PlatformConfigService } from "../platform-config/platform-config.service";

export type RazorpayNotes = Record<string, string>;

const RAZORPAY_KEYS = [
  "RAZORPAY_KEY_ID",
  "RAZORPAY_KEY_SECRET",
  "RAZORPAY_WEBHOOK_SECRET",
];

const MIN_AMOUNT_PAISE = 100;

@Injectable()
export class RazorpayClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RazorpayClient.name);
  private instance: Razorpay | null = null;
  private unsub?: () => void;

  constructor(private readonly config: PlatformConfigService) {}

  onModuleInit() {
    this.unsub = this.config.onChange((keys) => {
      if (keys.some((k) => RAZORPAY_KEYS.includes(k))) {
        this.instance = null;
      }
    });
  }

  onModuleDestroy() {
    this.unsub?.();
  }

  keyId(): string | undefined {
    return this.config.get("RAZORPAY_KEY_ID") || undefined;
  }

  secret(): string | undefined {
    return this.config.get("RAZORPAY_KEY_SECRET") || undefined;
  }

  webhookSecret(): string | undefined {
    return this.config.get("RAZORPAY_WEBHOOK_SECRET") || undefined;
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
    currency?: string;
  }): Promise<{ id: string; amount: number; currency: string }> {
    if (!Number.isFinite(input.amountPaise) || input.amountPaise < MIN_AMOUNT_PAISE) {
      throw new BadRequestException(`Amount must be at least ${MIN_AMOUNT_PAISE} paise`);
    }

    const currency = (input.currency || "INR").toUpperCase();
    try {
      const order = (await this.getInstance().orders.create({
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
      if (
        err instanceof BadRequestException ||
        err instanceof UnauthorizedException
      ) {
        throw err;
      }
      return this.mapRazorpayError(err, "create order");
    }
  }

  private extractRazorpayMessage(err: unknown): string {
    if (err instanceof Error && err.message) return err.message;
    if (typeof err === "object" && err && "error" in err) {
      const nested = (err as { error: unknown }).error;
      if (typeof nested === "object" && nested && "description" in nested) {
        const desc = (nested as { description?: unknown }).description;
        if (typeof desc === "string" && desc.trim()) return desc;
      }
      if (typeof nested === "string" && nested.trim()) return nested;
      try {
        return JSON.stringify(nested);
      } catch {
        /* ignore */
      }
    }
    return String(err);
  }

  private mapRazorpayError(err: unknown, action: string): never {
    if (
      err instanceof BadRequestException ||
      err instanceof UnauthorizedException ||
      err instanceof InternalServerErrorException
    ) {
      throw err;
    }

    const status =
      typeof err === "object" && err && "statusCode" in err
        ? Number((err as { statusCode?: number }).statusCode)
        : typeof err === "object" && err && "status" in err
          ? Number((err as { status?: number }).status)
          : undefined;
    const message = this.extractRazorpayMessage(err);

    this.logger.error(`Razorpay ${action} failed (${status ?? "n/a"}): ${message}`);

    if (status === 401 || status === 403) {
      throw new UnauthorizedException(
        "Razorpay authentication failed. Check RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.",
      );
    }
    if (status === 400 || status === 404 || status === 422) {
      throw new BadRequestException(
        `Razorpay could not ${action}: ${message}. Verify plan pricing and organization email/phone.`,
      );
    }
    throw new InternalServerErrorException(
      `Payment gateway failed while trying to ${action}. ${message}`,
    );
  }

  async createCustomer(input: {
    name: string;
    email?: string | null;
    contact?: string | null;
    notes: RazorpayNotes;
  }): Promise<{ id: string }> {
    try {
      return (await this.getInstance().customers.create({
        name: input.name,
        email: input.email || undefined,
        contact: input.contact || undefined,
        notes: input.notes,
        fail_existing: 0,
      })) as { id: string };
    } catch (err) {
      return this.mapRazorpayError(err, "create customer");
    }
  }

  async createPlan(input: {
    name: string;
    amountPaise: number;
    description?: string | null;
  }): Promise<{ id: string }> {
    try {
      return (await this.getInstance().plans.create({
        period: "monthly",
        interval: 1,
        item: {
          name: input.name,
          amount: input.amountPaise,
          currency: "INR",
          description: input.description || undefined,
        },
      })) as { id: string };
    } catch (err) {
      return this.mapRazorpayError(err, "create plan");
    }
  }

  async createSubscription(input: {
    planId: string;
    customerId: string;
    notes: RazorpayNotes;
  }): Promise<{ id: string; short_url?: string }> {
    try {
      const params = {
        plan_id: input.planId,
        customer_id: input.customerId,
        total_count: 120,
        customer_notify: 1 as const,
        notes: input.notes,
      };
      return (await this.getInstance().subscriptions.create(params as never)) as {
        id: string;
        short_url?: string;
      };
    } catch (err) {
      return this.mapRazorpayError(err, "create subscription");
    }
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

  async fetchOrder(orderId: string): Promise<{ id: string; amount: number; currency: string; status: string }> {
    try {
      const order = (await this.getInstance().orders.fetch(orderId)) as {
        id: string;
        amount: number;
        currency: string;
        status: string;
      };
      return {
        id: order.id,
        amount: Number(order.amount),
        currency: order.currency,
        status: order.status,
      };
    } catch (err) {
      return this.mapRazorpayError(err, "fetch order");
    }
  }
}

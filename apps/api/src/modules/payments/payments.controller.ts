import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  NotFoundException,
  Post,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import type { RawBodyRequest } from "@nestjs/common";
import { IsString } from "class-validator";
import type { Request } from "express";
import { OrgId, Public, RequireModule } from "../../common/decorators";
import { SaasBillingService } from "../subscriptions/saas-billing.service";
import { PaymentsService } from "./payments.service";
import { RazorpayClient } from "./razorpay.client";

class CashPaymentDto {
  @IsString()
  orderId!: string;
}

class OnlineIntentDto {
  @IsString()
  orderId!: string;
}

class OnlineVerifyDto {
  @IsString()
  razorpayOrderId!: string;

  @IsString()
  razorpayPaymentId!: string;

  @IsString()
  razorpaySignature!: string;
}

@Controller("payments")
export class PaymentsController {
  constructor(
    private service: PaymentsService,
    private razorpay: RazorpayClient,
    private saas: SaasBillingService,
  ) {}

  @Get()
  list(@OrgId() orgId: string) {
    return this.service.list(orgId);
  }

  @Post("cash")
  @RequireModule("pos")
  recordCash(@OrgId() orgId: string, @Body() body: CashPaymentDto) {
    return this.service.recordCash(orgId, body.orderId);
  }

  @Post("online/intent")
  @RequireModule("pos")
  createIntent(@OrgId() orgId: string, @Body() body: OnlineIntentDto) {
    return this.service.createOnlineIntent(orgId, body.orderId);
  }

  @Post("online/verify")
  @RequireModule("pos")
  verify(@OrgId() orgId: string, @Body() body: OnlineVerifyDto) {
    return this.service.verifyOnlinePayment(orgId, body);
  }

  @Public()
  @Post("webhooks/razorpay")
  async razorpayWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers("x-razorpay-signature") signature: string | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    const raw = req.rawBody;
    if (!raw) {
      throw new BadRequestException("Missing raw webhook body");
    }
    if (!this.razorpay.verifyWebhookSignature(raw, signature)) {
      throw new UnauthorizedException("Invalid webhook signature");
    }

    const event = typeof body.event === "string" ? body.event : "";
    const payload = (body.payload ?? {}) as Record<string, unknown>;
    const payment = (payload.payment as { entity?: Record<string, unknown> } | undefined)?.entity;
    const order = (payload.order as { entity?: Record<string, unknown> } | undefined)?.entity;
    const subscription = (payload.subscription as { entity?: Record<string, unknown> } | undefined)
      ?.entity;

    const kind =
      this.service.notesKind(payment) ??
      this.service.notesKind(order) ??
      this.service.notesKind(subscription);

    const isSaas =
      kind === "saas" ||
      event.startsWith("subscription.") ||
      Boolean(payment?.subscription_id);

    if (isSaas) {
      return this.saas.applyWebhook(event, payload);
    }

    if (event === "payment.failed") {
      const notes =
        typeof payment?.notes === "object" && payment.notes
          ? (payment.notes as Record<string, string>)
          : undefined;
      return this.completeDinerFromWebhook({
        paymentId: notes?.paymentId,
        razorpayOrderId: typeof payment?.order_id === "string" ? payment.order_id : undefined,
        razorpayPaymentId: typeof payment?.id === "string" ? payment.id : undefined,
        method: typeof payment?.method === "string" ? payment.method : undefined,
        failed: true,
      });
    }

    if (event === "payment.captured" || event === "order.paid") {
      const notes =
        (typeof payment?.notes === "object" && payment.notes
          ? (payment.notes as Record<string, string>)
          : undefined) ??
        (typeof order?.notes === "object" && order.notes
          ? (order.notes as Record<string, string>)
          : undefined);
      return this.completeDinerFromWebhook({
        organizationId: notes?.organizationId,
        paymentId: notes?.paymentId,
        orderId: notes?.orderId,
        razorpayOrderId:
          (typeof payment?.order_id === "string" ? payment.order_id : undefined) ??
          (typeof order?.id === "string" ? order.id : undefined),
        razorpayPaymentId: typeof payment?.id === "string" ? payment.id : undefined,
        method: typeof payment?.method === "string" ? payment.method : undefined,
      });
    }

    return { ignored: true, event };
  }

  private async completeDinerFromWebhook(
    input: Parameters<PaymentsService["completeDinerPayment"]>[0],
  ) {
    try {
      return await this.service.completeDinerPayment(input);
    } catch (err) {
      if (err instanceof NotFoundException) {
        return { ignored: true, reason: "payment_not_found" };
      }
      throw err;
    }
  }
}

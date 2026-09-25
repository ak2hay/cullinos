import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import type { RawBodyRequest } from "@nestjs/common";
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
} from "class-validator";
import type { Request } from "express";
import { OrgId, Public, RequireModule, CurrentUser } from "../../common/decorators";
import type { JwtPayload } from "@cullinos/auth";
import { SaasBillingService } from "../subscriptions/saas-billing.service";
import { CashfreeClient } from "./cashfree.client";
import { PaymentCredentialsService } from "./payment-credentials.service";
import { PaymentsService } from "./payments.service";
import { RazorpayClient } from "./razorpay.client";

class CashPaymentDto {
  @IsString()
  @IsNotEmpty()
  orderId!: string;

  @IsOptional()
  amount?: number;
}

class OnlineIntentDto {
  @IsString()
  @IsNotEmpty()
  orderId!: string;

  @IsOptional()
  amount?: number;

  @IsOptional()
  @IsString()
  @IsIn(["razorpay", "cashfree"])
  provider?: string;
}

class OnlineVerifyDto {
  @IsOptional()
  @IsString()
  @IsIn(["razorpay", "cashfree"])
  provider?: string;

  @IsOptional()
  @IsString()
  razorpayOrderId?: string;

  @IsOptional()
  @IsString()
  razorpayPaymentId?: string;

  @IsOptional()
  @IsString()
  razorpaySignature?: string;

  @IsOptional()
  @IsString()
  cashfreeOrderId?: string;
}

class UpsertGatewayDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsString()
  @IsIn(["sandbox", "production"])
  mode?: "sandbox" | "production";

  @IsOptional()
  @IsString()
  keyId?: string;

  @IsOptional()
  @IsString()
  secret?: string;

  @IsOptional()
  @IsString()
  webhookSecret?: string;

  @IsOptional()
  @IsBoolean()
  clearWebhookSecret?: boolean;
}

class UpsertOutletGatewayDto {
  @IsBoolean()
  override!: boolean;

  @IsOptional()
  @IsBoolean()
  preferProvider?: boolean;

  @IsOptional()
  @IsString()
  @IsIn(["sandbox", "production"])
  mode?: "sandbox" | "production";

  @IsOptional()
  @IsString()
  keyId?: string;

  @IsOptional()
  @IsString()
  secret?: string;

  @IsOptional()
  @IsString()
  webhookSecret?: string;

  @IsOptional()
  @IsBoolean()
  clearWebhookSecret?: boolean;
}

@Controller("payments")
export class PaymentsController {
  constructor(
    private service: PaymentsService,
    private credentials: PaymentCredentialsService,
    private cashfree: CashfreeClient,
    private razorpay: RazorpayClient,
    private saas: SaasBillingService,
  ) {}

  @Get()
  list(@OrgId() orgId: string) {
    return this.service.list(orgId);
  }

  @Get("gateways/status")
  @RequireModule("pos")
  gatewayStatus(@OrgId() orgId: string, @Query("outletId") outletId?: string) {
    return this.credentials.onlineStatus(orgId, outletId || null);
  }

  @Get("gateways")
  @RequireModule("settings")
  listGateways(@OrgId() orgId: string) {
    return this.credentials.listGateways(orgId);
  }

  @Get("gateways/:provider")
  @RequireModule("settings")
  getGateway(@OrgId() orgId: string, @Param("provider") provider: string) {
    return this.credentials.getGateway(orgId, provider);
  }

  @Put("gateways/:provider")
  @RequireModule("settings")
  upsertGateway(
    @OrgId() orgId: string,
    @Param("provider") provider: string,
    @Body() body: UpsertGatewayDto,
  ) {
    return this.credentials.upsertOrgGateway(orgId, provider, body);
  }

  @Put("gateways/:provider/outlets/:outletId")
  @RequireModule("settings")
  upsertOutletGateway(
    @OrgId() orgId: string,
    @Param("provider") provider: string,
    @Param("outletId") outletId: string,
    @Body() body: UpsertOutletGatewayDto,
  ) {
    return this.credentials.upsertOutletOverride(
      orgId,
      provider,
      outletId,
      body,
    );
  }

  @Post("cash")
  @RequireModule("pos")
  recordCash(
    @OrgId() orgId: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: CashPaymentDto,
  ) {
    return this.service.recordCash(orgId, body.orderId, body.amount, user.sub);
  }

  @Get("orders/:orderId/balance")
  @RequireModule("pos")
  balance(@OrgId() orgId: string, @Param("orderId") orderId: string) {
    return this.service.getBalance(orgId, orderId);
  }

  @Post("online/intent")
  @RequireModule("pos")
  createIntent(@OrgId() orgId: string, @Body() body: OnlineIntentDto) {
    return this.service.createOnlineIntent(
      orgId,
      body.orderId,
      body.amount,
      body.provider,
    );
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

    const resolved = await this.service.resolveRazorpayWebhookCredentials(body);

    if (resolved.kind === "saas") {
      if (!this.razorpay.verifyWebhookSignature(raw, signature)) {
        throw new UnauthorizedException("Invalid webhook signature");
      }
    } else if (resolved.kind === "diner") {
      if (!this.service.verifyDinerRazorpayWebhook(resolved.creds, raw, signature)) {
        throw new UnauthorizedException("Invalid webhook signature");
      }
    } else {
      // Unknown — try platform (legacy SaaS) then reject
      if (!this.razorpay.verifyWebhookSignature(raw, signature)) {
        throw new UnauthorizedException("Invalid webhook signature");
      }
    }

    const event = typeof body.event === "string" ? body.event : "";
    const eventId =
      typeof body.id === "string"
        ? body.id
        : typeof (body as { event_id?: unknown }).event_id === "string"
          ? (body as { event_id: string }).event_id
          : null;

    if (!eventId) {
      throw new BadRequestException("Missing webhook event id");
    }

    const claimed = await this.service.claimWebhookEvent({
      provider: "razorpay",
      eventId,
      eventType: event || "unknown",
      payload: body,
    });
    if (!claimed) {
      return { duplicate: true, event, eventId };
    }

    const payload = (body.payload ?? {}) as Record<string, unknown>;
    const payment = (payload.payment as { entity?: Record<string, unknown> } | undefined)
      ?.entity;
    const order = (payload.order as { entity?: Record<string, unknown> } | undefined)
      ?.entity;
    const subscription = (
      payload.subscription as { entity?: Record<string, unknown> } | undefined
    )?.entity;

    const kind =
      this.service.notesKind(payment) ??
      this.service.notesKind(order) ??
      this.service.notesKind(subscription);

    const isSaas =
      resolved.kind === "saas" ||
      kind === "saas" ||
      event.startsWith("subscription.") ||
      Boolean(payment?.subscription_id);

    if (isSaas) {
      return this.saas.applyWebhook(event, payload);
    }

    const amountPaise =
      typeof payment?.amount === "number"
        ? payment.amount
        : typeof order?.amount === "number"
          ? order.amount
          : undefined;
    const currency =
      typeof payment?.currency === "string"
        ? payment.currency
        : typeof order?.currency === "string"
          ? order.currency
          : undefined;

    if (event === "payment.failed") {
      const notes =
        typeof payment?.notes === "object" && payment.notes
          ? (payment.notes as Record<string, string>)
          : undefined;
      return this.completeDinerFromWebhook({
        paymentId: notes?.paymentId,
        organizationId: notes?.organizationId ?? resolved.organizationId,
        razorpayOrderId:
          typeof payment?.order_id === "string" ? payment.order_id : undefined,
        razorpayPaymentId: typeof payment?.id === "string" ? payment.id : undefined,
        method: typeof payment?.method === "string" ? payment.method : undefined,
        amountPaise,
        currency,
        failed: true,
        provider: "razorpay",
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
        organizationId: notes?.organizationId ?? resolved.organizationId,
        paymentId: notes?.paymentId ?? resolved.paymentId,
        orderId: notes?.orderId,
        razorpayOrderId:
          (typeof payment?.order_id === "string" ? payment.order_id : undefined) ??
          (typeof order?.id === "string" ? order.id : undefined),
        razorpayPaymentId: typeof payment?.id === "string" ? payment.id : undefined,
        method: typeof payment?.method === "string" ? payment.method : undefined,
        amountPaise,
        currency,
        provider: "razorpay",
      });
    }

    return { ignored: true, event };
  }

  @Public()
  @Post("webhooks/cashfree")
  async cashfreeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers("x-webhook-signature") signature: string | undefined,
    @Headers("x-webhook-timestamp") timestamp: string | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    const raw = req.rawBody;
    if (!raw) {
      throw new BadRequestException("Missing raw webhook body");
    }

    const resolved = await this.service.resolveCashfreeWebhookCredentials(body);
    if (
      !resolved.creds ||
      !this.cashfree.verifyWebhookSignature(
        resolved.creds.webhookSecret ?? resolved.creds.secret,
        raw,
        signature,
        timestamp,
      )
    ) {
      throw new UnauthorizedException("Invalid webhook signature");
    }

    const eventType =
      typeof body.type === "string"
        ? body.type
        : typeof body.event === "string"
          ? body.event
          : "cashfree.webhook";
    const eventId =
      typeof body.event_time === "string"
        ? `${resolved.cashfreeOrderId ?? "cf"}:${body.event_time}:${eventType}`
        : `${resolved.cashfreeOrderId ?? "cf"}:${eventType}:${Date.now()}`;

    const claimed = await this.service.claimWebhookEvent({
      provider: "cashfree",
      eventId,
      eventType,
      payload: body,
    });
    if (!claimed) {
      return { duplicate: true, event: eventType, eventId };
    }

    const data = (body.data ?? body) as Record<string, unknown>;
    const order = (data.order ?? data) as Record<string, unknown>;
    const payment = (data.payment ?? {}) as Record<string, unknown>;
    const status =
      (typeof order.order_status === "string" ? order.order_status : undefined) ??
      (typeof payment.payment_status === "string"
        ? payment.payment_status
        : undefined);

    const failed =
      status === "FAILED" ||
      status === "EXPIRED" ||
      status === "CANCELLED" ||
      eventType.toLowerCase().includes("failed");

    const paid =
      status === "PAID" ||
      status === "SUCCESS" ||
      eventType.toLowerCase().includes("success") ||
      eventType.toLowerCase().includes("paid");

    if (failed) {
      return this.completeDinerFromWebhook({
        organizationId: resolved.organizationId,
        paymentId: resolved.paymentId,
        cashfreeOrderId: resolved.cashfreeOrderId,
        failed: true,
        provider: "cashfree",
      });
    }

    if (paid) {
      const amount =
        typeof order.order_amount === "number"
          ? order.order_amount
          : typeof payment.payment_amount === "number"
            ? payment.payment_amount
            : undefined;
      return this.completeDinerFromWebhook({
        organizationId: resolved.organizationId,
        paymentId: resolved.paymentId,
        cashfreeOrderId: resolved.cashfreeOrderId,
        amountPaise: amount != null ? Math.round(amount * 100) : undefined,
        currency: "INR",
        method:
          typeof payment.payment_group === "string"
            ? payment.payment_group
            : undefined,
        provider: "cashfree",
      });
    }

    return { ignored: true, event: eventType, status };
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

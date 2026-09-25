import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Post,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { createHash, randomBytes, randomInt } from "crypto";
import { JwtService } from "@nestjs/jwt";
import { Public } from "../../common/decorators";
import { getJwtSecret } from "../../common/jwt-secret.util";
import { PrismaService } from "../../prisma/prisma.service";
import { Msg91Service } from "../sms/msg91.service";
import { ConsentService } from "../privacy/consent.service";
import {
  DPDP_NOTICE_SUMMARY,
  DPDP_NOTICE_VERSION,
  DPDP_PURPOSES,
} from "../privacy/privacy.constants";
import { newUnsubscribeToken } from "../privacy/privacy.crypto";
import {
  phoneOtpSmsFailureMessage,
  shouldFailPhoneOtpWhenUnsent,
} from "./phone-otp-request.util";
import { PlatformConfigService } from "../platform-config/platform-config.service";
import { sandboxAllowsSmsOtpSkip } from "../../common/sandbox-access.util";

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

@Controller("public/auth")
@Throttle({ default: { limit: 10, ttl: 60_000 } })
export class CustomerAuthController {
  constructor(
    private prisma: PrismaService,
    private msg91: Msg91Service,
    private jwt: JwtService,
    private consent: ConsentService,
    private platformConfig: PlatformConfigService,
  ) {}

  @Public()
  @Get("otp/widget-config")
  widgetConfig() {
    return {
      ...this.msg91.getWidgetPublicConfig(),
      noticeVersion: DPDP_NOTICE_VERSION,
      noticeSummary:
        "We use your phone number to send a one-time login code and to identify your customer profile for orders and loyalty. See privacy notice for rights and marketing choices.",
    };
  }

  @Public()
  @Post("otp/request")
  async requestOtp(@Body() body: { phone?: string; orgId?: string; organizationId?: string }) {
    const orgId = body.orgId ?? body.organizationId;
    const rawPhone = body.phone?.trim();
    if (!orgId || !rawPhone) {
      throw new BadRequestException("phone and orgId are required");
    }

    const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
    if (!org || org.status === "suspended" || org.status === "cancelled") {
      throw new BadRequestException("Organization not available");
    }

    const phone = this.msg91.normalizePhone(rawPhone);
    if (phone.length < 10) {
      throw new BadRequestException("Invalid phone number");
    }

    const otp = sandboxAllowsSmsOtpSkip(org) ? "000000" : String(randomInt(100000, 999999));
    const challengeToken = randomBytes(24).toString("hex");
    const ttl = this.msg91.otpTtlSeconds();
    const expiresAt = new Date(Date.now() + ttl * 1000);

    const challenge = await this.prisma.phoneOtp.create({
      data: {
        phone,
        organizationId: orgId,
        codeHash: hashCode(otp),
        challengeToken,
        expiresAt,
      },
    });

    if (sandboxAllowsSmsOtpSkip(org)) {
      return {
        challengeToken,
        expiresIn: ttl,
        sent: true,
        provider: "sandbox",
        debugOtp: otp,
        noticeVersion: DPDP_NOTICE_VERSION,
        purpose: DPDP_PURPOSES.ACCOUNT_AUTH,
      };
    }

    const send = await this.msg91.sendOtp(phone, otp);

    if (shouldFailPhoneOtpWhenUnsent(send.sent)) {
      await this.prisma.phoneOtp.delete({ where: { id: challenge.id } }).catch(() => undefined);
      throw new ServiceUnavailableException(phoneOtpSmsFailureMessage(send.failureKind));
    }

    return {
      challengeToken,
      expiresIn: ttl,
      sent: send.sent,
      provider: send.provider,
      noticeVersion: DPDP_NOTICE_VERSION,
      purpose: DPDP_PURPOSES.ACCOUNT_AUTH,
      ...(send.provider === "log" && process.env.NODE_ENV !== "production"
        ? { debugOtp: otp }
        : {}),
    };
  }

  @Public()
  @Post("otp/verify")
  async verifyOtp(
    @Body()
    body: {
      challengeToken?: string;
      code?: string;
      name?: string;
      marketingEmailOptIn?: boolean;
      marketingSmsOptIn?: boolean;
    },
  ) {
    const token = body.challengeToken?.trim();
    const code = body.code?.trim();
    if (!token || !code) {
      throw new BadRequestException("challengeToken and code are required");
    }

    const challenge = await this.prisma.phoneOtp.findUnique({
      where: { challengeToken: token },
    });
    if (!challenge || challenge.consumedAt) {
      throw new UnauthorizedException("Invalid or expired OTP");
    }
    if (challenge.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException("OTP expired");
    }
    if (challenge.attempts >= 5) {
      throw new UnauthorizedException("Too many attempts");
    }

    if (challenge.codeHash !== hashCode(code)) {
      await this.prisma.phoneOtp.update({
        where: { id: challenge.id },
        data: { attempts: { increment: 1 } },
      });
      throw new UnauthorizedException("Invalid OTP");
    }

    await this.prisma.phoneOtp.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() },
    });

    return this.issueCustomerSession({
      organizationId: challenge.organizationId,
      phone: challenge.phone,
      name: body.name,
      marketingEmailOptIn: body.marketingEmailOptIn,
      marketingSmsOptIn: body.marketingSmsOptIn,
    });
  }

  /**
   * MSG91 OTP Widget success → verify JWT server-side with authkey, then issue Cullinos session.
   */
  @Public()
  @Post("otp/widget-verify")
  async verifyWidget(
    @Body()
    body: {
      orgId?: string;
      organizationId?: string;
      accessToken?: string;
      /** Verified identifier from MSG91 widget success callback (fallback). */
      phone?: string;
      identifier?: string;
      name?: string;
      marketingEmailOptIn?: boolean;
      marketingSmsOptIn?: boolean;
    },
  ) {
    const orgId = body.orgId ?? body.organizationId;
    const accessToken = body.accessToken?.trim();
    if (!orgId || !accessToken) {
      throw new BadRequestException("orgId and accessToken are required");
    }

    const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
    if (!org || org.status === "suspended" || org.status === "cancelled") {
      throw new BadRequestException("Organization not available");
    }

    if (!this.msg91.isWidgetConfigured()) {
      throw new BadRequestException("MSG91 OTP Widget is not configured");
    }

    const verified = await this.msg91.verifyWidgetAccessToken(accessToken);
    const fallbackRaw = body.identifier ?? body.phone;
    const fallbackPhone = fallbackRaw
      ? this.msg91.normalizePhone(String(fallbackRaw))
      : null;

    let phone = verified.ok && verified.phone ? verified.phone : null;
    // MSG91 sometimes returns HTTP 200 without embedding the phone; the widget
    // success callback still includes the verified identifier for that token.
    if (!phone && verified.ok && fallbackPhone && fallbackPhone.length >= 10) {
      phone = fallbackPhone;
    }

    if (!phone) {
      throw new UnauthorizedException(
        verified.ok
          ? "OTP verified but phone was missing from MSG91. Please try again."
          : (verified.message ?? "OTP verification failed"),
      );
    }

    return this.issueCustomerSession({
      organizationId: orgId,
      phone,
      name: body.name,
      marketingEmailOptIn: body.marketingEmailOptIn,
      marketingSmsOptIn: body.marketingSmsOptIn,
    });
  }

  @Public()
  @Get("me")
  async me(@Headers("authorization") auth?: string) {
    if (!auth?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing token");
    }
    try {
      const payload = this.jwt.verify(auth.slice(7), {
        secret: getJwtSecret(),
      }) as { sub: string; type?: string };
      if (payload.type !== "customer") {
        throw new UnauthorizedException("Not a customer token");
      }
      const customer = await this.prisma.customer.findUnique({
        where: { id: payload.sub },
      });
      if (!customer || customer.anonymizedAt) {
        throw new UnauthorizedException("Customer not found");
      }
      return {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        loyaltyPoints: customer.loyaltyPoints,
        stampCount: customer.stampCount,
        organizationId: customer.organizationId,
        marketingEmailOptIn: customer.marketingEmailOptIn,
        marketingSmsOptIn: customer.marketingSmsOptIn,
      };
    } catch {
      throw new UnauthorizedException("Invalid token");
    }
  }

  private async issueCustomerSession(input: {
    organizationId: string;
    phone: string;
    name?: string;
    marketingEmailOptIn?: boolean;
    marketingSmsOptIn?: boolean;
  }) {
    const displayPhone =
      input.phone.startsWith("91") && input.phone.length === 12
        ? input.phone.slice(2)
        : input.phone;

    let customer = await this.prisma.customer.findFirst({
      where: {
        organizationId: input.organizationId,
        anonymizedAt: null,
        phone: { in: [input.phone, displayPhone, `+${input.phone}`] },
      },
    });

    const isNew = !customer;

    if (!customer) {
      customer = await this.prisma.customer.create({
        data: {
          organizationId: input.organizationId,
          phone: displayPhone,
          name: input.name?.trim() || `Guest ${displayPhone.slice(-4)}`,
          unsubscribeToken: newUnsubscribeToken(),
          marketingEmailOptIn: Boolean(input.marketingEmailOptIn),
          marketingSmsOptIn: Boolean(input.marketingSmsOptIn),
          marketingOptInAt:
            input.marketingEmailOptIn || input.marketingSmsOptIn
              ? new Date()
              : null,
        },
      });
    } else if (input.name?.trim() && customer.name.startsWith("Guest ")) {
      customer = await this.prisma.customer.update({
        where: { id: customer.id },
        data: { name: input.name.trim() },
      });
    }

    await this.consent.record({
      organizationId: input.organizationId,
      subjectType: "customer",
      subjectId: customer.id,
      purpose: DPDP_PURPOSES.ACCOUNT_AUTH,
      granted: true,
      source: isNew ? "otp_login_new" : "otp_login",
    });

    if (isNew) {
      await this.consent.record({
        organizationId: input.organizationId,
        subjectType: "customer",
        subjectId: customer.id,
        purpose: DPDP_PURPOSES.SERVICE,
        granted: true,
        source: "otp_login_new",
      });
    }

    if (input.marketingEmailOptIn) {
      await this.consent.record({
        organizationId: input.organizationId,
        subjectType: "customer",
        subjectId: customer.id,
        purpose: DPDP_PURPOSES.MARKETING_EMAIL,
        granted: true,
        source: "otp_login",
      });
      if (!customer.marketingEmailOptIn) {
        customer = await this.prisma.customer.update({
          where: { id: customer.id },
          data: {
            marketingEmailOptIn: true,
            marketingOptInAt: new Date(),
            marketingOptOutAt: null,
          },
        });
      }
    }

    if (input.marketingSmsOptIn) {
      await this.consent.record({
        organizationId: input.organizationId,
        subjectType: "customer",
        subjectId: customer.id,
        purpose: DPDP_PURPOSES.MARKETING_SMS,
        granted: true,
        source: "otp_login",
      });
      if (!customer.marketingSmsOptIn) {
        customer = await this.prisma.customer.update({
          where: { id: customer.id },
          data: {
            marketingSmsOptIn: true,
            marketingOptInAt: new Date(),
            marketingOptOutAt: null,
          },
        });
      }
    }

    const accessToken = this.jwt.sign(
      {
        sub: customer.id,
        type: "customer",
        orgId: input.organizationId,
        phone: customer.phone,
      },
      { expiresIn: "30d" },
    );

    return {
      accessToken,
      notice: DPDP_NOTICE_SUMMARY,
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        loyaltyPoints: customer.loyaltyPoints,
        stampCount: customer.stampCount,
        marketingEmailOptIn: customer.marketingEmailOptIn,
        marketingSmsOptIn: customer.marketingSmsOptIn,
      },
    };
  }
}

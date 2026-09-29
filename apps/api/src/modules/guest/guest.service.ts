import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { createHash, randomBytes, randomInt } from "crypto";
import { JwtService } from "@nestjs/jwt";
import { hashPassword, verifyPassword } from "@cullinos/auth";
import { getJwtSecret } from "../../common/jwt-secret.util";
import { PrismaService } from "../../prisma/prisma.service";
import { Msg91Service } from "../sms/msg91.service";
import { friendlyMsg91WidgetMessage } from "../sms/msg91-widget-messages";
import {
  PHONE_OTP_MAX_ATTEMPTS,
  PHONE_OTP_PER_PHONE_PER_HOUR,
  phoneOtpSmsFailureMessage,
} from "../customers/phone-otp-request.util";

const GUEST_PIN_MAX_FAILURES = 5;
const GUEST_PIN_LOCK_MS = 15 * 60 * 1000;
import {
  DPDP_NOTICE_VERSION,
  DPDP_PURPOSES,
} from "../privacy/privacy.constants";
import { newUnsubscribeToken } from "../privacy/privacy.crypto";
import { ConsentService } from "../privacy/consent.service";
import { LoyaltyService } from "../loyalty/loyalty.service";
import { FirebaseAdminService } from "./firebase-admin.service";
import { PlatformConfigService } from "../platform-config/platform-config.service";

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

function assertPinFormat(pin: string) {
  if (!/^\d{4,6}$/.test(pin)) {
    throw new BadRequestException("PIN must be 4–6 digits");
  }
  if (/^(\d)\1+$/.test(pin)) {
    throw new BadRequestException("PIN is too weak");
  }
  const sequential = "0123456789012345678909876543210";
  if (sequential.includes(pin)) {
    throw new BadRequestException("PIN is too weak");
  }
}

@Injectable()
export class GuestService {
  private readonly logger = new Logger(GuestService.name);

  constructor(
    private prisma: PrismaService,
    private msg91: Msg91Service,
    private jwt: JwtService,
    private loyalty: LoyaltyService,
    private firebaseAdmin: FirebaseAdminService,
    private platformConfig: PlatformConfigService,
    @Optional() private consent?: ConsentService,
  ) {}

  /**
   * Guest app marketing choices apply to every restaurant the guest has joined: mirror
   * them onto each linked customer and keep a per-restaurant consent record (DPDP).
   */
  private async syncGuestMarketingConsent(
    guestUserId: string,
    prefs: { marketingEmailOptIn?: boolean; marketingSmsOptIn?: boolean },
    source: string,
    onlyOrganizationId?: string,
  ) {
    const channels: Array<{ field: "marketingEmailOptIn" | "marketingSmsOptIn"; purpose: string; value: boolean }> = [];
    if (prefs.marketingEmailOptIn != null) {
      channels.push({ field: "marketingEmailOptIn", purpose: DPDP_PURPOSES.MARKETING_EMAIL, value: Boolean(prefs.marketingEmailOptIn) });
    }
    if (prefs.marketingSmsOptIn != null) {
      channels.push({ field: "marketingSmsOptIn", purpose: DPDP_PURPOSES.MARKETING_SMS, value: Boolean(prefs.marketingSmsOptIn) });
    }
    if (!channels.length) return;
    const memberships = await this.prisma.guestOrgMembership.findMany({
      where: { guestUserId, ...(onlyOrganizationId ? { organizationId: onlyOrganizationId } : {}) },
      select: { organizationId: true, customerId: true, customer: { select: { marketingEmailOptIn: true, marketingSmsOptIn: true, anonymizedAt: true } } },
    });
    for (const m of memberships) {
      if (m.customer.anonymizedAt) continue;
      const changed = channels.filter((c) => m.customer[c.field] !== c.value);
      if (!changed.length && !onlyOrganizationId) continue;
      if (changed.length) {
        const granting = changed.some((c) => c.value);
        await this.prisma.customer.update({
          where: { id: m.customerId },
          data: {
            ...Object.fromEntries(changed.map((c) => [c.field, c.value])),
            ...(granting ? { marketingOptInAt: new Date() } : { marketingOptOutAt: new Date() }),
          },
        });
      }
      for (const c of onlyOrganizationId ? channels : changed) {
        await this.consent
          ?.record({
            organizationId: m.organizationId,
            subjectType: "customer",
            subjectId: m.customerId,
            purpose: c.purpose,
            granted: c.value,
            source,
          })
          .catch((err) =>
            this.logger.warn(`Consent record failed: ${err instanceof Error ? err.message : err}`),
          );
      }
    }
  }

  private normalizeGuestPhone(rawPhone?: string): string {
    if (!rawPhone?.trim()) {
      throw new BadRequestException("phone is required");
    }
    const phone = this.msg91.normalizePhone(rawPhone);
    const digits = phone.replace(/\D/g, "");
    // Accept 10-digit local or 12-digit 91XXXXXXXXXX
    const canonical = digits.length === 10 ? `91${digits}` : digits;
    if (/^91[6-9]\d{9}$/.test(canonical)) {
      return canonical;
    }
    throw new BadRequestException("Enter a valid 10-digit mobile number");
  }

  async phoneStatus(rawPhone?: string) {
    const phone = this.normalizeGuestPhone(rawPhone);
    const guest = await this.prisma.guestUser.findUnique({
      where: { phone },
      select: { id: true, pinHash: true, anonymizedAt: true },
    });
    // Accounts without a PIN look identical to unknown numbers (both go through OTP), so only
    // PIN holders are distinguishable, and the route is tightly throttled.
    const hasPin = Boolean(guest && !guest.anonymizedAt && guest.pinHash);
    return { exists: hasPin, hasPin };
  }

  async requestOtp(rawPhone?: string) {
    const phone = this.normalizeGuestPhone(rawPhone);
    const recent = await this.prisma.guestPhoneOtp.count({
      where: { phone, createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
    });
    if (recent >= PHONE_OTP_PER_PHONE_PER_HOUR) {
      throw new HttpException(
        "Too many OTP requests. Please try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const otp = String(randomInt(100000, 999999));
    const challengeToken = randomBytes(24).toString("hex");
    const ttl = this.msg91.otpTtlSeconds();
    const expiresAt = new Date(Date.now() + ttl * 1000);

    const challenge = await this.prisma.guestPhoneOtp.create({
      data: {
        phone,
        codeHash: hashCode(otp),
        challengeToken,
        expiresAt,
      },
    });

    const send = await this.msg91.sendOtp(phone, otp);
    // Always require a real MSG91 delivery — never return on-screen / debug OTP.
    if (!send.sent) {
      await this.prisma.guestPhoneOtp
        .delete({ where: { id: challenge.id } })
        .catch(() => undefined);
      throw new ServiceUnavailableException(phoneOtpSmsFailureMessage(send.failureKind));
    }

    return {
      challengeToken,
      expiresIn: ttl,
      sent: true,
      provider: send.provider,
      noticeVersion: DPDP_NOTICE_VERSION,
      purpose: DPDP_PURPOSES.ACCOUNT_AUTH,
    };
  }

  async verifyOtp(body: {
    challengeToken?: string;
    code?: string;
    name?: string;
    marketingEmailOptIn?: boolean;
    marketingSmsOptIn?: boolean;
  }) {
    const token = body.challengeToken?.trim();
    const code = body.code?.trim();
    if (!token || !code) {
      throw new BadRequestException("challengeToken and code are required");
    }

    const challenge = await this.prisma.guestPhoneOtp.findUnique({
      where: { challengeToken: token },
    });
    if (!challenge || challenge.consumedAt) {
      throw new UnauthorizedException("Invalid or used challenge");
    }
    if (challenge.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException("OTP expired");
    }
    if (challenge.attempts >= PHONE_OTP_MAX_ATTEMPTS) {
      throw new UnauthorizedException("Too many attempts");
    }
    const live = {
      id: challenge.id,
      consumedAt: null,
      attempts: { lt: PHONE_OTP_MAX_ATTEMPTS },
    };
    if (challenge.codeHash !== hashCode(code)) {
      await this.prisma.guestPhoneOtp.updateMany({
        where: live,
        data: { attempts: { increment: 1 } },
      });
      throw new UnauthorizedException("Invalid code");
    }

    const claimed = await this.prisma.guestPhoneOtp.updateMany({
      where: live,
      data: { consumedAt: new Date() },
    });
    if (claimed.count !== 1) {
      throw new UnauthorizedException("Invalid or used challenge");
    }

    const guest = await this.prisma.guestUser.upsert({
      where: { phone: challenge.phone },
      create: {
        phone: challenge.phone,
        name: body.name?.trim() || undefined,
        marketingEmailOptIn: Boolean(body.marketingEmailOptIn),
        marketingSmsOptIn: Boolean(body.marketingSmsOptIn),
      },
      update: {
        ...(body.name?.trim() ? { name: body.name.trim() } : {}),
        ...(body.marketingEmailOptIn != null
          ? { marketingEmailOptIn: Boolean(body.marketingEmailOptIn) }
          : {}),
        ...(body.marketingSmsOptIn != null
          ? { marketingSmsOptIn: Boolean(body.marketingSmsOptIn) }
          : {}),
        anonymizedAt: null,
      },
    });

    this.assertGuestActive(guest);
    await this.syncGuestMarketingConsent(guest.id, body, "guest_app_login");

    const accessToken = this.signGuestToken(guest.id, guest.phone);
    const requiresPinSetup = !guest.pinHash;

    return {
      accessToken,
      guest: this.mapGuest(guest),
      requiresPinSetup,
      noticeVersion: DPDP_NOTICE_VERSION,
    };
  }

  /** Public MSG91 OTP Widget bootstrap (never includes auth key). */
  widgetConfig() {
    return {
      ...this.msg91.getWidgetPublicConfig(),
      // tokenAuth is not needed by the app when send/verify go through our API.
      tokenAuth: null as string | null,
      noticeVersion: DPDP_NOTICE_VERSION,
      purpose: DPDP_PURPOSES.ACCOUNT_AUTH,
      noticeSummary:
        "We use your phone number to send a one-time login code and to identify your guest profile for orders and loyalty.",
    };
  }

  async widgetSendOtp(rawPhone?: string) {
    if (!this.msg91.isWidgetConfigured()) {
      throw new ServiceUnavailableException(
        "MSG91 OTP Widget is not configured on the server",
      );
    }
    const phone = this.normalizeGuestPhone(rawPhone);
    const sent = await this.msg91.widgetSendOtp(phone);
    if (!sent.ok || !sent.reqId) {
      throw new ServiceUnavailableException(
        this.friendlyMsg91Message(sent.message),
      );
    }
    return {
      reqId: sent.reqId,
      expiresIn: this.msg91.otpTtlSeconds(),
      sent: true,
      provider: "msg91",
      noticeVersion: DPDP_NOTICE_VERSION,
      purpose: DPDP_PURPOSES.ACCOUNT_AUTH,
    };
  }

  async widgetRetryOtp(reqId?: string) {
    const id = reqId?.trim();
    if (!id) throw new BadRequestException("reqId is required");
    if (!this.msg91.isWidgetConfigured()) {
      throw new ServiceUnavailableException(
        "MSG91 OTP Widget is not configured on the server",
      );
    }
    const retried = await this.msg91.widgetRetryOtp(id);
    if (!retried.ok || !retried.reqId) {
      throw new ServiceUnavailableException(
        this.friendlyMsg91Message(retried.message),
      );
    }
    return {
      reqId: retried.reqId,
      expiresIn: this.msg91.otpTtlSeconds(),
      sent: true,
      provider: "msg91",
    };
  }

  async widgetConfirmOtp(body: {
    reqId?: string;
    otp?: string;
    phone?: string;
    name?: string;
    marketingEmailOptIn?: boolean;
    marketingSmsOptIn?: boolean;
  }) {
    const reqId = body.reqId?.trim();
    const otp = body.otp?.trim();
    if (!reqId || !otp) {
      throw new BadRequestException("reqId and otp are required");
    }
    if (!this.msg91.isWidgetConfigured()) {
      throw new ServiceUnavailableException(
        "MSG91 OTP Widget is not configured on the server",
      );
    }
    const verified = await this.msg91.widgetVerifyOtp(reqId, otp);
    if (!verified.ok || !verified.accessToken) {
      throw new UnauthorizedException(
        this.friendlyMsg91Message(verified.message) || "Invalid OTP",
      );
    }
    return this.loginWithMsg91Widget({
      accessToken: verified.accessToken,
      phone: body.phone,
      identifier: body.phone,
      name: body.name,
      marketingEmailOptIn: body.marketingEmailOptIn,
      marketingSmsOptIn: body.marketingSmsOptIn,
    });
  }

  private friendlyMsg91Message(message?: string): string {
    return friendlyMsg91WidgetMessage(message);
  }

  /**
   * MSG91 OTP Widget success → verify access-token server-side, then issue guest JWT.
   * Preferred when only widget credentials are configured (no Flow template).
   */
  async loginWithMsg91Widget(body: {
    accessToken?: string;
    phone?: string;
    identifier?: string;
    name?: string;
    marketingEmailOptIn?: boolean;
    marketingSmsOptIn?: boolean;
  }) {
    const accessToken = body.accessToken?.trim();
    if (!accessToken) {
      throw new BadRequestException("accessToken is required");
    }
    if (!this.msg91.isWidgetConfigured()) {
      throw new ServiceUnavailableException(
        "MSG91 OTP Widget is not configured on the server",
      );
    }

    const verified = await this.msg91.verifyWidgetAccessToken(accessToken);
    // Client-supplied identifiers are never trusted: the phone must come from MSG91.
    let phone = verified.ok && verified.phone ? verified.phone : null;
    if (!phone) {
      throw new UnauthorizedException(
        verified.ok
          ? "OTP verified but phone was missing from MSG91. Please try again."
          : (verified.message ?? "OTP verification failed"),
      );
    }

    try {
      phone = this.normalizeGuestPhone(phone);
    } catch {
      throw new BadRequestException("Invalid phone number from MSG91");
    }

    const guest = await this.prisma.guestUser.upsert({
      where: { phone },
      create: {
        phone,
        name: body.name?.trim() || undefined,
        marketingEmailOptIn: Boolean(body.marketingEmailOptIn),
        marketingSmsOptIn: Boolean(body.marketingSmsOptIn),
      },
      update: {
        ...(body.name?.trim() ? { name: body.name.trim() } : {}),
        ...(body.marketingEmailOptIn != null
          ? { marketingEmailOptIn: Boolean(body.marketingEmailOptIn) }
          : {}),
        ...(body.marketingSmsOptIn != null
          ? { marketingSmsOptIn: Boolean(body.marketingSmsOptIn) }
          : {}),
        anonymizedAt: null,
      },
    });

    this.assertGuestActive(guest);
    await this.syncGuestMarketingConsent(guest.id, body, "guest_app_login");

    return {
      accessToken: this.signGuestToken(guest.id, guest.phone),
      guest: this.mapGuest(guest),
      requiresPinSetup: !guest.pinHash,
      noticeVersion: DPDP_NOTICE_VERSION,
    };
  }

  async setPin(guestUserId: string, pin?: string, name?: string) {
    assertPinFormat((pin || "").trim());
    const guest = await this.prisma.guestUser.findUnique({
      where: { id: guestUserId },
    });
    if (!guest || guest.anonymizedAt) {
      throw new NotFoundException("Guest not found");
    }
    this.assertGuestActive(guest);
    const pinHash = await hashPassword(pin!.trim());
    const updated = await this.prisma.guestUser.update({
      where: { id: guestUserId },
      data: {
        pinHash,
        pinUpdatedAt: new Date(),
        ...(name?.trim() ? { name: name.trim() } : {}),
      },
    });
    return {
      guest: this.mapGuest(updated),
      accessToken: this.signGuestToken(updated.id, updated.phone),
    };
  }

  async loginWithPin(rawPhone?: string, pin?: string) {
    const phone = this.normalizeGuestPhone(rawPhone);
    assertPinFormat((pin || "").trim());
    const guest = await this.prisma.guestUser.findUnique({
      where: { phone },
    });
    if (!guest || guest.anonymizedAt || !guest.pinHash) {
      throw new UnauthorizedException("Invalid phone or PIN");
    }
    this.assertGuestActive(guest);
    if (guest.pinLockedUntil && guest.pinLockedUntil.getTime() > Date.now()) {
      throw new HttpException(
        "Too many wrong PIN attempts. Use OTP login or try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const ok = await verifyPassword(pin!.trim(), guest.pinHash);
    if (!ok) {
      const failed = guest.pinFailedAttempts + 1;
      await this.prisma.guestUser.update({
        where: { id: guest.id },
        data:
          failed >= GUEST_PIN_MAX_FAILURES
            ? {
                pinFailedAttempts: 0,
                pinLockedUntil: new Date(Date.now() + GUEST_PIN_LOCK_MS),
              }
            : { pinFailedAttempts: { increment: 1 } },
      });
      throw new UnauthorizedException("Invalid phone or PIN");
    }
    if (guest.pinFailedAttempts > 0 || guest.pinLockedUntil) {
      await this.prisma.guestUser.update({
        where: { id: guest.id },
        data: { pinFailedAttempts: 0, pinLockedUntil: null },
      });
    }
    return {
      accessToken: this.signGuestToken(guest.id, guest.phone),
      guest: this.mapGuest(guest),
      requiresPinSetup: false,
      noticeVersion: DPDP_NOTICE_VERSION,
    };
  }

  /**
   * Exchange a Firebase ID token for a Cullinos guest JWT so marketplace /
   * orders APIs keep working after Email / Google / Phone Firebase sign-in.
   */
  async exchangeFirebaseToken(body: {
    idToken?: string;
    name?: string;
    marketingEmailOptIn?: boolean;
    marketingSmsOptIn?: boolean;
  }) {
    const verified = await this.firebaseAdmin.verifyIdToken(body.idToken);

    let phone: string | null = null;
    if (verified.phone) {
      try {
        phone = this.normalizeGuestPhone(verified.phone);
      } catch {
        phone = null;
      }
    }

    // Unverified emails must never link to (or take over) an existing guest account.
    const email = verified.emailVerified
      ? verified.email?.trim().toLowerCase() || null
      : null;
    const name =
      body.name?.trim() ||
      verified.name?.trim() ||
      undefined;

    let guest =
      (await this.prisma.guestUser.findUnique({
        where: { firebaseUid: verified.uid },
      })) ||
      (phone
        ? await this.prisma.guestUser.findUnique({ where: { phone } })
        : null) ||
      (email
        ? await this.prisma.guestUser.findFirst({
            where: { email, anonymizedAt: null },
          })
        : null);

    if (guest?.anonymizedAt) {
      guest = null;
    }

    if (!guest) {
      if (!phone && !email) {
        throw new BadRequestException(
          "Firebase account must include a phone number or a verified email",
        );
      }
      guest = await this.prisma.guestUser.create({
        data: {
          firebaseUid: verified.uid,
          phone,
          email,
          name,
          marketingEmailOptIn: Boolean(body.marketingEmailOptIn),
          marketingSmsOptIn: Boolean(body.marketingSmsOptIn),
        },
      });
    } else {
      guest = await this.prisma.guestUser.update({
        where: { id: guest.id },
        data: {
          firebaseUid: verified.uid,
          ...(phone && !guest.phone ? { phone } : {}),
          ...(email && !guest.email ? { email } : {}),
          ...(name && !guest.name ? { name } : {}),
          anonymizedAt: null,
        },
      });
    }

    this.assertGuestActive(guest);

    return {
      accessToken: this.signGuestToken(guest.id, guest.phone),
      guest: this.mapGuest(guest),
      requiresPinSetup: !guest.pinHash && Boolean(guest.phone),
      noticeVersion: DPDP_NOTICE_VERSION,
    };
  }

  async changePin(
    guestUserId: string,
    currentPin?: string,
    newPin?: string,
  ) {
    assertPinFormat((currentPin || "").trim());
    assertPinFormat((newPin || "").trim());
    const guest = await this.prisma.guestUser.findUnique({
      where: { id: guestUserId },
    });
    if (!guest || guest.anonymizedAt || !guest.pinHash) {
      throw new UnauthorizedException("PIN not set");
    }
    const ok = await verifyPassword(currentPin!.trim(), guest.pinHash);
    if (!ok) {
      throw new UnauthorizedException("Current PIN is incorrect");
    }
    const pinHash = await hashPassword(newPin!.trim());
    const updated = await this.prisma.guestUser.update({
      where: { id: guestUserId },
      data: { pinHash, pinUpdatedAt: new Date() },
    });
    return { guest: this.mapGuest(updated) };
  }

  private signGuestToken(guestId: string, phone: string | null) {
    return this.jwt.sign(
      { sub: guestId, type: "guest", phone: phone ?? "" },
      {
        secret: getJwtSecret(),
        expiresIn: "30d",
      },
    );
  }

  async me(guestUserId: string) {
    const guest = await this.prisma.guestUser.findUnique({
      where: { id: guestUserId },
    });
    if (!guest || guest.anonymizedAt) {
      throw new NotFoundException("Guest not found");
    }
    return this.mapGuest(guest);
  }

  async updateProfile(
    guestUserId: string,
    body: { name?: string; email?: string | null },
  ) {
    const guest = await this.prisma.guestUser.findUnique({
      where: { id: guestUserId },
    });
    if (!guest || guest.anonymizedAt) {
      throw new NotFoundException("Guest not found");
    }
    const email =
      body.email === undefined
        ? undefined
        : body.email === null || !String(body.email).trim()
          ? null
          : String(body.email).trim().toLowerCase();
    const updated = await this.prisma.guestUser.update({
      where: { id: guestUserId },
      data: {
        name: body.name !== undefined ? body.name.trim() || null : guest.name,
        ...(email !== undefined ? { email } : {}),
      },
    });
    return this.mapGuest(updated);
  }

  async ensureMembership(
    guestUserId: string,
    orgId: string,
    name?: string,
  ) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
    });
    if (!org || org.status === "suspended" || org.status === "cancelled") {
      throw new BadRequestException("Organization not available");
    }

    const guest = await this.prisma.guestUser.findUnique({
      where: { id: guestUserId },
    });
    if (!guest || guest.anonymizedAt) {
      throw new NotFoundException("Guest not found");
    }
    if (!guest.phone) {
      throw new BadRequestException(
        "Add a phone number to your account before joining a restaurant",
      );
    }

    const existing = await this.prisma.guestOrgMembership.findUnique({
      where: {
        guestUserId_organizationId: {
          guestUserId,
          organizationId: orgId,
        },
      },
      include: { customer: true },
    });
    if (existing) {
      const portal = await this.loyalty.getCustomerPortal(
        orgId,
        existing.customerId,
      );
      return {
        membershipId: existing.id,
        organizationId: orgId,
        organizationName: org.name,
        customerId: existing.customerId,
        customer: existing.customer,
        loyalty: portal,
        customerAccessToken: this.signCustomerToken(
          existing.customerId,
          orgId,
          guest.phone!,
        ),
      };
    }

    const displayName =
      name?.trim() || guest.name?.trim() || `Guest ${guest.phone!.slice(-4)}`;

    let customer = await this.prisma.customer.findFirst({
      where: { organizationId: orgId, phone: guest.phone! },
    });
    const createdFromGuest = !customer;
    if (!customer) {
      customer = await this.prisma.customer.create({
        data: {
          organizationId: orgId,
          phone: guest.phone!,
          name: displayName,
          email: guest.email,
          marketingEmailOptIn: guest.marketingEmailOptIn,
          marketingSmsOptIn: guest.marketingSmsOptIn,
          marketingOptInAt:
            guest.marketingEmailOptIn || guest.marketingSmsOptIn
              ? new Date()
              : undefined,
          unsubscribeToken: newUnsubscribeToken(),
        },
      });
    }

    const membership = await this.prisma.guestOrgMembership.create({
      data: {
        guestUserId,
        organizationId: orgId,
        customerId: customer.id,
      },
      include: { customer: true },
    });
    if (createdFromGuest) {
      // The new customer inherited the guest's app choices; record them for this restaurant.
      await this.syncGuestMarketingConsent(
        guestUserId,
        {
          marketingEmailOptIn: guest.marketingEmailOptIn,
          marketingSmsOptIn: guest.marketingSmsOptIn,
        },
        "guest_app_join",
        orgId,
      );
    }

    const portal = await this.loyalty.getCustomerPortal(orgId, customer.id);
    return {
      membershipId: membership.id,
      organizationId: orgId,
      organizationName: org.name,
      customerId: customer.id,
      customer: membership.customer,
      loyalty: portal,
      customerAccessToken: this.signCustomerToken(
        customer.id,
        orgId,
        guest.phone!,
      ),
    };
  }

  private signCustomerToken(
    customerId: string,
    orgId: string,
    phone: string,
  ): string {
    return this.jwt.sign(
      { sub: customerId, type: "customer", orgId, phone },
      {
        secret: getJwtSecret(),
        expiresIn: "30d",
      },
    );
  }

  async listMemberships(guestUserId: string) {
    const rows = await this.prisma.guestOrgMembership.findMany({
      where: { guestUserId },
      include: {
        organization: { select: { id: true, name: true, slug: true, logoUrl: true } },
        customer: {
          select: {
            id: true,
            name: true,
            loyaltyPoints: true,
            stampCount: true,
            loyaltyTierId: true,
          },
        },
      },
      take: 100,
    });
    const customerIds = rows.map((r) => r.customerId);
    const visitRows = customerIds.length
      ? await this.prisma.order.groupBy({
          by: ["customerId"],
          where: {
            customerId: { in: customerIds },
            status: { notIn: ["draft", "cancelled", "voided"] },
          },
          _count: { _all: true },
        })
      : [];
    const visitsByCustomer = new Map(
      visitRows.map((row) => [row.customerId, row._count._all]),
    );
    return rows
      .map((r) => ({
        membershipId: r.id,
        organization: r.organization,
        customerId: r.customerId,
        loyaltyPoints: r.customer.loyaltyPoints,
        stampCount: r.customer.stampCount,
        customerName: r.customer.name,
        visitCount: visitsByCustomer.get(r.customerId) ?? 0,
      }))
      .sort((a, b) => {
        if (b.visitCount !== a.visitCount) return b.visitCount - a.visitCount;
        return b.loyaltyPoints - a.loyaltyPoints;
      });
  }

  async registerDevice(
    guestUserId: string,
    fcmToken?: string,
    platform?: string,
  ) {
    if (!fcmToken?.trim()) {
      throw new BadRequestException("fcmToken is required");
    }
    const token = fcmToken.trim();
    const device = await this.prisma.guestDevice.upsert({
      where: { fcmToken: token },
      create: {
        guestUserId,
        fcmToken: token,
        platform: platform?.trim() || "android",
        lastSeenAt: new Date(),
      },
      update: {
        guestUserId,
        platform: platform?.trim() || undefined,
        lastSeenAt: new Date(),
      },
    });
    return { id: device.id, platform: device.platform };
  }

  listAddresses(guestUserId: string) {
    return this.prisma.guestAddress.findMany({
      where: { guestUserId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
      take: 50,
    });
  }

  async createAddress(
    guestUserId: string,
    body: {
      label?: string;
      line1?: string;
      line2?: string;
      city?: string;
      state?: string;
      pincode?: string;
      latitude?: number;
      longitude?: number;
      isDefault?: boolean;
    },
  ) {
    if (!body.line1?.trim()) {
      throw new BadRequestException("line1 is required");
    }
    if (body.isDefault) {
      await this.prisma.guestAddress.updateMany({
        where: { guestUserId },
        data: { isDefault: false },
      });
    }
    return this.prisma.guestAddress.create({
      data: {
        guestUserId,
        label: body.label?.trim(),
        line1: body.line1.trim(),
        line2: body.line2?.trim(),
        city: body.city?.trim(),
        state: body.state?.trim(),
        pincode: body.pincode?.trim(),
        latitude: body.latitude,
        longitude: body.longitude,
        isDefault: Boolean(body.isDefault),
      },
    });
  }

  async updateAddress(
    guestUserId: string,
    id: string,
    body: {
      label?: string;
      line1?: string;
      line2?: string;
      city?: string;
      state?: string;
      pincode?: string;
      latitude?: number;
      longitude?: number;
      isDefault?: boolean;
    },
  ) {
    const row = await this.prisma.guestAddress.findFirst({
      where: { id, guestUserId },
    });
    if (!row) throw new NotFoundException("Address not found");
    if (body.isDefault) {
      await this.prisma.guestAddress.updateMany({
        where: { guestUserId },
        data: { isDefault: false },
      });
    }
    return this.prisma.guestAddress.update({
      where: { id },
      data: {
        ...(body.label !== undefined ? { label: body.label?.trim() || null } : {}),
        ...(body.line1 !== undefined ? { line1: body.line1.trim() } : {}),
        ...(body.line2 !== undefined ? { line2: body.line2?.trim() || null } : {}),
        ...(body.city !== undefined ? { city: body.city?.trim() || null } : {}),
        ...(body.state !== undefined ? { state: body.state?.trim() || null } : {}),
        ...(body.pincode !== undefined
          ? { pincode: body.pincode?.trim() || null }
          : {}),
        ...(body.latitude !== undefined ? { latitude: body.latitude } : {}),
        ...(body.longitude !== undefined ? { longitude: body.longitude } : {}),
        ...(body.isDefault !== undefined ? { isDefault: body.isDefault } : {}),
      },
    });
  }

  async deleteAddress(guestUserId: string, id: string) {
    const row = await this.prisma.guestAddress.findFirst({
      where: { id, guestUserId },
    });
    if (!row) throw new NotFoundException("Address not found");
    await this.prisma.guestAddress.delete({ where: { id } });
    return { success: true };
  }

  async customerIdsForGuest(guestUserId: string): Promise<string[]> {
    const rows = await this.prisma.guestOrgMembership.findMany({
      where: { guestUserId },
      select: { customerId: true },
    });
    return rows.map((r) => r.customerId);
  }

  async requireMembershipCustomer(
    guestUserId: string,
    orgId: string,
  ): Promise<string> {
    const m = await this.prisma.guestOrgMembership.findUnique({
      where: {
        guestUserId_organizationId: {
          guestUserId,
          organizationId: orgId,
        },
      },
    });
    if (!m) {
      throw new UnauthorizedException("Join this restaurant first");
    }
    return m.customerId;
  }

  private assertGuestActive(guest: {
    anonymizedAt?: Date | null;
    suspendedAt?: Date | null;
  }) {
    if (guest.anonymizedAt) {
      throw new UnauthorizedException("Account not available");
    }
    if (guest.suspendedAt) {
      throw new ForbiddenException("This guest account has been suspended");
    }
  }

  private mapGuest(guest: {
    id: string;
    phone: string | null;
    name: string | null;
    email: string | null;
    marketingEmailOptIn: boolean;
    marketingSmsOptIn: boolean;
    pinHash?: string | null;
    cullinosCoins?: number;
    suspendedAt?: Date | null;
  }) {
    return {
      id: guest.id,
      phone: guest.phone,
      name: guest.name,
      email: guest.email,
      marketingEmailOptIn: guest.marketingEmailOptIn,
      marketingSmsOptIn: guest.marketingSmsOptIn,
      hasPin: Boolean(guest.pinHash),
      cullinosCoins:
        typeof guest.cullinosCoins === "number" ? guest.cullinosCoins : 0,
      suspended: Boolean(guest.suspendedAt),
    };
  }

  async getCoins(guestUserId: string) {
    const balanceRows = await this.prisma.$queryRaw<
      Array<{ cullinos_coins: number }>
    >`SELECT "cullinos_coins" FROM "guest_users" WHERE "id" = ${guestUserId}`;
    if (!balanceRows.length) {
      throw new NotFoundException("Guest not found");
    }
    const ledgerRows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        delta: number;
        reason: string;
        created_at: Date;
      }>
    >`SELECT "id", "delta", "reason", "created_at" FROM "guest_coin_ledger"
      WHERE "guest_user_id" = ${guestUserId}
      ORDER BY "created_at" DESC
      LIMIT 20`;
    return {
      balance: Number(balanceRows[0].cullinos_coins) || 0,
      ledger: ledgerRows.map((row) => ({
        id: row.id,
        delta: row.delta,
        reason: row.reason,
        createdAt: row.created_at,
      })),
      redeemComingSoon: true,
    };
  }

  /**
   * Award Cullinos Coins = floor(10% of paid order total). Idempotent per order.
   */
  async awardCoinsForPaidOrder(guestUserId: string, order: {
    id: string;
    total: unknown;
    orderNumber?: string | null;
  }) {
    const total = Math.max(0, Number(order.total) || 0);
    const delta = Math.floor(total * 0.1);
    if (delta <= 0) return { awarded: 0 };

    const reason = `order:${order.id}`;
    const existing = await this.prisma.guestCoinLedger.findFirst({
      where: { guestUserId, reason },
    });
    if (existing) return { awarded: 0, alreadyAwarded: true };

    await this.prisma.$transaction([
      this.prisma.guestCoinLedger.create({
        data: {
          guestUserId,
          delta,
          reason,
        },
      }),
      this.prisma.guestUser.update({
        where: { id: guestUserId },
        data: { cullinosCoins: { increment: delta } },
      }),
    ]);

    return { awarded: delta, orderNumber: order.orderNumber ?? null };
  }
}

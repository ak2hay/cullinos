import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { hashPassword, verifyPassword } from "@cullinos/auth";
import { createHash, randomBytes, randomInt } from "crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { MailService } from "../mail/mail.service";
import { PlatformConfigService } from "../platform-config/platform-config.service";
import { AuditService } from "../audit/audit.service";
import { Msg91Service } from "../sms/msg91.service";
import { TenantProvisioningService } from "../organizations/tenant-provisioning.service";
import { generateTemporaryPassword } from "../../common/generate-password";
import {
  PHONE_OTP_SMS_UNAVAILABLE_MESSAGE,
  shouldFailPhoneOtpWhenUnsent,
} from "../customers/phone-otp-request.util";
import {
  normalizeStaffPhone,
  staffPhoneLookupVariants,
} from "../../common/phone.util";
import {
  isOtpTemporarilyDisabled,
  SMS_OTP_TEMPORARILY_DISABLED_MESSAGE,
} from "../../common/otp-gate.util";

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const LOGIN_FAIL_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_FAIL_MAX_DELAY_MS = 8_000;
/** Dummy bcrypt hash so missing-user paths still pay verify cost (enumeration resistance). */
const DUMMY_PASSWORD_HASH =
  "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

type OtpPurpose = "login_2fa" | "password_reset";

type ChallengePayload = {
  sub: string;
  email: string;
  purpose: OtpPurpose;
  type: "otp_challenge";
};

type LoginFailureBucket = { count: number; firstAt: number };

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly loginFailures = new Map<string, LoginFailureBucket>();

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private mail: MailService,
    private config: PlatformConfigService,
    private audit: AuditService,
    private msg91: Msg91Service,
    private provisioning: TenantProvisioningService,
  ) {}

  private isEmailOtpSkipped(): boolean {
    // Timed disable (super-admin gate) works in all environments including production.
    if (isOtpTemporarilyDisabled(this.config.get("AUTH_EMAIL_OTP_DISABLED_UNTIL"))) {
      return true;
    }
    // Legacy permanent skip: never in production (boot also blocks AUTH_SKIP_EMAIL_OTP=true).
    if (process.env.NODE_ENV === "production") return false;
    const raw = (this.config.get("AUTH_SKIP_EMAIL_OTP") ?? "").trim().toLowerCase();
    return raw === "true" || raw === "1" || raw === "yes";
  }

  private assertSmsOtpEnabled(): void {
    if (isOtpTemporarilyDisabled(this.config.get("AUTH_SMS_OTP_DISABLED_UNTIL"))) {
      throw new BadRequestException(SMS_OTP_TEMPORARILY_DISABLED_MESSAGE);
    }
  }

  private failKey(email: string, ip?: string): string {
    const emailHash = createHash("sha256").update(email.trim().toLowerCase()).digest("hex").slice(0, 16);
    return `${emailHash}:${ip ?? "unknown"}`;
  }

  private async applyLoginBackoff(email: string, ip?: string): Promise<void> {
    const key = this.failKey(email, ip);
    const now = Date.now();
    const bucket = this.loginFailures.get(key);
    if (!bucket || now - bucket.firstAt > LOGIN_FAIL_WINDOW_MS) return;
    // Progressive delay: 250ms * 2^(n-1), capped — avoids permanent lockout DoS.
    const delay = Math.min(
      LOGIN_FAIL_MAX_DELAY_MS,
      250 * Math.pow(2, Math.max(0, bucket.count - 1)),
    );
    if (delay > 0) {
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  private recordLoginFailure(email: string, ip?: string): void {
    const key = this.failKey(email, ip);
    const now = Date.now();
    const bucket = this.loginFailures.get(key);
    if (!bucket || now - bucket.firstAt > LOGIN_FAIL_WINDOW_MS) {
      this.loginFailures.set(key, { count: 1, firstAt: now });
      return;
    }
    bucket.count += 1;
  }

  private clearLoginFailures(email: string, ip?: string): void {
    this.loginFailures.delete(this.failKey(email, ip));
  }

  private async logAuthEvent(input: {
    organizationId?: string | null;
    userId?: string;
    action: string;
    email: string;
    ip?: string;
    metadata?: Record<string, unknown>;
  }) {
    const emailHash = createHash("sha256")
      .update(input.email.trim().toLowerCase())
      .digest("hex")
      .slice(0, 16);
    this.logger.warn(
      `auth_event action=${input.action} emailHash=${emailHash} ip=${input.ip ?? "n/a"}`,
    );
    if (!input.organizationId) return;
    try {
      await this.audit.log({
        organizationId: input.organizationId,
        userId: input.userId,
        action: input.action,
        entityType: "auth",
        entityId: input.userId,
        ipAddress: input.ip,
        metadata: { emailHash, ...input.metadata },
      });
    } catch (err) {
      this.logger.warn(`Failed to write auth audit log: ${String(err)}`);
    }
  }

  async getUserPermissions(userId: string): Promise<string[]> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: { permission: true },
            },
          },
        },
      },
    });

    const permissions = new Set<string>();
    for (const ur of userRoles) {
      for (const rp of ur.role.rolePermissions) {
        permissions.add(`${rp.permission.module}:${rp.permission.action}`);
      }
    }
    return [...permissions];
  }

  async login(email: string, password: string, ip?: string) {
    const normalizedEmail = email.trim().toLowerCase();
    await this.applyLoginBackoff(normalizedEmail, ip);

    const user = await this.prisma.user.findFirst({
      where: {
        email: { equals: normalizedEmail, mode: "insensitive" },
        status: "active",
      },
      include: { organization: true },
    });

    const hash = user?.passwordHash ?? DUMMY_PASSWORD_HASH;
    const passwordOk = await verifyPassword(password, hash);
    if (!user || !passwordOk) {
      this.recordLoginFailure(normalizedEmail, ip);
      await this.logAuthEvent({
        organizationId: user?.organizationId,
        userId: user?.id,
        action: "auth.login_failed",
        email: normalizedEmail,
        ip,
      });
      throw new UnauthorizedException("Invalid credentials");
    }

    this.clearLoginFailures(normalizedEmail, ip);
    await this.logAuthEvent({
      organizationId: user.organizationId,
      userId: user.id,
      action: "auth.login_success",
      email: normalizedEmail,
      ip,
    });

    if (this.isEmailOtpSkipped()) {
      return this.issueLoginResponse(user);
    }

    const challengeToken = await this.createAndSendOtp(user.id, user.email, "login_2fa");
    return { requiresOtp: true as const, challengeToken };
  }

  /** Shared entry for other modules (e.g. super-admin login). */
  async startLoginOtp(userId: string, email: string) {
    if (this.isEmailOtpSkipped()) {
      const user = await this.prisma.user.findFirst({
        where: { id: userId, status: "active" },
        include: { organization: true },
      });
      if (!user) {
        throw new UnauthorizedException("Invalid credentials");
      }
      return this.issueLoginResponse(user);
    }

    const challengeToken = await this.createAndSendOtp(userId, email, "login_2fa");
    return { requiresOtp: true as const, challengeToken };
  }

  async verifyLoginOtp(challengeToken: string, otp: string) {
    const record = await this.consumeOtp(challengeToken, otp, "login_2fa");
    const user = await this.prisma.user.findFirst({
      where: { id: record.userId!, status: "active" },
      include: { organization: true },
    });
    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }
    return this.issueLoginResponse(user);
  }

  async resendOtp(challengeToken: string) {
    const payload = this.verifyChallengeToken(challengeToken);
    const existing = await this.prisma.emailOtp.findUnique({
      where: { challengeToken },
    });
    if (!existing || existing.consumedAt) {
      throw new BadRequestException("Invalid or expired challenge");
    }
    if (existing.createdAt.getTime() + OTP_RESEND_COOLDOWN_MS > Date.now()) {
      throw new BadRequestException("Please wait before requesting another code");
    }

    const newToken = await this.createAndSendOtp(
      payload.sub,
      payload.email,
      payload.purpose,
    );
    return { requiresOtp: true as const, challengeToken: newToken };
  }

  async forgotPassword(email: string) {
    if (this.isEmailOtpSkipped()) {
      throw new BadRequestException(
        "Password reset email is temporarily disabled. Contact your administrator.",
      );
    }

    const user = await this.prisma.user.findFirst({
      where: {
        email: { equals: email.trim().toLowerCase(), mode: "insensitive" },
        status: "active",
      },
    });
    if (user) {
      await this.createAndSendOtp(user.id, user.email, "password_reset");
      await this.logAuthEvent({
        organizationId: user.organizationId,
        userId: user.id,
        action: "auth.password_reset_requested",
        email: user.email,
      });
    } else {
      // Constant-ish work when user missing (enumeration resistance).
      await verifyPassword("dummy-password-check", DUMMY_PASSWORD_HASH);
    }
    return { ok: true as const };
  }

  async refreshAccessToken(refreshToken: string) {
    let payload: { sub?: string; type?: string };
    try {
      payload = this.jwt.verify(refreshToken) as { sub?: string; type?: string };
    } catch {
      throw new UnauthorizedException("Invalid refresh token");
    }
    if (payload.type !== "refresh" || !payload.sub) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, status: "active" },
      include: { organization: true },
    });
    if (!user) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    // Rotate: issue a new refresh + access pair.
    return this.issueLoginResponse(user);
  }

  async resetPassword(email: string, otp: string, newPassword: string) {
    if (newPassword.length < 8 || newPassword.length > 128) {
      throw new BadRequestException("New password must be 8–128 characters");
    }

    const normalizedEmail = email.trim().toLowerCase();
    const pending = await this.prisma.emailOtp.findFirst({
      where: {
        email: { equals: normalizedEmail, mode: "insensitive" },
        purpose: "password_reset",
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });
    if (!pending) {
      throw new BadRequestException("Invalid or expired code");
    }
    if (pending.attempts >= OTP_MAX_ATTEMPTS) {
      throw new BadRequestException("Too many attempts. Request a new code.");
    }

    const valid = await verifyPassword(otp, pending.codeHash);
    if (!valid) {
      await this.prisma.emailOtp.update({
        where: { id: pending.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException("Invalid or expired code");
    }

    await this.prisma.emailOtp.update({
      where: { id: pending.id },
      data: { consumedAt: new Date() },
    });

    const user = await this.prisma.user.findFirst({
      where: {
        email: { equals: normalizedEmail, mode: "insensitive" },
        status: "active",
      },
    });
    if (!user) {
      throw new BadRequestException("Invalid or expired code");
    }

    const passwordHash = await hashPassword(newPassword);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, mustChangePassword: false },
    });

    return { success: true as const };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.status !== "active") {
      throw new UnauthorizedException("Invalid credentials");
    }
    if (!(await verifyPassword(currentPassword, user.passwordHash))) {
      throw new BadRequestException("Current password is incorrect");
    }
    if (newPassword.length < 8 || newPassword.length > 128) {
      throw new BadRequestException("New password must be 8–128 characters");
    }
    if (currentPassword === newPassword) {
      throw new BadRequestException("New password must be different from the current password");
    }

    const passwordHash = await hashPassword(newPassword);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: false },
    });

    return { success: true, mustChangePassword: false };
  }

  private async createAndSendOtp(
    userId: string,
    email: string,
    purpose: OtpPurpose,
  ): Promise<string> {
    await this.prisma.emailOtp.updateMany({
      where: { email, purpose, consumedAt: null },
      data: { consumedAt: new Date() },
    });

    const code = String(randomInt(100000, 1000000));
    const codeHash = await hashPassword(code);
    const challengeToken = this.jwt.sign(
      {
        sub: userId,
        email,
        purpose,
        type: "otp_challenge",
      } satisfies ChallengePayload,
      { expiresIn: "10m" },
    );

    await this.prisma.emailOtp.create({
      data: {
        email,
        userId,
        purpose,
        codeHash,
        challengeToken,
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      },
    });

    await this.mail.sendOtpEmail(email, code, purpose);
    return challengeToken;
  }

  private verifyChallengeToken(challengeToken: string): ChallengePayload {
    try {
      const payload = this.jwt.verify<ChallengePayload>(challengeToken);
      if (payload.type !== "otp_challenge") {
        throw new BadRequestException("Invalid challenge");
      }
      return payload;
    } catch {
      throw new BadRequestException("Invalid or expired challenge");
    }
  }

  private async consumeOtp(
    challengeToken: string,
    otp: string,
    expectedPurpose: OtpPurpose,
  ) {
    this.verifyChallengeToken(challengeToken);

    const record = await this.prisma.emailOtp.findUnique({
      where: { challengeToken },
    });
    if (!record || record.purpose !== expectedPurpose || record.consumedAt) {
      throw new BadRequestException("Invalid or expired code");
    }
    if (record.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException("Invalid or expired code");
    }
    if (record.attempts >= OTP_MAX_ATTEMPTS) {
      throw new BadRequestException("Too many attempts. Request a new code.");
    }

    const valid = await verifyPassword(otp, record.codeHash);
    if (!valid) {
      await this.prisma.emailOtp.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException("Invalid or expired code");
    }

    await this.prisma.emailOtp.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    });

    return record;
  }

  /**
   * Short-lived session for super-admin support into a tenant account.
   * Does not update lastLoginAt on the target user.
   */
  async issueImpersonationSession(
    user: {
      id: string;
      email: string;
      name: string;
      phone: string | null;
      organizationId: string;
      isSuperAdmin: boolean;
      lastLoginAt: Date | null;
      createdAt: Date;
      organization: { name: string; slug: string };
    },
    impersonatedBy: string,
    expiresInSeconds = 45 * 60,
  ) {
    const permissions = await this.getUserPermissions(user.id);
    const expiresIn = expiresInSeconds;
    const token = this.jwt.sign(
      {
        sub: user.id,
        organizationId: user.organizationId,
        email: user.email,
        isSuperAdmin: false,
        permissions,
        impersonation: true,
        impersonatedBy,
      },
      { expiresIn },
    );

    const nameParts = user.name.trim().split(/\s+/);
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    return {
      token,
      accessToken: token,
      refreshToken: null as string | null,
      expiresIn,
      expiresAt,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        firstName: nameParts[0] ?? "",
        lastName: nameParts.slice(1).join(" ") || "",
        phone: user.phone,
        avatarUrl: null,
        isActive: true,
        lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
        createdAt: user.createdAt.toISOString(),
        organizationId: user.organizationId,
        organizationName: user.organization.name,
        organizationSlug: user.organization.slug,
        isSuperAdmin: false,
        mustChangePassword: false,
      },
      permissions,
      impersonation: true as const,
      impersonatedBy,
    };
  }

  private async issueLoginResponse(
    user: {
      id: string;
      email: string;
      name: string;
      phone: string | null;
      organizationId: string;
      isSuperAdmin: boolean;
      mustChangePassword: boolean;
      lastLoginAt: Date | null;
      createdAt: Date;
      organization: { name: string; slug: string };
    },
  ) {
    const permissions = await this.getUserPermissions(user.id);

    const defaultOu = await this.prisma.outletUser.findFirst({
      where: { userId: user.id, isDefault: true },
      select: { outletId: true },
    });
    const anyOu = defaultOu
      ? null
      : await this.prisma.outletUser.findFirst({
          where: { userId: user.id },
          select: { outletId: true },
          orderBy: { outletId: "asc" },
        });
    const defaultOutletId = defaultOu?.outletId ?? anyOu?.outletId ?? null;

    const token = this.jwt.sign({
      sub: user.id,
      organizationId: user.organizationId,
      email: user.email,
      isSuperAdmin: user.isSuperAdmin,
      permissions,
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const nameParts = user.name.trim().split(/\s+/);
    const refreshToken = this.jwt.sign(
      { sub: user.id, type: "refresh" },
      { expiresIn: "30d" },
    );

    return {
      token,
      accessToken: token,
      refreshToken,
      expiresIn: 7 * 24 * 60 * 60,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        firstName: nameParts[0] ?? "",
        lastName: nameParts.slice(1).join(" ") || "",
        phone: user.phone,
        avatarUrl: null,
        isActive: true,
        lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
        createdAt: user.createdAt.toISOString(),
        organizationId: user.organizationId,
        organizationName: user.organization.name,
        organizationSlug: user.organization.slug,
        isSuperAdmin: user.isSuperAdmin,
        mustChangePassword: user.mustChangePassword,
        defaultOutletId,
      },
      permissions,
      defaultOutletId,
    };
  }

  private hashPhoneOtp(code: string) {
    return createHash("sha256").update(code).digest("hex");
  }

  /** Staff waiter primary login: phone + SMS OTP (MSG91). */
  async requestStaffPhoneOtp(rawPhone: string) {
    this.assertSmsOtpEnabled();
    const phone = this.msg91.normalizePhone(rawPhone);
    if (phone.length < 10) {
      throw new BadRequestException("Invalid phone number");
    }

    const variants = staffPhoneLookupVariants(phone);
    let user = await this.prisma.user.findFirst({
      where: {
        phone: { in: variants },
        status: "active",
        isSuperAdmin: false,
      },
      include: { organization: true },
    });
    // Legacy rows: match by last 10 digits if exact variants miss
    if (!user && phone.length >= 10) {
      const local = phone.slice(-10);
      const candidates = await this.prisma.user.findMany({
        where: {
          status: "active",
          isSuperAdmin: false,
          phone: { not: null },
        },
        include: { organization: true },
        take: 500,
      });
      user =
        candidates.find((u) => {
          const d = (u.phone ?? "").replace(/\D/g, "");
          return d === phone || d.endsWith(local);
        }) ?? null;
    }
    if (!user) {
      throw new UnauthorizedException("Invalid phone or OTP");
    }
    if (
      user.organization.status === "suspended" ||
      user.organization.status === "cancelled"
    ) {
      throw new UnauthorizedException("Organization not available");
    }

    // Heal stored phone to canonical form for future logins
    const canonical = normalizeStaffPhone(user.phone ?? phone);
    if (user.phone !== canonical) {
      await this.prisma.user
        .update({ where: { id: user.id }, data: { phone: canonical } })
        .catch(() => undefined);
    }

    const otp = String(randomInt(100000, 999999));
    const challengeToken = randomBytes(24).toString("hex");
    const ttl = this.msg91.otpTtlSeconds();
    const expiresAt = new Date(Date.now() + ttl * 1000);

    const challenge = await this.prisma.phoneOtp.create({
      data: {
        phone: canonical,
        organizationId: user.organizationId,
        codeHash: this.hashPhoneOtp(otp),
        challengeToken,
        expiresAt,
      },
    });

    const send = await this.msg91.sendOtp(canonical, otp);
    if (shouldFailPhoneOtpWhenUnsent(send.sent)) {
      await this.prisma.phoneOtp.delete({ where: { id: challenge.id } }).catch(() => undefined);
      throw new BadRequestException(PHONE_OTP_SMS_UNAVAILABLE_MESSAGE);
    }

    return {
      challengeToken,
      expiresIn: ttl,
      sent: send.sent,
      provider: send.provider,
      ...(send.provider === "log" && process.env.NODE_ENV !== "production"
        ? { debugOtp: otp }
        : {}),
    };
  }

  async verifyStaffPhoneOtp(challengeToken: string, code: string) {
    const challenge = await this.prisma.phoneOtp.findUnique({
      where: { challengeToken },
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
    if (challenge.codeHash !== this.hashPhoneOtp(code.trim())) {
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

    const variants = staffPhoneLookupVariants(challenge.phone);
    let user = await this.prisma.user.findFirst({
      where: {
        phone: { in: variants },
        organizationId: challenge.organizationId,
        status: "active",
        isSuperAdmin: false,
      },
      include: { organization: true },
    });
    if (!user) {
      const local = challenge.phone.slice(-10);
      const candidates = await this.prisma.user.findMany({
        where: {
          organizationId: challenge.organizationId,
          status: "active",
          isSuperAdmin: false,
          phone: { not: null },
        },
        include: { organization: true },
        take: 200,
      });
      user =
        candidates.find((u) => {
          const d = (u.phone ?? "").replace(/\D/g, "");
          return d === challenge.phone || d.endsWith(local);
        }) ?? null;
    }
    if (!user) {
      throw new UnauthorizedException("Invalid phone or OTP");
    }

    return this.issueLoginResponse(user);
  }

  async registerOwner(input: {
    companyName: string;
    ownerName: string;
    ownerEmail: string;
    ownerPhone?: string;
    captchaToken?: string;
  }) {
    const ownerEmail = input.ownerEmail.trim().toLowerCase();
    const companyName = input.companyName.trim();
    const ownerName = input.ownerName.trim() || "Owner";
    if (!companyName || companyName.length < 2) {
      throw new BadRequestException("Restaurant name is required");
    }
    if (!ownerEmail) {
      throw new BadRequestException("Email is required");
    }

    const existingUser = await this.prisma.user.findFirst({
      where: { email: ownerEmail },
    });
    if (existingUser) {
      throw new BadRequestException(
        "An account with this email already exists. Sign in or use a different email.",
      );
    }

    const temporaryPassword = generateTemporaryPassword();
    const result = await this.provisioning.provisionTenant({
      companyName,
      planSlug: "enterprise",
      adminEmail: ownerEmail,
      adminPassword: temporaryPassword,
      adminName: ownerName,
      adminPhone: input.ownerPhone?.trim() || undefined,
      status: "trial",
      mustChangePassword: true,
      trialDays: 15,
    });

    const emailSent = await this.mail.sendOwnerCredentials({
      to: ownerEmail,
      ownerName,
      restaurantName: companyName,
      temporaryPassword,
      adminUrl: result.adminUrl,
    });

    let smsSent = false;
    const phone = input.ownerPhone?.trim();
    if (phone) {
      try {
        const sms = await this.msg91.sendTransactionalSms(
          phone,
          `Cullinos: Your ${companyName} admin login is ready. Email: ${ownerEmail}. Temp password: ${temporaryPassword}. Login: ${result.adminUrl}`,
        );
        smsSent = sms.sent;
      } catch (err) {
        this.logger.warn(
          `Owner credentials SMS failed: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    return {
      success: true,
      organizationId: result.organizationId,
      emailSent,
      smsSent,
      message:
        "Account created. Check your email" +
        (phone ? " and SMS" : "") +
        " for login credentials. You have a 15-day Enterprise trial.",
    };
  }
}

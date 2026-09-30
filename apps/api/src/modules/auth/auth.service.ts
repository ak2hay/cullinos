import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  Optional,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { hashPassword, verifyPassword } from "@cullinos/auth";
import { createHash, randomBytes, randomInt } from "crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { RedisService } from "../../common/redis/redis.service";
import { accessTokenTtlSeconds } from "../../common/access-token.util";
import {
  normalizePlatformRole,
  permissionsForPlatformRole,
} from "../../common/platform-permissions";
import {
  SUPER_ADMIN_REFRESH_TTL_SECONDS,
  SessionTokensService,
} from "./session-tokens.service";
import { MailService } from "../mail/mail.service";
import { PlatformConfigService } from "../platform-config/platform-config.service";
import { PortalStatusService } from "../platform-config/portal-status.service";
import {
  currentRequestPortal,
  parsePortal,
  type SwitchablePortal,
} from "../../common/portal-context";
import { AuditService } from "../audit/audit.service";
import { Msg91Service } from "../sms/msg91.service";
import {
  friendlyMsg91WidgetMessage,
  staffWidgetPhonesMatch,
} from "../sms/msg91-widget-messages";
import { smsOwnerCredentials } from "../sms/sms-templates";
import { TenantProvisioningService } from "../organizations/tenant-provisioning.service";
import { generateTemporaryPassword } from "../../common/generate-password";
import {
  assertPhoneOtpSendAllowed,
  consumePhoneOtpChallenge,
  phoneOtpSmsFailureMessage,
  shouldFailPhoneOtpWhenUnsent,
} from "../customers/phone-otp-request.util";
import {
  normalizePhoneE164,
  normalizeStaffPhone,
  staffPhoneLookupVariants,
} from "../../common/phone.util";
import {
  assertPasswordLength,
  sandboxAllowsEmailOtpSkip,
  sandboxAllowsRelaxedPassword,
  sandboxAllowsSmsOtpSkip,
  type SandboxOrgFlags,
} from "../../common/sandbox-access.util";

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const LOGIN_FAIL_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_FAIL_MAX_DELAY_MS = 8_000;
/** Dummy bcrypt hash so missing-user paths still pay verify cost (enumeration resistance). */
const DUMMY_PASSWORD_HASH =
  "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

type OtpPurpose = "login_2fa" | "password_reset" | "labs_step_up";

const STEP_UP_TTL = "10m";

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
    private portalStatus: PortalStatusService,
    private sessions: SessionTokensService,
    @Optional() private redis?: RedisService,
  ) {}

  /** Email MFA skip: sandbox org flag, or legacy AUTH_SKIP_EMAIL_OTP outside production. */
  private isEmailOtpSkippedForOrg(org?: SandboxOrgFlags | null): boolean {
    if (sandboxAllowsEmailOtpSkip(org)) return true;
    if (process.env.NODE_ENV === "production") return false;
    const raw = (this.config.get("AUTH_SKIP_EMAIL_OTP") ?? "").trim().toLowerCase();
    return raw === "true" || raw === "1" || raw === "yes";
  }

  private failKey(email: string, ip?: string): string {
    const emailHash = createHash("sha256").update(email.trim().toLowerCase()).digest("hex").slice(0, 16);
    return `${emailHash}:${ip ?? "unknown"}`;
  }

  private async loginFailureCount(key: string): Promise<number> {
    const redis = this.redis?.client;
    if (redis) {
      const raw = await redis.get(`login-fail:${key}`).catch(() => null);
      return raw ? Number(raw) || 0 : 0;
    }
    const bucket = this.loginFailures.get(key);
    if (!bucket || Date.now() - bucket.firstAt > LOGIN_FAIL_WINDOW_MS) return 0;
    return bucket.count;
  }

  private async applyLoginBackoff(email: string, ip?: string): Promise<void> {
    const count = await this.loginFailureCount(this.failKey(email, ip));
    if (count <= 0) return;
    // Progressive delay: 250ms * 2^(n-1), capped — avoids permanent lockout DoS.
    const delay = Math.min(LOGIN_FAIL_MAX_DELAY_MS, 250 * Math.pow(2, Math.max(0, count - 1)));
    if (delay > 0) {
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  private recordLoginFailure(email: string, ip?: string): void {
    const key = this.failKey(email, ip);
    const redis = this.redis?.client;
    if (redis) {
      const redisKey = `login-fail:${key}`;
      void redis
        .incr(redisKey)
        .then((n) => (n === 1 ? redis.pexpire(redisKey, LOGIN_FAIL_WINDOW_MS) : 0))
        .catch(() => undefined);
      return;
    }
    const now = Date.now();
    const bucket = this.loginFailures.get(key);
    if (!bucket || now - bucket.firstAt > LOGIN_FAIL_WINDOW_MS) {
      this.loginFailures.set(key, { count: 1, firstAt: now });
      return;
    }
    bucket.count += 1;
  }

  private clearLoginFailures(email: string, ip?: string): void {
    const key = this.failKey(email, ip);
    if (this.redis?.client) {
      void this.redis.client.del(`login-fail:${key}`).catch(() => undefined);
      return;
    }
    this.loginFailures.delete(key);
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

    if (this.isEmailOtpSkippedForOrg(user.organization)) {
      return this.issueLoginResponse(user);
    }

    const challengeToken = await this.createAndSendOtp(user.id, user.email, "login_2fa");
    return { requiresOtp: true as const, challengeToken };
  }

  /** Shared entry for other modules (e.g. super-admin login). */
  async startLoginOtp(userId: string, email: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, status: "active" },
      include: { organization: true },
    });
    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }
    if (this.isEmailOtpSkippedForOrg(user.organization)) {
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

  /** Step-up for sensitive super-admin tools: always emails an OTP (no sandbox skip). */
  async startStepUp(userId: string, email: string) {
    const challengeToken = await this.createAndSendOtp(userId, email, "labs_step_up");
    return { challengeToken };
  }

  async verifyStepUp(userId: string, challengeToken: string, otp: string) {
    const record = await this.consumeOtp(challengeToken, otp, "labs_step_up");
    if (record.userId !== userId) {
      throw new UnauthorizedException("Step-up belongs to another user");
    }
    const stepUpToken = this.jwt.sign(
      { sub: userId, type: "step_up", scope: "labs_sql" },
      { expiresIn: STEP_UP_TTL },
    );
    return { stepUpToken, expiresInSeconds: 600 };
  }

  assertStepUp(userId: string, token: string | undefined) {
    if (!token) {
      throw new ForbiddenException({
        code: "STEP_UP_REQUIRED",
        message: "Verify with an emailed code to run Labs SQL",
      });
    }
    try {
      const payload = this.jwt.verify<{ sub?: string; type?: string; scope?: string }>(token);
      if (payload.type === "step_up" && payload.scope === "labs_sql" && payload.sub === userId) {
        return;
      }
    } catch {
      /* fall through */
    }
    throw new ForbiddenException({
      code: "STEP_UP_REQUIRED",
      message: "Step-up expired — verify again",
    });
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

  async refreshAccessToken(refreshToken: string, userAgent?: string | null) {
    const consumed = await this.sessions.consumeRefreshToken(refreshToken);

    const user = await this.prisma.user.findFirst({
      where: { id: consumed.userId, status: "active" },
      include: { organization: true },
    });
    if (!user || user.tokenVersion !== consumed.tokenVersion) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    return this.issueLoginResponse(user, parsePortal(consumed.portal ?? undefined), {
      familyId: consumed.familyId,
      sessionId: consumed.nextSessionId,
      userAgent,
    });
  }

  async logout(refreshToken: string | undefined) {
    if (refreshToken) await this.sessions.revokeByToken(refreshToken);
    return { ok: true as const };
  }

  /** Signs the user out of every device (refresh tokens and outstanding access tokens). */
  async logoutAll(userId: string, organizationId: string, email: string) {
    await this.sessions.revokeAllForUser(userId);
    await this.logAuthEvent({
      organizationId,
      userId,
      email,
      action: "auth.logout_all",
    });
    return { ok: true as const };
  }

  async resetPassword(email: string, otp: string, newPassword: string) {
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

    const live = {
      id: pending.id,
      consumedAt: null,
      attempts: { lt: OTP_MAX_ATTEMPTS },
    };
    const valid = await verifyPassword(otp, pending.codeHash);
    if (!valid) {
      await this.prisma.emailOtp.updateMany({
        where: live,
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException("Invalid or expired code");
    }

    const claimed = await this.prisma.emailOtp.updateMany({
      where: live,
      data: { consumedAt: new Date() },
    });
    if (claimed.count !== 1 || !pending.userId) {
      throw new BadRequestException("Invalid or expired code");
    }

    // Emails are unique per org, not globally: reset exactly the user the code was sent to.
    const user = await this.prisma.user.findFirst({
      where: { id: pending.userId, status: "active" },
      include: { organization: true },
    });
    if (!user) {
      throw new BadRequestException("Invalid or expired code");
    }

    const lengthErr = assertPasswordLength(newPassword, user.organization);
    if (lengthErr) throw new BadRequestException(lengthErr);

    const passwordHash = await hashPassword(newPassword);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, mustChangePassword: false },
    });
    // A reset usually means the old password may be compromised: end every session.
    await this.sessions.revokeAllForUser(user.id);

    return { success: true as const };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { organization: true },
    });
    if (!user || user.status !== "active") {
      throw new UnauthorizedException("Invalid credentials");
    }
    if (!(await verifyPassword(currentPassword, user.passwordHash))) {
      throw new BadRequestException("Current password is incorrect");
    }
    const lengthErr = assertPasswordLength(newPassword, user.organization);
    if (lengthErr) throw new BadRequestException(lengthErr);
    if (currentPassword === newPassword) {
      throw new BadRequestException("New password must be different from the current password");
    }

    const passwordHash = await hashPassword(newPassword);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: false },
    });
    // Sign out other devices, then hand this device a fresh session.
    await this.sessions.revokeAllForUser(userId);
    const fresh = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { organization: true },
    });
    const session = await this.issueLoginResponse(fresh);

    return { ...session, success: true, mustChangePassword: false };
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

    const live = {
      id: record.id,
      consumedAt: null,
      attempts: { lt: OTP_MAX_ATTEMPTS },
    };
    const valid = await verifyPassword(otp, record.codeHash);
    if (!valid) {
      await this.prisma.emailOtp.updateMany({
        where: live,
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException("Invalid or expired code");
    }

    const claimed = await this.prisma.emailOtp.updateMany({
      where: live,
      data: { consumedAt: new Date() },
    });
    if (claimed.count !== 1) {
      throw new BadRequestException("Invalid or expired code");
    }

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
      avatarUrl?: string | null;
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
    const { tokenVersion } = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { tokenVersion: true },
    });
    const token = this.sessions.signAccessToken(
      {
        sub: user.id,
        organizationId: user.organizationId,
        email: user.email,
        isSuperAdmin: false,
        permissions,
        impersonation: true,
        impersonatedBy,
      },
      tokenVersion,
      expiresIn,
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
        avatarUrl: user.avatarUrl ?? null,
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
      avatarUrl?: string | null;
      organizationId: string;
      isSuperAdmin: boolean;
      platformRole?: string | null;
      mustChangePassword: boolean;
      lastLoginAt: Date | null;
      createdAt: Date;
      organization: {
        name: string;
        slug: string;
        environmentClass?: number;
        sandboxSkipEmailOtp?: boolean;
        sandboxSkipSmsOtp?: boolean;
        sandboxRelaxPassword?: boolean;
        status?: string;
      };
    },
    sessionPortal: SwitchablePortal | null = null,
    refresh: { familyId?: string; sessionId?: string; userAgent?: string | null } = {},
  ) {
    if (
      !user.isSuperAdmin &&
      (user.organization.status === "suspended" || user.organization.status === "cancelled")
    ) {
      throw new ForbiddenException("Organization not available");
    }
    const permissions = await this.getUserPermissions(user.id);
    const portal = currentRequestPortal() ?? sessionPortal;
    if (portal) {
      const status = await this.portalStatus.getStatus();
      const entry = status.portals[portal];
      if (!entry.enabled) {
        throw new ServiceUnavailableException({
          code: "PORTAL_DISABLED",
          message: status.message,
          details: { portal },
        });
      }
      if (entry.maintenanceMessage) {
        throw new ServiceUnavailableException({
          code: "PORTAL_MAINTENANCE",
          message: entry.maintenanceMessage,
          details: { portal },
        });
      }
    }

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

    const mustChangePassword = sandboxAllowsRelaxedPassword(user.organization)
      ? false
      : user.mustChangePassword;

    const { tokenVersion } = await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
      select: { tokenVersion: true },
    });

    const platform = user.isSuperAdmin
      ? {
          platformRole: normalizePlatformRole(user.platformRole),
          platformPermissions: permissionsForPlatformRole(user.platformRole),
        }
      : {};

    const expiresIn = accessTokenTtlSeconds();
    const token = this.sessions.signAccessToken(
      {
        sub: user.id,
        organizationId: user.organizationId,
        email: user.email,
        isSuperAdmin: user.isSuperAdmin,
        permissions,
        ...platform,
        ...(portal ? { portal } : {}),
      },
      tokenVersion,
      expiresIn,
    );

    const nameParts = user.name.trim().split(/\s+/);
    const refreshed = await this.sessions.issueRefreshToken({
      userId: user.id,
      portal: portal ?? null,
      tokenVersion,
      familyId: refresh.familyId,
      sessionId: refresh.sessionId,
      userAgent: refresh.userAgent,
      ttlSeconds: user.isSuperAdmin ? SUPER_ADMIN_REFRESH_TTL_SECONDS : undefined,
    });

    return {
      token,
      accessToken: token,
      refreshToken: refreshed.token,
      sessionId: refreshed.sessionId,
      expiresIn,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        firstName: nameParts[0] ?? "",
        lastName: nameParts.slice(1).join(" ") || "",
        phone: user.phone,
        avatarUrl: user.avatarUrl ?? null,
        isActive: true,
        lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
        createdAt: user.createdAt.toISOString(),
        organizationId: user.organizationId,
        organizationName: user.organization.name,
        organizationSlug: user.organization.slug,
        isSuperAdmin: user.isSuperAdmin,
        mustChangePassword,
        defaultOutletId,
        ...platform,
      },
      permissions,
      ...platform,
      defaultOutletId,
    };
  }

  private hashPhoneOtp(code: string) {
    return createHash("sha256").update(code).digest("hex");
  }

  private widgetBindingToken(reqId: string): string {
    return `msg91w:${createHash("sha256").update(reqId).digest("hex")}`;
  }

  /** Server-side reqId → phone binding so widget-confirm cannot be replayed for another number. */
  private async bindWidgetReqId(reqId: string, phone: string, organizationId: string) {
    await this.prisma.phoneOtp.create({
      data: {
        phone,
        organizationId,
        codeHash: "msg91-widget",
        challengeToken: this.widgetBindingToken(reqId),
        purpose: "staff_widget_binding",
        expiresAt: new Date(Date.now() + this.msg91.otpTtlSeconds() * 1000 + 60_000),
      },
    });
  }

  private findWidgetBinding(reqId: string) {
    return this.prisma.phoneOtp.findFirst({
      where: {
        challengeToken: this.widgetBindingToken(reqId),
        purpose: "staff_widget_binding",
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
  }

  /**
   * Resolve an active staff user by phone (enumeration-safe when thrown as 401).
   * Does not create users — Waiter login is invite-only.
   */
  private async findActiveStaffByPhone(rawPhone: string) {
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
      orderBy: [{ lastLoginAt: { sort: "desc", nulls: "last" } }, { createdAt: "asc" }],
    });
    // Legacy rows stored with spaces/dashes: match on the last 10 digits.
    if (!user && phone.length >= 10) {
      const local = phone.slice(-10);
      const candidates = await this.prisma.user.findMany({
        where: {
          status: "active",
          isSuperAdmin: false,
          phone: { contains: local.slice(-4) },
        },
        include: { organization: true },
        orderBy: [{ lastLoginAt: { sort: "desc", nulls: "last" } }, { createdAt: "asc" }],
        take: 200,
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

    const canonical = normalizeStaffPhone(user.phone ?? phone);
    if (user.phone !== canonical) {
      await this.prisma.user
        .update({ where: { id: user.id }, data: { phone: canonical } })
        .catch(() => undefined);
    }

    return { user, phone, canonical };
  }

  /** Staff waiter primary login: phone + SMS OTP (MSG91 Flow). */
  async requestStaffPhoneOtp(rawPhone: string) {
    const { user, canonical } = await this.findActiveStaffByPhone(rawPhone);

    if (sandboxAllowsSmsOtpSkip(user.organization)) {
      return this.issueLoginResponse(user);
    }

    const otp = String(randomInt(100000, 999999));
    const challengeToken = randomBytes(24).toString("hex");
    const ttl = this.msg91.otpTtlSeconds();
    const expiresAt = new Date(Date.now() + ttl * 1000);

    await assertPhoneOtpSendAllowed(this.prisma, {
      phone: canonical,
      organizationId: user.organizationId,
    });
    const challenge = await this.prisma.phoneOtp.create({
      data: {
        phone: canonical,
        organizationId: user.organizationId,
        codeHash: this.hashPhoneOtp(otp),
        challengeToken,
        purpose: "staff_login",
        expiresAt,
      },
    });

    const send = await this.msg91.sendOtp(canonical, otp);
    if (shouldFailPhoneOtpWhenUnsent(send.sent)) {
      await this.prisma.phoneOtp.delete({ where: { id: challenge.id } }).catch(() => undefined);
      throw new BadRequestException(phoneOtpSmsFailureMessage(send.failureKind));
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
    const challenge = await consumePhoneOtpChallenge(this.prisma, {
      challengeToken,
      codeHash: this.hashPhoneOtp(code.trim()),
      purpose: "staff_login",
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

  /**
   * Staff phone OTP via MSG91 Widget (no DLT/Flow required).
   * Gates on an existing staff user before calling MSG91.
   */
  async requestStaffPhoneOtpWidget(rawPhone: string) {
    const { user, canonical } = await this.findActiveStaffByPhone(rawPhone);

    if (sandboxAllowsSmsOtpSkip(user.organization)) {
      return this.issueLoginResponse(user);
    }

    if (!this.msg91.isWidgetConfigured()) {
      throw new ServiceUnavailableException(
        "MSG91 OTP Widget is not configured on the server",
      );
    }

    await assertPhoneOtpSendAllowed(this.prisma, {
      phone: canonical,
      organizationId: user.organizationId,
    });
    const sent = await this.msg91.widgetSendOtp(canonical);
    if (!sent.ok || !sent.reqId) {
      throw new ServiceUnavailableException(
        friendlyMsg91WidgetMessage(sent.message),
      );
    }
    await this.bindWidgetReqId(sent.reqId, canonical, user.organizationId);

    return {
      reqId: sent.reqId,
      expiresIn: this.msg91.otpTtlSeconds(),
      sent: true,
      provider: "msg91" as const,
    };
  }

  async retryStaffPhoneOtpWidget(reqId?: string) {
    const id = reqId?.trim();
    if (!id) throw new BadRequestException("reqId is required");
    if (!this.msg91.isWidgetConfigured()) {
      throw new ServiceUnavailableException(
        "MSG91 OTP Widget is not configured on the server",
      );
    }
    const binding = await this.findWidgetBinding(id);
    if (!binding) throw new UnauthorizedException("OTP session expired. Request a new code.");
    const retried = await this.msg91.widgetRetryOtp(id);
    if (!retried.ok || !retried.reqId) {
      throw new ServiceUnavailableException(
        friendlyMsg91WidgetMessage(retried.message),
      );
    }
    if (retried.reqId !== id) {
      await this.bindWidgetReqId(retried.reqId, binding.phone, binding.organizationId);
    }
    return {
      reqId: retried.reqId,
      expiresIn: this.msg91.otpTtlSeconds(),
      sent: true,
      provider: "msg91" as const,
    };
  }

  async confirmStaffPhoneOtpWidget(body: {
    reqId?: string;
    otp?: string;
    phone?: string;
  }) {
    const reqId = body.reqId?.trim();
    const otp = body.otp?.trim();
    const rawPhone = body.phone?.trim();
    if (!reqId || !otp) {
      throw new BadRequestException("reqId and otp are required");
    }
    if (!rawPhone) {
      throw new BadRequestException("phone is required");
    }
    if (!this.msg91.isWidgetConfigured()) {
      throw new ServiceUnavailableException(
        "MSG91 OTP Widget is not configured on the server",
      );
    }

    // Ensure staff exists before verifying with MSG91 (cost + enumeration).
    const { user, canonical } = await this.findActiveStaffByPhone(rawPhone);

    const binding = await this.findWidgetBinding(reqId);
    if (!binding || !staffWidgetPhonesMatch(canonical, binding.phone)) {
      throw new UnauthorizedException("Invalid phone or OTP");
    }

    const verified = await this.msg91.widgetVerifyOtp(reqId, otp);
    if (!verified.ok || !verified.accessToken) {
      throw new UnauthorizedException(
        friendlyMsg91WidgetMessage(verified.message) || "Invalid OTP",
      );
    }

    const tokenCheck = await this.msg91.verifyWidgetAccessToken(verified.accessToken);
    if (!tokenCheck.ok) {
      throw new UnauthorizedException(tokenCheck.message ?? "OTP verification failed");
    }

    if (tokenCheck.phone) {
      const msg91Phone = this.msg91.normalizePhone(tokenCheck.phone);
      if (!staffWidgetPhonesMatch(canonical, msg91Phone)) {
        throw new UnauthorizedException("Invalid phone or OTP");
      }
    }

    const consumed = await this.prisma.phoneOtp.updateMany({
      where: { id: binding.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    if (consumed.count !== 1) {
      throw new UnauthorizedException("OTP already used");
    }

    if (
      user.organization.status === "suspended" ||
      user.organization.status === "cancelled"
    ) {
      throw new UnauthorizedException("Organization not available");
    }

    return this.issueLoginResponse(user);
  }

  async registerOwner(input: {
    companyName: string;
    ownerName: string;
    ownerEmail: string;
    ownerPhone: string;
    captchaToken?: string;
  }) {
    const ownerEmail = input.ownerEmail.trim().toLowerCase();
    const companyName = input.companyName.trim();
    const ownerName = input.ownerName.trim() || "Owner";
    const phone = normalizePhoneE164(input.ownerPhone ?? "");
    if (!companyName || companyName.length < 2) {
      throw new BadRequestException("Restaurant name is required");
    }
    if (!ownerEmail) {
      throw new BadRequestException("Email is required");
    }
    if (phone.replace(/\D/g, "").length < 10) {
      throw new BadRequestException("Valid mobile number is required");
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
      adminPhone: phone,
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
    try {
      const sms = await this.msg91.sendTransactionalSms(
        phone,
        smsOwnerCredentials({
          companyName,
          email: ownerEmail,
          temporaryPassword,
          adminUrl: result.adminUrl,
        }),
      );
      smsSent = sms.sent;
    } catch (err) {
      this.logger.warn(
        `Owner credentials SMS failed: ${err instanceof Error ? err.message : err}`,
      );
    }

    const deliveryParts: string[] = [];
    if (emailSent) deliveryParts.push("email");
    if (smsSent) deliveryParts.push("SMS");
    let message: string;
    if (deliveryParts.length > 0) {
      message = `Account created. Check your ${deliveryParts.join(" and ")} for login credentials. You have a 15-day Enterprise trial.`;
    } else {
      message =
        "Account created, but we could not send email or SMS credentials. Contact support or try signing in after password reset is configured. You have a 15-day Enterprise trial.";
      this.logger.warn(
        `Owner credentials not delivered for org ${result.organizationId} (emailSent=false, smsSent=false)`,
      );
    }

    return {
      success: true,
      organizationId: result.organizationId,
      emailSent,
      smsSent,
      message,
    };
  }
}

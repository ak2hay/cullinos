import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { hashPassword, verifyPassword } from "@cullinos/auth";
import { randomInt } from "crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { MailService } from "../mail/mail.service";
import { PlatformConfigService } from "../platform-config/platform-config.service";

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;

type OtpPurpose = "login_2fa" | "password_reset";

type ChallengePayload = {
  sub: string;
  email: string;
  purpose: OtpPurpose;
  type: "otp_challenge";
};

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private mail: MailService,
    private config: PlatformConfigService,
  ) {}

  private isEmailOtpSkipped(): boolean {
    const raw = (this.config.get("AUTH_SKIP_EMAIL_OTP") ?? "").trim().toLowerCase();
    return raw === "true" || raw === "1" || raw === "yes";
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

  async login(email: string, password: string) {
    const user = await this.prisma.user.findFirst({
      where: { email, status: "active" },
      include: { organization: true },
    });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw new UnauthorizedException("Invalid credentials");
    }

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
      where: { email, status: "active" },
    });
    if (user) {
      await this.createAndSendOtp(user.id, user.email, "password_reset");
    }
    return { ok: true as const };
  }

  async resetPassword(email: string, otp: string, newPassword: string) {
    if (newPassword.length < 8) {
      throw new BadRequestException("New password must be at least 8 characters");
    }

    const pending = await this.prisma.emailOtp.findFirst({
      where: {
        email,
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
      where: { email, status: "active" },
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
    if (newPassword.length < 8) {
      throw new BadRequestException("New password must be at least 8 characters");
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
      organization: { name: string };
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
      organization: { name: string };
    },
  ) {
    const permissions = await this.getUserPermissions(user.id);

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
        isSuperAdmin: user.isSuperAdmin,
        mustChangePassword: user.mustChangePassword,
      },
      permissions,
    };
  }
}

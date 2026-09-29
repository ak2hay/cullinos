import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { createHash, randomUUID } from "crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { getJwtSecret } from "../../common/jwt-secret.util";
import {
  PLATFORM_AUDIENCE,
  accessTokenTtlSeconds,
  getSuperAdminJwtSecret,
} from "../../common/access-token.util";

export const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60;
/** Platform-wide access: a stolen super-admin refresh token must not live for a month. */
export const SUPER_ADMIN_REFRESH_TTL_SECONDS = 12 * 60 * 60;
const REUSE_GRACE_MS = 20_000;

type RefreshPayload = {
  sub?: string;
  type?: string;
  jti?: string;
  fam?: string;
  tv?: number;
  portal?: string;
};

export type ConsumedRefresh = {
  userId: string;
  sessionId: string;
  /** Id the replacement session must use (already recorded as replacedById on rotation). */
  nextSessionId: string;
  familyId: string;
  portal: string | null;
  tokenVersion: number;
};

export type AccessClaims = {
  sub: string;
  organizationId: string;
  email: string;
  isSuperAdmin: boolean;
  permissions: string[];
  platformRole?: string;
  platformPermissions?: string[];
  portal?: string;
  impersonation?: boolean;
  impersonatedBy?: string;
};

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Staff session tokens: short-lived access JWTs (super admins on their own key) and
 * rotating refresh tokens tracked in `sessions`. Reusing a rotated refresh token
 * revokes its whole family, so a stolen token dies the moment the owner refreshes.
 */
@Injectable()
export class SessionTokensService {
  private readonly logger = new Logger(SessionTokensService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  signAccessToken(
    claims: AccessClaims,
    tokenVersion: number,
    expiresIn: number = accessTokenTtlSeconds(),
  ): string {
    const payload = { ...claims, tv: tokenVersion };
    if (claims.isSuperAdmin) {
      return this.jwt.sign(payload, {
        secret: getSuperAdminJwtSecret(),
        audience: PLATFORM_AUDIENCE,
        expiresIn,
      });
    }
    return this.jwt.sign(payload, { secret: getJwtSecret(), expiresIn });
  }

  async issueRefreshToken(input: {
    userId: string;
    portal: string | null;
    tokenVersion: number;
    familyId?: string;
    sessionId?: string;
    userAgent?: string | null;
    ttlSeconds?: number;
  }): Promise<{ token: string; sessionId: string; familyId: string }> {
    const sessionId = input.sessionId ?? randomUUID();
    const familyId = input.familyId ?? randomUUID();
    const ttlSeconds = input.ttlSeconds ?? REFRESH_TTL_SECONDS;
    const token = this.jwt.sign(
      {
        sub: input.userId,
        type: "refresh",
        jti: sessionId,
        fam: familyId,
        tv: input.tokenVersion,
        ...(input.portal ? { portal: input.portal } : {}),
      },
      { secret: getJwtSecret(), expiresIn: ttlSeconds },
    );
    await this.prisma.session.create({
      data: {
        id: sessionId,
        userId: input.userId,
        token: hashToken(token),
        familyId,
        portal: input.portal,
        expiresAt: new Date(Date.now() + ttlSeconds * 1000),
        userAgent: input.userAgent?.slice(0, 255) ?? null,
      },
    });
    return { token, sessionId, familyId };
  }

  /** Validates a refresh token and marks it used. Throws on invalid, expired or reused tokens. */
  async consumeRefreshToken(token: string): Promise<ConsumedRefresh> {
    const payload = this.verifyRefresh(token, false);
    const row = await this.prisma.session.findUnique({ where: { id: payload.jti! } });
    if (!row || row.userId !== payload.sub || row.token !== hashToken(token)) {
      throw new UnauthorizedException("Invalid refresh token");
    }
    if (row.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException("Invalid refresh token");
    }
    const nextSessionId = randomUUID();
    let claimed = false;
    if (!row.revokedAt) {
      const now = new Date();
      const result = await this.prisma.session.updateMany({
        where: { id: row.id, revokedAt: null },
        data: { revokedAt: now, lastUsedAt: now, replacedById: nextSessionId },
      });
      claimed = result.count === 1;
    }
    if (!claimed && !(await this.isConcurrentRefresh(row.id))) {
      await this.revokeFamily(row.familyId);
      this.logger.warn(`Refresh token reuse detected for user ${row.userId}; family revoked`);
      throw new UnauthorizedException("Invalid refresh token");
    }
    return {
      userId: row.userId,
      sessionId: row.id,
      nextSessionId: claimed ? nextSessionId : randomUUID(),
      familyId: row.familyId,
      portal: row.portal,
      tokenVersion: typeof payload.tv === "number" ? payload.tv : 0,
    };
  }

  /** Logout: revoke the family of the presented token (expired tokens are accepted here). */
  async revokeByToken(token: string): Promise<string | null> {
    let payload: RefreshPayload;
    try {
      payload = this.verifyRefresh(token, true);
    } catch {
      return null;
    }
    const row = await this.prisma.session.findUnique({
      where: { id: payload.jti! },
      select: { familyId: true, userId: true, token: true },
    });
    if (!row || row.token !== hashToken(token)) return null;
    await this.revokeFamily(row.familyId);
    return row.userId;
  }

  /** Logout everywhere: revokes all refresh tokens and every outstanding access token. */
  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { tokenVersion: { increment: 1 } },
      }),
    ]);
  }

  /**
   * Two tabs (or a retried request) refreshing with the same cookie within a few seconds
   * is not theft: allow it while the token was rotated moments ago and its replacement
   * is still live. Logout/revoke-all clear that path because they revoke the replacement.
   */
  private async isConcurrentRefresh(sessionId: string): Promise<boolean> {
    const row = await this.prisma.session.findUnique({
      where: { id: sessionId },
      select: { revokedAt: true, replacedById: true },
    });
    // Rotation always records replacedById; logout and revoke-all never do.
    if (!row?.revokedAt || !row.replacedById) return false;
    if (Date.now() - row.revokedAt.getTime() > REUSE_GRACE_MS) return false;
    const replacement = await this.prisma.session.findUnique({
      where: { id: row.replacedById },
      select: { revokedAt: true },
    });
    // No replacement row yet: the winning refresh is still in flight.
    return !replacement || !replacement.revokedAt;
  }

  private async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private verifyRefresh(token: string, ignoreExpiration: boolean): RefreshPayload {
    let payload: RefreshPayload;
    try {
      payload = this.jwt.verify<RefreshPayload>(token, {
        secret: getJwtSecret(),
        ignoreExpiration,
      });
    } catch {
      throw new UnauthorizedException("Invalid refresh token");
    }
    // Refresh tokens issued before rotation existed carry no jti and are not accepted.
    if (payload.type !== "refresh" || !payload.sub || !payload.jti || !payload.fam) {
      throw new UnauthorizedException("Invalid refresh token");
    }
    return payload;
  }
}

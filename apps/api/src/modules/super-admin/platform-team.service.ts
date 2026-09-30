import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { hashPassword } from "@cullinos/auth";
import { generateTemporaryPassword } from "../../common/generate-password";
import {
  PLATFORM_ROLES,
  PLATFORM_ROLE_LABELS,
  PLATFORM_ROLE_PERMISSIONS,
  isPlatformRole,
  normalizePlatformRole,
  type PlatformRoleName,
} from "../../common/platform-permissions";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { SessionTokensService } from "../auth/session-tokens.service";
import { MailService } from "../mail/mail.service";

export type PlatformActor = { sub: string; organizationId: string; email?: string };

const MEMBER_SELECT = {
  id: true,
  email: true,
  name: true,
  phone: true,
  status: true,
  platformRole: true,
  mustChangePassword: true,
  lastLoginAt: true,
  createdAt: true,
} as const;

type MemberRow = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  status: string;
  platformRole: string | null;
  mustChangePassword: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
};

function toMember(u: MemberRow) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    phone: u.phone,
    status: u.status,
    platformRole: normalizePlatformRole(u.platformRole),
    mustChangePassword: u.mustChangePassword,
    lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
  };
}

/** Rkyves internal staff who can sign in to the super admin panel. */
@Injectable()
export class PlatformTeamService {
  constructor(
    private prisma: PrismaService,
    private mail: MailService,
    private sessions: SessionTokensService,
    private audit: AuditService,
  ) {}

  private loginUrl(): string {
    return (
      process.env.SUPER_ADMIN_URL?.trim().replace(/\/$/, "") || "https://platform.cullinos.com"
    );
  }

  roles() {
    return PLATFORM_ROLES.map((role) => ({
      role,
      label: PLATFORM_ROLE_LABELS[role],
      permissions: [...PLATFORM_ROLE_PERMISSIONS[role]],
    }));
  }

  async list() {
    const users = await this.prisma.user.findMany({
      where: { isSuperAdmin: true },
      select: MEMBER_SELECT,
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    });
    return users.map(toMember);
  }

  async invite(
    actor: PlatformActor,
    input: { email: string; name: string; platformRole: string },
  ) {
    const email = input.email.trim().toLowerCase();
    const name = input.name.trim();
    if (!email || !name) throw new BadRequestException("Name and email are required");
    const role = this.parseRole(input.platformRole);

    const existing = await this.prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true, isSuperAdmin: true },
    });
    if (existing?.isSuperAdmin) {
      throw new ConflictException("This person is already on the platform team");
    }
    if (existing) {
      throw new BadRequestException(
        "This email belongs to a restaurant account. Use a separate Rkyves work email.",
      );
    }

    const temporaryPassword = generateTemporaryPassword();
    const created = await this.prisma.user.create({
      data: {
        organizationId: actor.organizationId,
        email,
        name,
        passwordHash: await hashPassword(temporaryPassword),
        isSuperAdmin: true,
        platformRole: role,
        mustChangePassword: true,
        status: "active",
      },
      select: MEMBER_SELECT,
    });

    const loginUrl = this.loginUrl();
    const emailSent = await this.mail.sendPlatformStaffInvite({
      to: email,
      name,
      roleLabel: PLATFORM_ROLE_LABELS[role],
      temporaryPassword,
      loginUrl,
      invitedBy: actor.email,
    });

    await this.log(actor, "platform.team_invite", created.id, {
      email,
      platformRole: role,
      emailSent,
    });

    return { member: toMember(created), temporaryPassword, emailSent, loginUrl };
  }

  async changeRole(actor: PlatformActor, userId: string, rawRole: string) {
    const role = this.parseRole(rawRole);
    if (userId === actor.sub) {
      throw new ForbiddenException("You cannot change your own role");
    }
    const target = await this.findMember(userId);
    const previous = normalizePlatformRole(target.platformRole);
    if (previous === role) return toMember(target);

    if (previous === "owner" && target.status === "active") {
      await this.assertAnotherActiveOwner(userId);
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { platformRole: role },
      select: MEMBER_SELECT,
    });
    // New permissions only apply to freshly issued tokens.
    await this.sessions.revokeAllForUser(userId);

    await this.log(actor, "platform.team_role_change", userId, {
      email: target.email,
      from: previous,
      to: role,
    });
    return toMember(updated);
  }

  async deactivate(actor: PlatformActor, userId: string, reason?: string) {
    if (userId === actor.sub) {
      throw new ForbiddenException("You cannot deactivate yourself");
    }
    const target = await this.findMember(userId);
    if (target.status !== "active") return toMember(target);
    if (normalizePlatformRole(target.platformRole) === "owner") {
      await this.assertAnotherActiveOwner(userId);
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { status: "inactive" },
      select: MEMBER_SELECT,
    });
    await this.sessions.revokeAllForUser(userId);

    await this.log(actor, "platform.team_deactivate", userId, {
      email: target.email,
      reason: reason?.trim() || null,
    });
    return toMember(updated);
  }

  async activate(actor: PlatformActor, userId: string) {
    const target = await this.findMember(userId);
    if (target.status === "active") return toMember(target);

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { status: "active" },
      select: MEMBER_SELECT,
    });

    await this.log(actor, "platform.team_activate", userId, { email: target.email });
    return toMember(updated);
  }

  async resetPassword(actor: PlatformActor, userId: string) {
    if (userId === actor.sub) {
      throw new ForbiddenException("Use change password for your own account");
    }
    const target = await this.findMember(userId);

    const temporaryPassword = generateTemporaryPassword();
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await hashPassword(temporaryPassword), mustChangePassword: true },
    });
    await this.sessions.revokeAllForUser(userId);

    const loginUrl = this.loginUrl();
    const emailSent = await this.mail.sendPlatformStaffInvite({
      to: target.email,
      name: target.name,
      roleLabel: PLATFORM_ROLE_LABELS[normalizePlatformRole(target.platformRole)],
      temporaryPassword,
      loginUrl,
      invitedBy: actor.email,
      reset: true,
    });

    await this.log(actor, "platform.team_reset_password", userId, {
      email: target.email,
      emailSent,
    });
    return { userId, email: target.email, temporaryPassword, emailSent, loginUrl };
  }

  private parseRole(value: string): PlatformRoleName {
    if (!isPlatformRole(value)) {
      throw new BadRequestException(`Role must be one of: ${PLATFORM_ROLES.join(", ")}`);
    }
    return value;
  }

  private async findMember(userId: string): Promise<MemberRow> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, isSuperAdmin: true },
      select: MEMBER_SELECT,
    });
    if (!user) throw new NotFoundException("Team member not found");
    return user;
  }

  private async assertAnotherActiveOwner(excludeUserId: string) {
    const others = await this.prisma.user.count({
      where: {
        isSuperAdmin: true,
        status: "active",
        platformRole: "owner",
        id: { not: excludeUserId },
      },
    });
    if (others === 0) {
      throw new ForbiddenException(
        "The platform needs at least one active Owner. Make someone else Owner first.",
      );
    }
  }

  private log(
    actor: PlatformActor,
    action: string,
    entityId: string,
    metadata: Record<string, unknown>,
  ) {
    return this.audit.log({
      organizationId: actor.organizationId,
      userId: actor.sub,
      action,
      entityType: "platform_staff",
      entityId,
      metadata,
    });
  }
}

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
import { PlatformAccessService } from "../platform-iam/platform-access.service";
import { PlatformIamService } from "../platform-iam/platform-iam.service";

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
  platformEmployee: {
    select: {
      employeeCode: true,
      title: true,
      team: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
    },
  },
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
  platformEmployee?: {
    employeeCode: string;
    title: string | null;
    team: { id: string; name: string } | null;
    department: { id: string; name: string } | null;
  } | null;
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
    employeeCode: u.platformEmployee?.employeeCode ?? null,
    title: u.platformEmployee?.title ?? null,
    team: u.platformEmployee?.team ?? null,
    department: u.platformEmployee?.department ?? null,
  };
}

export type InviteStaffInput = {
  email: string;
  name: string;
  platformRole: string;
  title?: string;
  departmentId?: string;
  teamId?: string;
  managerUserId?: string;
  region?: string;
  location?: string;
};

/** Rkyves internal staff who can sign in to the super admin panel. */
@Injectable()
export class PlatformTeamService {
  constructor(
    private prisma: PrismaService,
    private mail: MailService,
    private sessions: SessionTokensService,
    private audit: AuditService,
    private iam: PlatformIamService,
    private access: PlatformAccessService,
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
      where: { isSuperAdmin: true, deletedAt: null },
      select: MEMBER_SELECT,
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    });
    return users.map(toMember);
  }

  async invite(actor: PlatformActor, input: InviteStaffInput) {
    const email = input.email.trim().toLowerCase();
    const name = input.name.trim();
    if (!email || !name) throw new BadRequestException("Name and email are required");
    const role = this.parseRole(input.platformRole);

    const existing = await this.prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true, isSuperAdmin: true, deletedAt: true },
    });
    const rehire = Boolean(existing?.isSuperAdmin && existing.deletedAt);
    if (existing?.isSuperAdmin && !rehire) {
      throw new ConflictException("This person is already on the platform team");
    }
    if (existing && !rehire) {
      throw new BadRequestException(
        "This email belongs to a restaurant account. Use a separate Rkyves work email.",
      );
    }

    const temporaryPassword = generateTemporaryPassword();
    const account = {
      name,
      passwordHash: await hashPassword(temporaryPassword),
      platformRole: role,
      mustChangePassword: true,
      status: "active" as const,
    };
    const created = rehire
      ? await this.prisma.user.update({
          where: { id: existing!.id },
          data: { ...account, deletedAt: null },
          select: { id: true },
        })
      : await this.prisma.user.create({
          data: {
            ...account,
            organizationId: actor.organizationId,
            email,
            isSuperAdmin: true,
          },
          select: { id: true },
        });
    const manager = input.managerUserId
      ? await this.prisma.platformEmployee.findUnique({
          where: { userId: input.managerUserId },
          select: { id: true },
        })
      : null;
    const profile = {
      title: input.title?.trim() || null,
      departmentId: input.departmentId || null,
      teamId: input.teamId || null,
      managerId: manager?.id ?? null,
      region: input.region?.trim() || null,
      location: input.location?.trim() || null,
      joinedAt: new Date(),
    };
    // Returns the existing employee record for a rehire.
    let employee = await this.iam.createEmployee(created.id, profile);
    if (rehire) {
      employee = await this.prisma.platformEmployee.update({
        where: { userId: created.id },
        data: { ...profile, employmentStatus: "active", exitedAt: null },
      });
    }
    const member = await this.findMember(created.id);

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
      employeeCode: employee.employeeCode,
      emailSent,
      rehire,
    });

    return { member: toMember(member), temporaryPassword, emailSent, loginUrl };
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
    this.access.invalidate(userId);

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
    this.access.invalidate(userId);
    await this.prisma.tenantAccessGrant.updateMany({
      where: { userId, status: { in: ["pending", "active"] } },
      data: { status: "revoked", revokedAt: new Date(), revokedById: actor.sub },
    });
    await this.prisma.supportLoginCredential.updateMany({
      where: { createdById: userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

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

  async update(
    actor: PlatformActor,
    userId: string,
    input: { name?: string; email?: string; phone?: string | null },
  ) {
    const target = await this.findMember(userId);
    const data: { name?: string; email?: string; phone?: string | null } = {};
    if (input.name !== undefined) {
      const name = input.name.trim();
      if (!name) throw new BadRequestException("Name is required");
      data.name = name;
    }
    if (input.email !== undefined) {
      const email = input.email.trim().toLowerCase();
      if (!email) throw new BadRequestException("Email is required");
      if (email !== target.email.toLowerCase()) {
        const taken = await this.prisma.user.findFirst({
          where: { email: { equals: email, mode: "insensitive" }, id: { not: userId } },
          select: { id: true },
        });
        if (taken) throw new ConflictException("Another account already uses this email");
        data.email = email;
      }
    }
    if (input.phone !== undefined) data.phone = input.phone?.trim() || null;
    if (!Object.keys(data).length) return toMember(target);

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data,
      select: MEMBER_SELECT,
    });
    if (data.email) {
      // Sign-in identity changed: old sessions must not survive.
      await this.sessions.revokeAllForUser(userId);
      this.access.invalidate(userId);
    }
    await this.log(actor, "platform.team_update", userId, {
      changed: Object.keys(data),
      ...(data.email ? { fromEmail: target.email, toEmail: data.email } : {}),
    });
    return toMember(updated);
  }

  /** Soft delete; call after offboarding so sessions, grants and roles are already revoked. */
  async markDeleted(actor: PlatformActor, userId: string) {
    const target = await this.findMember(userId);
    await this.prisma.user.update({
      where: { id: userId },
      data: { deletedAt: new Date(), status: "inactive" },
    });
    await this.sessions.revokeAllForUser(userId);
    this.access.invalidate(userId);
    await this.log(actor, "platform.team_delete", userId, { email: target.email });
    return { userId, deleted: true };
  }

  /** New temporary password sent with the welcome (invite) email instead of the reset wording. */
  resendInvite(actor: PlatformActor, userId: string) {
    return this.resetPassword(actor, userId, { invite: true });
  }

  async resetPassword(actor: PlatformActor, userId: string, opts: { invite?: boolean } = {}) {
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
      reset: !opts.invite,
    });

    await this.log(
      actor,
      opts.invite ? "platform.team_resend_invite" : "platform.team_reset_password",
      userId,
      { email: target.email, emailSent },
    );
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
      where: { id: userId, isSuperAdmin: true, deletedAt: null },
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

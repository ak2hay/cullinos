import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { hashPassword } from "@cullinos/auth";
import { PrismaService } from "../../prisma/prisma.service";
import {
  STAFF_CREATABLE_ROLES,
  type SystemRoleSlug,
} from "../../common/default-role-permissions";
import { normalizeStaffPhone, staffPhoneLookupVariants } from "../../common/phone.util";
import { OrgRolesService } from "../organizations/org-roles.service";

type CreateStaffUserInput = {
  email: string;
  password: string;
  name: string;
  roleSlug: string;
  outletIds?: string[];
  defaultOutletId?: string;
  phone?: string;
};

export type UpdateStaffUserInput = {
  name?: string;
  /** Empty string or null clears the phone. */
  phone?: string | null;
  roleSlug?: string;
};

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private orgRoles: OrgRolesService,
  ) {}

  async list(orgId: string) {
    const users = await this.prisma.user.findMany({
      where: { organizationId: orgId, isSuperAdmin: false },
      include: {
        userRoles: { include: { role: true } },
        outletUsers: { include: { outlet: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return users.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      status: user.status,
      roles: user.userRoles.map((ur) => ({
        id: ur.role.id,
        slug: ur.role.slug,
        name: ur.role.name,
      })),
      outlets: user.outletUsers.map((ou) => ({
        id: ou.outlet.id,
        name: ou.outlet.name,
        isDefault: ou.isDefault,
      })),
      defaultOutletId:
        user.outletUsers.find((ou) => ou.isDefault)?.outletId ??
        user.outletUsers[0]?.outletId ??
        null,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
    }));
  }

  async createStaffUser(orgId: string, input: CreateStaffUserInput) {
    const roleSlug = input.roleSlug.toLowerCase();
    if (!STAFF_CREATABLE_ROLES.includes(roleSlug as SystemRoleSlug)) {
      throw new BadRequestException(
        `Role must be one of: ${STAFF_CREATABLE_ROLES.join(", ")}`,
      );
    }

    const email = input.email.trim().toLowerCase();
    const existing = await this.prisma.user.findFirst({
      where: {
        organizationId: orgId,
        email: { equals: email, mode: "insensitive" },
      },
    });
    if (existing) {
      throw new ConflictException("A user with this email already exists");
    }

    const phone = await this.resolveStaffPhone(input.phone);

    await this.orgRoles.ensureSystemRoles(orgId);

    const outlets = input.outletIds?.length
      ? await this.prisma.outlet.findMany({
          where: { organizationId: orgId, id: { in: input.outletIds } },
        })
      : await this.prisma.outlet.findMany({
          where: { organizationId: orgId },
          take: 50,
        });

    if (outlets.length === 0) {
      throw new BadRequestException("No outlets available to assign");
    }

    if (input.password.length < 8 || input.password.length > 128) {
      throw new BadRequestException("Password must be 8–128 characters");
    }

    const passwordHash = await hashPassword(input.password);

    const user = await this.prisma.user.create({
      data: {
        organizationId: orgId,
        email,
        passwordHash,
        name: input.name.trim(),
        phone,
        isSuperAdmin: false,
      },
    });

    await this.orgRoles.assignRole(user.id, orgId, roleSlug as SystemRoleSlug);
    const outletIdList = outlets.map((o) => o.id);
    await this.orgRoles.assignOutlets(
      user.id,
      outletIdList,
      input.defaultOutletId,
    );

    await this.prisma.auditLog.create({
      data: {
        organizationId: orgId,
        action: "staff.created",
        entityType: "user",
        entityId: user.id,
        metadata: { email: user.email, roleSlug, phone },
      },
    });

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      roleSlug,
      outletIds: outletIdList,
      defaultOutletId:
        input.defaultOutletId && outletIdList.includes(input.defaultOutletId)
          ? input.defaultOutletId
          : outletIdList[0],
    };
  }

  /**
   * Normalize + validate a staff phone. Waiter OTP login resolves users by phone
   * across all orgs, so a phone may belong to only one active staff account.
   */
  private async resolveStaffPhone(
    raw: string | null | undefined,
    excludeUserId?: string,
  ): Promise<string | null> {
    const trimmed = raw?.trim() || null;
    if (!trimmed) return null;
    const phone = normalizeStaffPhone(trimmed);
    if (phone.length < 12) {
      throw new BadRequestException("Invalid phone number");
    }
    const taken = await this.prisma.user.findFirst({
      where: {
        phone: { in: staffPhoneLookupVariants(phone) },
        status: "active",
        isSuperAdmin: false,
        ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
      },
      select: { id: true },
    });
    if (taken) {
      throw new ConflictException("This phone is already linked to another staff account");
    }
    return phone;
  }

  async updateStaffUser(orgId: string, userId: string, input: UpdateStaffUserInput) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, organizationId: orgId, isSuperAdmin: false },
      include: { userRoles: { include: { role: true } } },
    });
    if (!user) throw new NotFoundException("User not found");
    const isOwner = user.userRoles.some((ur) => ur.role.slug === "owner");

    const data: { name?: string; phone?: string | null } = {};
    if (input.name !== undefined) {
      const name = input.name.trim();
      if (!name) throw new BadRequestException("Name is required");
      data.name = name;
    }
    if (input.phone !== undefined) {
      data.phone = await this.resolveStaffPhone(input.phone, userId);
    }

    let roleSlug: string | undefined;
    if (input.roleSlug) {
      roleSlug = input.roleSlug.toLowerCase();
      if (isOwner) {
        throw new ForbiddenException("Cannot change the organization owner's role");
      }
      if (!STAFF_CREATABLE_ROLES.includes(roleSlug as SystemRoleSlug)) {
        throw new BadRequestException(
          `Role must be one of: ${STAFF_CREATABLE_ROLES.join(", ")}`,
        );
      }
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data,
    });

    if (roleSlug) {
      await this.orgRoles.ensureSystemRoles(orgId);
      const current = user.userRoles.map((ur) => ur.role.slug);
      if (!current.includes(roleSlug)) {
        await this.prisma.userRole.deleteMany({
          where: {
            userId,
            role: {
              organizationId: orgId,
              slug: { in: [...STAFF_CREATABLE_ROLES] },
            },
          },
        });
        await this.orgRoles.assignRole(userId, orgId, roleSlug as SystemRoleSlug);
      }
    }

    await this.prisma.auditLog.create({
      data: {
        organizationId: orgId,
        action: "staff.updated",
        entityType: "user",
        entityId: userId,
        metadata: {
          fields: Object.keys(data).concat(roleSlug ? ["roleSlug"] : []),
          ...(roleSlug ? { roleSlug } : {}),
        },
      },
    });

    return {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      phone: updated.phone,
      status: updated.status,
    };
  }

  async deactivate(orgId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, organizationId: orgId },
      include: { userRoles: { include: { role: true } } },
    });
    if (!user) throw new NotFoundException("User not found");
    if (user.userRoles.some((ur) => ur.role.slug === "owner")) {
      throw new ForbiddenException("Cannot deactivate the organization owner");
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { status: "inactive" },
    });
  }

  async activate(orgId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, organizationId: orgId },
      include: { userRoles: { include: { role: true } } },
    });
    if (!user) throw new NotFoundException("User not found");
    if (user.userRoles.some((ur) => ur.role.slug === "owner")) {
      throw new ForbiddenException("Cannot change status of the organization owner");
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { status: "active" },
    });
  }

  async remove(orgId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, organizationId: orgId },
      include: { userRoles: { include: { role: true } } },
    });
    if (!user) throw new NotFoundException("User not found");
    if (user.userRoles.some((ur) => ur.role.slug === "owner")) {
      throw new ForbiddenException("Cannot delete the organization owner");
    }

    await this.prisma.auditLog.create({
      data: {
        organizationId: orgId,
        action: "staff.deleted",
        entityType: "user",
        entityId: user.id,
        metadata: { email: user.email, name: user.name },
      },
    });

    await this.prisma.user.delete({ where: { id: userId } });
    return { success: true, id: userId };
  }
}

import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import {
  DEFAULT_ROLE_PERMISSIONS,
  SYSTEM_ROLE_SLUGS,
  type SystemRoleSlug,
} from "../../common/default-role-permissions";

const ROLE_LABELS: Record<SystemRoleSlug, string> = {
  owner: "Owner",
  manager: "Manager",
  waiter: "Waiter",
  cashier: "Cashier",
  kitchen: "Kitchen",
};

@Injectable()
export class OrgRolesService {
  constructor(private prisma: PrismaService) {}

  async ensureSystemRoles(organizationId: string) {
    for (const slug of SYSTEM_ROLE_SLUGS) {
      await this.prisma.role.upsert({
        where: { organizationId_slug: { organizationId, slug } },
        update: { name: ROLE_LABELS[slug], isSystem: true },
        create: {
          organizationId,
          slug,
          name: ROLE_LABELS[slug],
          isSystem: true,
        },
      });
    }

    for (const [slug, permissions] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
      const role = await this.prisma.role.findFirst({
        where: { organizationId, slug },
      });
      if (!role) continue;

      for (const perm of permissions) {
        const [module, ...actionParts] = perm.split(":");
        const action = actionParts.join(":");
        const permission = await this.prisma.permission.upsert({
          where: { module_action: { module, action } },
          update: {},
          create: { module, action, description: perm },
        });
        await this.prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: { roleId: role.id, permissionId: permission.id },
          },
          update: {},
          create: { roleId: role.id, permissionId: permission.id },
        });
      }
    }
  }

  async assignRole(userId: string, organizationId: string, roleSlug: SystemRoleSlug) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });
    if (!user || user.organizationId !== organizationId) {
      throw new Error("Cannot assign role across organizations");
    }

    const role = await this.prisma.role.findFirst({
      where: { organizationId, slug: roleSlug },
    });
    if (!role) {
      throw new Error(`Role not found: ${roleSlug}`);
    }
    if (role.organizationId !== organizationId) {
      throw new Error("Role does not belong to organization");
    }

    await this.prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId: role.id } },
      update: {},
      create: { userId, roleId: role.id },
    });
  }

  async assignOutlets(
    userId: string,
    outletIds: string[],
    defaultOutletId?: string | null,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });
    if (!user) {
      throw new Error("User not found");
    }

    const outlets = await this.prisma.outlet.findMany({
      where: {
        id: { in: outletIds },
        organizationId: user.organizationId,
      },
      select: { id: true },
    });
    if (outlets.length !== outletIds.length) {
      throw new Error("Cannot assign outlets from another organization");
    }

    const defaultId =
      defaultOutletId && outlets.some((o) => o.id === defaultOutletId)
        ? defaultOutletId
        : outlets[0]?.id;

    await this.prisma.outletUser.deleteMany({ where: { userId } });
    for (const outlet of outlets) {
      await this.prisma.outletUser.create({
        data: {
          userId,
          outletId: outlet.id,
          isDefault: outlet.id === defaultId,
        },
      });
    }
  }
}

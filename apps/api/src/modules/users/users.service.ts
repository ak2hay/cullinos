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
import { OrgRolesService } from "../organizations/org-roles.service";

type CreateStaffUserInput = {
  email: string;
  password: string;
  name: string;
  roleSlug: string;
  outletIds?: string[];
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
      status: user.status,
      roles: user.userRoles.map((ur) => ({
        id: ur.role.id,
        slug: ur.role.slug,
        name: ur.role.name,
      })),
      outlets: user.outletUsers.map((ou) => ({
        id: ou.outlet.id,
        name: ou.outlet.name,
      })),
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

    const existing = await this.prisma.user.findFirst({
      where: { organizationId: orgId, email: input.email },
    });
    if (existing) {
      throw new ConflictException("A user with this email already exists");
    }

    await this.orgRoles.ensureSystemRoles(orgId);

    const outlets = input.outletIds?.length
      ? await this.prisma.outlet.findMany({
          where: { organizationId: orgId, id: { in: input.outletIds } },
        })
      : await this.prisma.outlet.findMany({ where: { organizationId: orgId }, take: 50 });

    if (outlets.length === 0) {
      throw new BadRequestException("No outlets available to assign");
    }

    const passwordHash = await hashPassword(input.password);

    const user = await this.prisma.user.create({
      data: {
        organizationId: orgId,
        email: input.email,
        passwordHash,
        name: input.name,
        isSuperAdmin: false,
      },
    });

    await this.orgRoles.assignRole(user.id, orgId, roleSlug as SystemRoleSlug);
    await this.orgRoles.assignOutlets(
      user.id,
      (input.outletIds?.length ? outlets : outlets).map((o) => o.id),
    );

    await this.prisma.auditLog.create({
      data: {
        organizationId: orgId,
        action: "staff.created",
        entityType: "user",
        entityId: user.id,
        metadata: { email: user.email, roleSlug },
      },
    });

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      roleSlug,
      outletIds: outlets.map((o) => o.id),
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
}

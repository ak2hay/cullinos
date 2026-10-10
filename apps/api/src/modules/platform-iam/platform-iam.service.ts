import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  PLATFORM_PERMISSION_CATALOG,
  PLATFORM_ROLES,
  PLATFORM_ROLE_DESCRIPTIONS,
  PLATFORM_ROLE_LABELS,
  PLATFORM_ROLE_PERMISSIONS,
  isPlatformPermission,
  isPlatformRole,
  permissionRisk,
} from "../../common/platform-permissions";
import { PrismaService } from "../../prisma/prisma.service";
import { PlatformAccessService } from "./platform-access.service";
import { nextEmployeeCode } from "./employee-code.util";

export type IamActor = { sub: string; email?: string };

const ROLE_KEY_RE = /^[a-z][a-z0-9_]{2,40}$/;
const CODE_RE = /^[A-Z][A-Z0-9_-]{1,20}$/;

function cleanList(values: readonly string[] | undefined): string[] {
  return [...new Set((values ?? []).map((v) => v.trim()).filter(Boolean))];
}

/** Departments, teams, custom roles and role assignments for Rkyves staff. */
@Injectable()
export class PlatformIamService {
  constructor(
    private prisma: PrismaService,
    private access: PlatformAccessService,
  ) {}

  catalog() {
    return {
      permissions: PLATFORM_PERMISSION_CATALOG,
      systemRoles: PLATFORM_ROLES.map((key) => ({
        key,
        name: PLATFORM_ROLE_LABELS[key],
        description: PLATFORM_ROLE_DESCRIPTIONS[key],
        permissions: [...PLATFORM_ROLE_PERMISSIONS[key]],
      })),
    };
  }

  /** Keeps the built-in role rows in step with the code catalog. */
  async syncSystemRoles() {
    for (const key of PLATFORM_ROLES) {
      const role = await this.prisma.platformRoleDef.upsert({
        where: { key },
        create: {
          key,
          name: PLATFORM_ROLE_LABELS[key],
          description: PLATFORM_ROLE_DESCRIPTIONS[key],
          isSystem: true,
        },
        update: {
          name: PLATFORM_ROLE_LABELS[key],
          description: PLATFORM_ROLE_DESCRIPTIONS[key],
          isSystem: true,
        },
      });
      const wanted = PLATFORM_ROLE_PERMISSIONS[key];
      await this.prisma.$transaction([
        this.prisma.platformRolePermission.deleteMany({
          where: { roleId: role.id, permission: { notIn: [...wanted] } },
        }),
        this.prisma.platformRolePermission.createMany({
          data: wanted.map((permission) => ({ roleId: role.id, permission })),
          skipDuplicates: true,
        }),
      ]);
    }
  }

  /** Every platform staff user has an employee record and code. */
  async ensureEmployees() {
    const missing = await this.prisma.user.findMany({
      where: { isSuperAdmin: true, platformEmployee: null },
      select: { id: true, status: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    for (const u of missing) {
      await this.createEmployee(u.id, {
        employmentStatus: u.status === "active" ? "active" : "exited",
        joinedAt: u.createdAt,
      });
    }
  }

  async createEmployee(
    userId: string,
    data: Omit<Prisma.PlatformEmployeeUncheckedCreateInput, "userId" | "employeeCode"> = {},
  ) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const codes = await this.prisma.platformEmployee.findMany({ select: { employeeCode: true } });
      try {
        return await this.prisma.platformEmployee.create({
          data: { ...data, userId, employeeCode: nextEmployeeCode(codes.map((c) => c.employeeCode)) },
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          const existing = await this.prisma.platformEmployee.findUnique({ where: { userId } });
          if (existing) return existing;
          continue;
        }
        throw err;
      }
    }
    throw new ConflictException("Could not allocate an employee code, try again");
  }

  // ─── Departments ──────────────────────────────────────────────────────────

  listDepartments() {
    return this.prisma.platformDepartment.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { teams: true, employees: true } } },
    });
  }

  async createDepartment(input: { name: string; code: string; description?: string; headUserId?: string | null }) {
    const code = input.code.trim().toUpperCase();
    if (!CODE_RE.test(code)) throw new BadRequestException("Code must be 2-21 chars: A-Z, 0-9, _ or -");
    return this.prisma.platformDepartment
      .create({
        data: {
          name: input.name.trim(),
          code,
          description: input.description?.trim() || null,
          headUserId: await this.staffIdOrNull(input.headUserId),
        },
      })
      .catch((e) => this.rethrowUnique(e, "A department with this name or code exists"));
  }

  async updateDepartment(
    id: string,
    input: { name?: string; description?: string | null; headUserId?: string | null },
  ) {
    await this.prisma.platformDepartment.findUniqueOrThrow({ where: { id } }).catch(() => {
      throw new NotFoundException("Department not found");
    });
    return this.prisma.platformDepartment
      .update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name.trim() } : {}),
          ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
          ...(input.headUserId !== undefined ? { headUserId: await this.staffIdOrNull(input.headUserId) } : {}),
        },
      })
      .catch((e) => this.rethrowUnique(e, "A department with this name exists"));
  }

  async deleteDepartment(id: string) {
    const teams = await this.prisma.platformTeam.count({ where: { departmentId: id } });
    if (teams) throw new BadRequestException("Move or delete the department's teams first");
    await this.prisma.platformDepartment.delete({ where: { id } }).catch(() => {
      throw new NotFoundException("Department not found");
    });
    return { ok: true };
  }

  // ─── Teams ────────────────────────────────────────────────────────────────

  listTeams() {
    return this.prisma.platformTeam.findMany({
      orderBy: [{ departmentId: "asc" }, { name: "asc" }],
      include: {
        department: { select: { id: true, name: true, code: true } },
        _count: { select: { employees: true, children: true } },
      },
    });
  }

  async createTeam(input: {
    departmentId: string;
    name: string;
    code: string;
    parentId?: string | null;
    description?: string;
    leadUserId?: string | null;
    ipAllowlist?: string[];
  }) {
    const code = input.code.trim().toUpperCase();
    if (!CODE_RE.test(code)) throw new BadRequestException("Code must be 2-21 chars: A-Z, 0-9, _ or -");
    await this.assertDepartment(input.departmentId);
    if (input.parentId) await this.assertTeam(input.parentId);
    return this.prisma.platformTeam
      .create({
        data: {
          departmentId: input.departmentId,
          parentId: input.parentId || null,
          name: input.name.trim(),
          code,
          description: input.description?.trim() || null,
          leadUserId: await this.staffIdOrNull(input.leadUserId),
          ipAllowlist: cleanList(input.ipAllowlist),
        },
      })
      .catch((e) => this.rethrowUnique(e, "A team with this code exists"));
  }

  async updateTeam(
    id: string,
    input: {
      departmentId?: string;
      name?: string;
      parentId?: string | null;
      description?: string | null;
      leadUserId?: string | null;
      ipAllowlist?: string[];
    },
  ) {
    await this.assertTeam(id);
    if (input.departmentId) await this.assertDepartment(input.departmentId);
    if (input.parentId) {
      if (input.parentId === id) throw new BadRequestException("A team cannot be its own parent");
      await this.assertNoCycle(id, input.parentId);
    }
    const updated = await this.prisma.platformTeam.update({
      where: { id },
      data: {
        ...(input.departmentId ? { departmentId: input.departmentId } : {}),
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.parentId !== undefined ? { parentId: input.parentId || null } : {}),
        ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
        ...(input.leadUserId !== undefined ? { leadUserId: await this.staffIdOrNull(input.leadUserId) } : {}),
        ...(input.ipAllowlist !== undefined ? { ipAllowlist: cleanList(input.ipAllowlist) } : {}),
      },
    });
    if (input.ipAllowlist !== undefined) this.access.invalidate();
    return updated;
  }

  async deleteTeam(id: string) {
    const [members, children] = await Promise.all([
      this.prisma.platformEmployee.count({ where: { teamId: id } }),
      this.prisma.platformTeam.count({ where: { parentId: id } }),
    ]);
    if (members || children) {
      throw new BadRequestException("Move the team's members and sub-teams first");
    }
    await this.prisma.platformTeam.delete({ where: { id } }).catch(() => {
      throw new NotFoundException("Team not found");
    });
    return { ok: true };
  }

  // ─── Roles ────────────────────────────────────────────────────────────────

  async listRoles() {
    const roles = await this.prisma.platformRoleDef.findMany({
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
      include: {
        permissions: { select: { permission: true } },
        _count: { select: { assignments: { where: { revokedAt: null } } } },
      },
    });
    const primaryCounts = await this.prisma.user.groupBy({
      by: ["platformRole"],
      where: { isSuperAdmin: true, status: "active" },
      _count: { _all: true },
    });
    const primary = new Map(primaryCounts.map((r) => [r.platformRole, r._count._all]));
    return roles.map((r) => ({
      id: r.id,
      key: r.key,
      name: r.name,
      description: r.description,
      isSystem: r.isSystem,
      ipAllowlist: r.ipAllowlist,
      permissions: r.permissions.map((p) => p.permission),
      maxRisk: this.maxRisk(r.permissions.map((p) => p.permission)),
      activeAssignments: r._count.assignments,
      primaryHolders: r.isSystem ? (primary.get(r.key as never) ?? 0) : 0,
    }));
  }

  async createRole(input: {
    key: string;
    name: string;
    description?: string;
    permissions: string[];
    ipAllowlist?: string[];
  }) {
    const key = input.key.trim().toLowerCase();
    if (!ROLE_KEY_RE.test(key)) {
      throw new BadRequestException("Key must be 3-41 chars: lowercase letters, digits, underscore");
    }
    if (isPlatformRole(key)) throw new ConflictException("That key is reserved for a built-in role");
    const permissions = this.validPermissions(input.permissions);
    return this.prisma.platformRoleDef
      .create({
        data: {
          key,
          name: input.name.trim(),
          description: input.description?.trim() || null,
          ipAllowlist: cleanList(input.ipAllowlist),
          permissions: { create: permissions.map((permission) => ({ permission })) },
        },
        include: { permissions: true },
      })
      .catch((e) => this.rethrowUnique(e, "A role with this key exists"));
  }

  async updateRole(
    id: string,
    input: { name?: string; description?: string | null; permissions?: string[]; ipAllowlist?: string[] },
  ) {
    const role = await this.prisma.platformRoleDef.findUnique({ where: { id } });
    if (!role) throw new NotFoundException("Role not found");
    if (role.isSystem && (input.permissions !== undefined || input.name !== undefined)) {
      throw new ForbiddenException("Built-in roles are defined in code; clone it into a custom role instead");
    }
    const permissions = input.permissions !== undefined ? this.validPermissions(input.permissions) : null;
    await this.prisma.$transaction(async (tx) => {
      await tx.platformRoleDef.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name.trim() } : {}),
          ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
          ...(input.ipAllowlist !== undefined ? { ipAllowlist: cleanList(input.ipAllowlist) } : {}),
        },
      });
      if (permissions) {
        await tx.platformRolePermission.deleteMany({ where: { roleId: id } });
        await tx.platformRolePermission.createMany({
          data: permissions.map((permission) => ({ roleId: id, permission })),
        });
      }
    });
    this.access.invalidate();
    return (await this.listRoles()).find((r) => r.id === id);
  }

  async deleteRole(id: string) {
    const role = await this.prisma.platformRoleDef.findUnique({ where: { id } });
    if (!role) throw new NotFoundException("Role not found");
    if (role.isSystem) throw new ForbiddenException("Built-in roles cannot be deleted");
    const active = await this.prisma.platformRoleAssignment.count({
      where: { roleId: id, revokedAt: null },
    });
    if (active) throw new BadRequestException("Revoke this role from everyone first");
    await this.prisma.platformRoleDef.delete({ where: { id } });
    this.access.invalidate();
    return { ok: true };
  }

  // ─── Assignments ──────────────────────────────────────────────────────────

  async listAssignments(filter: { userId?: string; roleId?: string; includeRevoked?: boolean }) {
    const rows = await this.prisma.platformRoleAssignment.findMany({
      where: {
        ...(filter.userId ? { userId: filter.userId } : {}),
        ...(filter.roleId ? { roleId: filter.roleId } : {}),
        ...(filter.includeRevoked ? {} : { revokedAt: null }),
      },
      orderBy: { createdAt: "desc" },
      take: 500,
      include: {
        role: { select: { id: true, key: true, name: true, isSystem: true } },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            platformEmployee: { select: { employeeCode: true } },
          },
        },
      },
    });
    const now = Date.now();
    return rows.map((r) => ({
      ...r,
      expired: Boolean(r.expiresAt && r.expiresAt.getTime() <= now),
    }));
  }

  /** Facts the approval policy for iam.assign can condition on. */
  async assignmentFacts(roleId: string) {
    const role = await this.prisma.platformRoleDef.findUnique({
      where: { id: roleId },
      include: { permissions: true },
    });
    return { roleKey: role?.key ?? null, maxRisk: role ? this.maxRisk(role.permissions.map((p) => p.permission)) : null };
  }

  async assignRole(
    actor: IamActor,
    input: {
      userId: string;
      roleId: string;
      scopeType?: "global" | "region" | "tenant_set";
      scopeValues?: string[];
      expiresAt?: string | null;
      reason?: string;
    },
    approvalRequestId?: string | null,
  ) {
    if (input.userId === actor.sub) throw new ForbiddenException("You cannot grant roles to yourself");
    const [user, role] = await Promise.all([
      this.prisma.user.findFirst({ where: { id: input.userId, isSuperAdmin: true }, select: { id: true } }),
      this.prisma.platformRoleDef.findUnique({ where: { id: input.roleId } }),
    ]);
    if (!user) throw new NotFoundException("Staff member not found");
    if (!role) throw new NotFoundException("Role not found");
    if (role.key === "owner") {
      throw new ForbiddenException("Owner is only granted as a primary role from Platform team");
    }
    const scopeType = input.scopeType ?? "global";
    const scopeValues = cleanList(input.scopeValues);
    if (scopeType !== "global" && !scopeValues.length) {
      throw new BadRequestException("Scoped assignments need at least one region or tenant id");
    }
    if (scopeType === "tenant_set") {
      const found = await this.prisma.organization.count({ where: { id: { in: scopeValues } } });
      if (found !== scopeValues.length) throw new BadRequestException("Unknown tenant id in scope");
    }
    const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
    if (expiresAt && (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now())) {
      throw new BadRequestException("Expiry must be in the future");
    }
    const created = await this.prisma.platformRoleAssignment.create({
      data: {
        userId: input.userId,
        roleId: input.roleId,
        scopeType,
        scopeValues: scopeType === "global" ? [] : scopeValues,
        expiresAt,
        reason: input.reason?.trim() || null,
        grantedById: actor.sub,
        approvalRequestId: approvalRequestId ?? null,
      },
    });
    this.access.invalidate(input.userId);
    return created;
  }

  async revokeAssignment(actor: IamActor, id: string) {
    const row = await this.prisma.platformRoleAssignment.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Assignment not found");
    if (row.revokedAt) return row;
    const updated = await this.prisma.platformRoleAssignment.update({
      where: { id },
      data: { revokedAt: new Date(), revokedById: actor.sub },
    });
    this.access.invalidate(row.userId);
    return updated;
  }

  // ─── helpers ──────────────────────────────────────────────────────────────

  maxRisk(permissions: readonly string[]) {
    const order = ["low", "medium", "high", "critical"] as const;
    let max = -1;
    for (const p of permissions) {
      const r = permissionRisk(p);
      if (r) max = Math.max(max, order.indexOf(r));
    }
    return max < 0 ? null : order[max];
  }

  private validPermissions(perms: readonly string[]) {
    const clean = cleanList(perms);
    const bad = clean.filter((p) => !isPlatformPermission(p));
    if (bad.length) throw new BadRequestException(`Unknown permissions: ${bad.join(", ")}`);
    if (!clean.length) throw new BadRequestException("Pick at least one permission");
    return clean;
  }

  private async staffIdOrNull(userId: string | null | undefined) {
    if (!userId) return null;
    const u = await this.prisma.user.findFirst({ where: { id: userId, isSuperAdmin: true }, select: { id: true } });
    if (!u) throw new BadRequestException("That person is not on the platform team");
    return u.id;
  }

  private async assertDepartment(id: string) {
    const d = await this.prisma.platformDepartment.findUnique({ where: { id }, select: { id: true } });
    if (!d) throw new BadRequestException("Department not found");
  }

  private async assertTeam(id: string) {
    const t = await this.prisma.platformTeam.findUnique({ where: { id }, select: { id: true } });
    if (!t) throw new NotFoundException("Team not found");
  }

  private async assertNoCycle(teamId: string, newParentId: string) {
    let cursor: string | null = newParentId;
    for (let depth = 0; cursor && depth < 50; depth++) {
      if (cursor === teamId) throw new BadRequestException("That would create a team cycle");
      const parent: { parentId: string | null } | null = await this.prisma.platformTeam.findUnique({
        where: { id: cursor },
        select: { parentId: true },
      });
      cursor = parent?.parentId ?? null;
    }
  }

  private rethrowUnique(err: unknown, message: string): never {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new ConflictException(message);
    }
    throw err;
  }
}

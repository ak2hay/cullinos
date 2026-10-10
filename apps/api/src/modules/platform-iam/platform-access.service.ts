import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import {
  computeEffectiveAccess,
  type AssignmentInput,
  type EffectiveAccess,
} from "./platform-access.util";

const CACHE_TTL_MS = 30_000;

export type StaffIdentity = {
  userId: string;
  email: string;
  name: string;
  employeeCode: string | null;
  teamId: string | null;
  departmentId: string | null;
  managerUserId: string | null;
};

type CachedStaff = {
  identity: StaffIdentity;
  primaryRole: string | null;
  assignments: AssignmentInput[];
  teamIpAllowlist: string[];
  expiresAt: number;
};

/**
 * Resolves platform staff permissions from the database (primary role + extra role
 * assignments). Cached briefly per user; IAM writes call invalidate() for instant effect
 * on this instance.
 */
@Injectable()
export class PlatformAccessService {
  private cache = new Map<string, CachedStaff>();

  constructor(private prisma: PrismaService) {}

  invalidate(userId?: string) {
    if (userId) this.cache.delete(userId);
    else this.cache.clear();
  }

  async identity(userId: string): Promise<StaffIdentity | null> {
    return (await this.load(userId))?.identity ?? null;
  }

  async resolve(userId: string, ip: string | undefined): Promise<EffectiveAccess | null> {
    const staff = await this.load(userId);
    if (!staff) return null;
    return computeEffectiveAccess({
      primaryRole: staff.primaryRole,
      assignments: staff.assignments,
      teamIpAllowlist: staff.teamIpAllowlist,
      ip,
    });
  }

  /** User ids currently holding any of the role keys (primary or active assignment). */
  async userIdsWithRoles(roleKeys: readonly string[]): Promise<string[]> {
    if (!roleKeys.length) return [];
    const now = new Date();
    const systemKeys = roleKeys.filter((k) =>
      ["owner", "support", "sales", "marketing", "finance", "viewer"].includes(k),
    );
    const [primary, assigned] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          isSuperAdmin: true,
          status: "active",
          platformRole: { in: systemKeys as never[] },
        },
        select: { id: true },
      }),
      this.prisma.platformRoleAssignment.findMany({
        where: {
          revokedAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          role: { key: { in: [...roleKeys] } },
          user: { status: "active", isSuperAdmin: true },
        },
        select: { userId: true },
      }),
    ]);
    return [...new Set([...primary.map((u) => u.id), ...assigned.map((a) => a.userId)])];
  }

  private async load(userId: string): Promise<CachedStaff | null> {
    const now = Date.now();
    const hit = this.cache.get(userId);
    if (hit && hit.expiresAt > now) return hit;

    const user = await this.prisma.user.findFirst({
      where: { id: userId, isSuperAdmin: true },
      select: {
        id: true,
        email: true,
        name: true,
        platformRole: true,
        platformEmployee: {
          select: {
            employeeCode: true,
            teamId: true,
            departmentId: true,
            manager: { select: { userId: true } },
            team: { select: { ipAllowlist: true } },
          },
        },
        platformRoleAssignments: {
          where: { revokedAt: null },
          select: {
            scopeType: true,
            scopeValues: true,
            expiresAt: true,
            revokedAt: true,
            role: {
              select: {
                key: true,
                ipAllowlist: true,
                permissions: { select: { permission: true } },
              },
            },
          },
        },
      },
    });
    if (!user) {
      this.cache.delete(userId);
      return null;
    }

    const emp = user.platformEmployee;
    const entry: CachedStaff = {
      identity: {
        userId: user.id,
        email: user.email,
        name: user.name,
        employeeCode: emp?.employeeCode ?? null,
        teamId: emp?.teamId ?? null,
        departmentId: emp?.departmentId ?? null,
        managerUserId: emp?.manager?.userId ?? null,
      },
      primaryRole: user.platformRole,
      assignments: user.platformRoleAssignments.map((a) => ({
        roleKey: a.role.key,
        permissions: a.role.permissions.map((p) => p.permission),
        scopeType: a.scopeType,
        scopeValues: a.scopeValues,
        expiresAt: a.expiresAt,
        revokedAt: a.revokedAt,
        roleIpAllowlist: a.role.ipAllowlist,
      })),
      teamIpAllowlist: emp?.team?.ipAllowlist ?? [],
      expiresAt: now + CACHE_TTL_MS,
    };
    if (this.cache.size > 5_000) this.cache.clear();
    this.cache.set(userId, entry);
    return entry;
  }
}

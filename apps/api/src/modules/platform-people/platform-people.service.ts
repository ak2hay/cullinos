import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { PlatformEmploymentStatus, Prisma } from "@prisma/client";
import { PLATFORM_ROLES, isPlatformRole } from "../../common/platform-permissions";
import { PrismaService } from "../../prisma/prisma.service";
import { SessionTokensService } from "../auth/session-tokens.service";
import { PlatformAccessService } from "../platform-iam/platform-access.service";
import type { EffectiveAccess } from "../platform-iam/platform-access.util";
import { PlatformNotificationsService } from "../platform-iam/platform-notifications.service";
import { PlatformTeamService } from "../super-admin/platform-team.service";
import { onCallUserId, rotationSchedule } from "./on-call.util";

export type PeopleActor = { sub: string; organizationId: string; email?: string };

export type BulkInviteRow = {
  email: string;
  name: string;
  platformRole?: string;
  title?: string;
  departmentCode?: string;
  teamCode?: string;
  managerEmail?: string;
  region?: string;
  location?: string;
};

const EMPLOYEE_INCLUDE = {
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      avatarUrl: true,
      status: true,
      platformRole: true,
      lastLoginAt: true,
    },
  },
  team: { select: { id: true, name: true, code: true } },
  department: { select: { id: true, name: true, code: true } },
  manager: { select: { userId: true, employeeCode: true, user: { select: { name: true } } } },
} satisfies Prisma.PlatformEmployeeInclude;

/** Employee directory, org chart, joiner / mover / leaver workflows, shifts and on-call. */
@Injectable()
export class PlatformPeopleService {
  constructor(
    private prisma: PrismaService,
    private access: PlatformAccessService,
    private sessions: SessionTokensService,
    private notifications: PlatformNotificationsService,
    private team: PlatformTeamService,
  ) {}

  // ─── Directory ────────────────────────────────────────────────────────────

  async directory(filter: {
    q?: string;
    departmentId?: string;
    teamId?: string;
    status?: string;
    managerUserId?: string;
    role?: string;
    cursor?: string;
    limit?: number;
  }) {
    const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
    const q = filter.q?.trim();
    const where: Prisma.PlatformEmployeeWhereInput = {
      ...(filter.departmentId ? { departmentId: filter.departmentId } : {}),
      ...(filter.teamId ? { teamId: filter.teamId } : {}),
      ...(filter.status ? { employmentStatus: filter.status as PlatformEmploymentStatus } : {}),
      ...(filter.managerUserId ? { manager: { userId: filter.managerUserId } } : {}),
      ...(filter.role && isPlatformRole(filter.role) ? { user: { platformRole: filter.role } } : {}),
      ...(q
        ? {
            OR: [
              { employeeCode: { contains: q, mode: "insensitive" } },
              { title: { contains: q, mode: "insensitive" } },
              { user: { name: { contains: q, mode: "insensitive" } } },
              { user: { email: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
    };
    const rows = await this.prisma.platformEmployee.findMany({
      where,
      orderBy: { employeeCode: "asc" },
      take: limit + 1,
      ...(filter.cursor ? { cursor: { employeeCode: filter.cursor }, skip: 1 } : {}),
      include: EMPLOYEE_INCLUDE,
    });
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const total = await this.prisma.platformEmployee.count({ where });
    return {
      data: page.map((e) => this.toEmployee(e)),
      total,
      nextCursor: hasMore ? page[page.length - 1].employeeCode : null,
    };
  }

  async orgChart() {
    const rows = await this.prisma.platformEmployee.findMany({
      where: { employmentStatus: { not: "exited" } },
      include: EMPLOYEE_INCLUDE,
      orderBy: { employeeCode: "asc" },
    });
    return rows.map((e) => ({
      userId: e.userId,
      employeeCode: e.employeeCode,
      name: e.user.name,
      title: e.title,
      primaryRole: e.user.platformRole,
      team: e.team,
      department: e.department,
      managerUserId: e.manager?.userId ?? null,
    }));
  }

  async profile(userId: string, access: EffectiveAccess | undefined) {
    const e = await this.prisma.platformEmployee.findUnique({
      where: { userId },
      include: { ...EMPLOYEE_INCLUDE, reports: { include: { user: { select: { id: true, name: true } } } } },
    });
    if (!e) throw new NotFoundException("Employee not found");
    const can = (p: string) => Boolean(access?.isOwner || access?.global.includes(p));
    const now = new Date();
    const [assignments, sessions, activity, openTickets, activeGrants, shifts] = await Promise.all([
      this.prisma.platformRoleAssignment.findMany({
        where: { userId, revokedAt: null },
        include: { role: { select: { id: true, key: true, name: true } } },
        orderBy: { createdAt: "desc" },
      }),
      can("sessions.manage")
        ? this.prisma.session.findMany({
            where: { userId, revokedAt: null, expiresAt: { gt: now } },
            select: { id: true, familyId: true, portal: true, userAgent: true, createdAt: true, lastUsedAt: true, expiresAt: true },
            orderBy: { createdAt: "desc" },
            take: 20,
          })
        : Promise.resolve(null),
      can("activity.read")
        ? this.prisma.platformActivityLog.findMany({
            where: { userId },
            orderBy: { seq: "desc" },
            take: 25,
            select: { id: true, action: true, statusCode: true, targetOrgId: true, createdAt: true, ip: true },
          })
        : Promise.resolve(null),
      this.prisma.supportTicket.count({
        where: { assigneeUserId: userId, status: { in: ["open", "in_progress", "waiting_customer"] } },
      }),
      this.prisma.tenantAccessGrant.count({ where: { userId, status: "active", expiresAt: { gt: now } } }),
      this.prisma.platformShift.findMany({
        where: { userId, endsAt: { gt: now } },
        orderBy: { startsAt: "asc" },
        take: 10,
      }),
    ]);
    return {
      ...this.toEmployee(e),
      reports: e.reports.map((r) => ({ userId: r.userId, name: r.user.name, employeeCode: r.employeeCode })),
      assignments: assignments.map((a) => ({
        ...a,
        expired: Boolean(a.expiresAt && a.expiresAt <= now),
      })),
      sessions,
      recentActivity: activity?.map((a) => ({ ...a })) ?? null,
      openTickets,
      activeGrants,
      upcomingShifts: shifts,
    };
  }

  async updateEmployee(
    actor: PeopleActor,
    userId: string,
    input: {
      title?: string | null;
      departmentId?: string | null;
      teamId?: string | null;
      managerUserId?: string | null;
      region?: string | null;
      location?: string | null;
      employmentStatus?: PlatformEmploymentStatus;
      joinedAt?: string | null;
    },
  ) {
    const e = await this.prisma.platformEmployee.findUnique({ where: { userId } });
    if (!e) throw new NotFoundException("Employee not found");
    if (input.employmentStatus === "exited") {
      throw new BadRequestException("Use Offboard to exit an employee");
    }
    let managerId: string | null | undefined;
    if (input.managerUserId !== undefined) {
      if (input.managerUserId === userId) throw new BadRequestException("Someone cannot manage themselves");
      if (input.managerUserId) {
        const m = await this.prisma.platformEmployee.findUnique({
          where: { userId: input.managerUserId },
          select: { id: true },
        });
        if (!m) throw new BadRequestException("Manager is not on the platform team");
        await this.assertNoManagerCycle(e.id, m.id);
        managerId = m.id;
      } else {
        managerId = null;
      }
    }
    if (input.teamId) {
      const t = await this.prisma.platformTeam.findUnique({ where: { id: input.teamId }, select: { departmentId: true } });
      if (!t) throw new BadRequestException("Team not found");
      if (input.departmentId === undefined) input.departmentId = t.departmentId;
    }
    const updated = await this.prisma.platformEmployee.update({
      where: { userId },
      data: {
        ...(input.title !== undefined ? { title: input.title?.trim() || null } : {}),
        ...(input.departmentId !== undefined ? { departmentId: input.departmentId || null } : {}),
        ...(input.teamId !== undefined ? { teamId: input.teamId || null } : {}),
        ...(managerId !== undefined ? { managerId } : {}),
        ...(input.region !== undefined ? { region: input.region?.trim() || null } : {}),
        ...(input.location !== undefined ? { location: input.location?.trim() || null } : {}),
        ...(input.employmentStatus ? { employmentStatus: input.employmentStatus } : {}),
        ...(input.joinedAt !== undefined ? { joinedAt: input.joinedAt ? new Date(input.joinedAt) : null } : {}),
      },
    });
    this.access.invalidate(userId);

    const moved =
      (input.teamId !== undefined && input.teamId !== e.teamId) ||
      (input.departmentId !== undefined && input.departmentId !== e.departmentId);
    let reviewCampaignId: string | null = null;
    if (moved) reviewCampaignId = await this.flagMoverForReview(actor, userId, updated.managerId);
    return { ...(await this.profile(userId, undefined)), reviewCampaignId };
  }

  /** Mover: their extra role grants go into a one-off access review for the new manager. */
  private async flagMoverForReview(actor: PeopleActor, userId: string, managerEmployeeId: string | null) {
    const assignments = await this.prisma.platformRoleAssignment.findMany({
      where: { userId, revokedAt: null },
      include: { role: { select: { key: true } } },
    });
    if (!assignments.length) return null;
    const [user, manager] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
      managerEmployeeId
        ? this.prisma.platformEmployee.findUnique({ where: { id: managerEmployeeId }, select: { userId: true } })
        : Promise.resolve(null),
    ]);
    const reviewerId = manager?.userId ?? null;
    const campaign = await this.prisma.platformAccessReviewCampaign.create({
      data: {
        name: `Team move: ${user?.name ?? userId}`,
        dueAt: new Date(Date.now() + 7 * 24 * 3600_000),
        createdById: actor.sub,
        items: {
          create: assignments.map((a) => ({
            assignmentId: a.id,
            userId,
            roleKey: a.role.key,
            reviewerId,
          })),
        },
      },
    });
    if (reviewerId) {
      await this.notifications.notify([reviewerId], {
        kind: "review.requested",
        title: `Review ${user?.name ?? "a teammate"}'s access after their team move`,
        link: `/access/reviews/${campaign.id}`,
        email: true,
      });
    }
    return campaign.id;
  }

  /**
   * Leaver: same-day lockout. Deactivates the account, revokes sessions, role grants and
   * tenant access, hands open tickets to `transferToUserId`, cancels their pending
   * approval requests and removes them from on-call rotations.
   */
  async offboard(actor: PeopleActor, userId: string, input: { reason?: string; transferToUserId?: string | null }) {
    if (userId === actor.sub) throw new ForbiddenException("You cannot offboard yourself");
    const e = await this.prisma.platformEmployee.findUnique({ where: { userId }, include: { user: true } });
    if (!e) throw new NotFoundException("Employee not found");
    if (input.transferToUserId) {
      if (input.transferToUserId === userId) throw new BadRequestException("Pick someone else to take over");
      const t = await this.prisma.user.findFirst({
        where: { id: input.transferToUserId, isSuperAdmin: true, status: "active" },
        select: { id: true },
      });
      if (!t) throw new BadRequestException("Hand-over person must be active platform staff");
    }

    if (e.user.status === "active") {
      // Enforces the last-owner rule and revokes sessions.
      await this.team.deactivate(actor, userId, input.reason);
    } else {
      await this.sessions.revokeAllForUser(userId);
    }
    const now = new Date();
    const [assignments, grants, tickets, approvals, rotations] = await Promise.all([
      this.prisma.platformRoleAssignment.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now, revokedById: actor.sub },
      }),
      this.prisma.tenantAccessGrant.updateMany({
        where: { userId, status: { in: ["pending", "active"] } },
        data: { status: "revoked", revokedAt: now, revokedById: actor.sub },
      }),
      this.prisma.supportTicket.updateMany({
        where: { assigneeUserId: userId, status: { in: ["open", "in_progress", "waiting_customer"] } },
        data: { assigneeUserId: input.transferToUserId ?? null },
      }),
      this.prisma.platformApprovalRequest.updateMany({
        where: { requestedById: userId, status: { in: ["pending", "approved"] } },
        data: { status: "cancelled" },
      }),
      this.prisma.platformOnCallRotation.findMany({ where: { memberUserIds: { has: userId } } }),
    ]);
    for (const r of rotations) {
      await this.prisma.platformOnCallRotation.update({
        where: { id: r.id },
        data: { memberUserIds: r.memberUserIds.filter((id) => id !== userId) },
      });
    }
    await this.prisma.platformShift.deleteMany({ where: { userId, startsAt: { gt: now } } });
    await this.prisma.platformEmployee.update({
      where: { userId },
      data: { employmentStatus: "exited", exitedAt: now },
    });
    this.access.invalidate(userId);
    if (input.transferToUserId && tickets.count) {
      await this.notifications.notify([input.transferToUserId], {
        kind: "ticket.transferred",
        title: `${tickets.count} ticket(s) handed over to you from ${e.user.name}`,
        link: "/support/tickets?assignee=me",
      });
    }
    return {
      userId,
      employeeCode: e.employeeCode,
      revokedAssignments: assignments.count,
      revokedGrants: grants.count,
      transferredTickets: tickets.count,
      cancelledApprovals: approvals.count,
      rotationsUpdated: rotations.length,
    };
  }

  /** Joiner (bulk): creates each account via the normal invite flow. */
  async bulkInvite(actor: PeopleActor, rows: BulkInviteRow[]) {
    const [departments, teams] = await Promise.all([
      this.prisma.platformDepartment.findMany({ select: { id: true, code: true } }),
      this.prisma.platformTeam.findMany({ select: { id: true, code: true, departmentId: true } }),
    ]);
    const deptByCode = new Map(departments.map((d) => [d.code.toUpperCase(), d.id]));
    const teamByCode = new Map(teams.map((t) => [t.code.toUpperCase(), t]));
    const results: { row: number; email: string; ok: boolean; error?: string; employeeCode?: string | null; temporaryPassword?: string; emailSent?: boolean }[] = [];

    for (const [i, row] of rows.entries()) {
      try {
        const role = (row.platformRole ?? "viewer").trim().toLowerCase();
        if (!isPlatformRole(role)) throw new Error(`Role must be one of ${PLATFORM_ROLES.join(", ")}`);
        if (role === "owner") throw new Error("Owners cannot be bulk-invited");
        const team = row.teamCode ? teamByCode.get(row.teamCode.trim().toUpperCase()) : undefined;
        if (row.teamCode && !team) throw new Error(`Unknown team code ${row.teamCode}`);
        const departmentId = row.departmentCode
          ? deptByCode.get(row.departmentCode.trim().toUpperCase())
          : team?.departmentId;
        if (row.departmentCode && !departmentId) throw new Error(`Unknown department code ${row.departmentCode}`);
        const manager = row.managerEmail
          ? await this.prisma.user.findFirst({
              where: { email: { equals: row.managerEmail.trim(), mode: "insensitive" }, isSuperAdmin: true },
              select: { id: true },
            })
          : null;
        if (row.managerEmail && !manager) throw new Error(`Manager ${row.managerEmail} not found`);
        const res = await this.team.invite(actor, {
          email: row.email,
          name: row.name,
          platformRole: role,
          title: row.title,
          departmentId,
          teamId: team?.id,
          managerUserId: manager?.id,
          region: row.region,
          location: row.location,
        });
        results.push({
          row: i + 1,
          email: row.email,
          ok: true,
          employeeCode: res.member.employeeCode,
          temporaryPassword: res.emailSent ? undefined : res.temporaryPassword,
          emailSent: res.emailSent,
        });
      } catch (err) {
        results.push({ row: i + 1, email: row.email, ok: false, error: (err as Error).message });
      }
    }
    return { created: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length, results };
  }

  // ─── Shifts & on-call ─────────────────────────────────────────────────────

  async listShifts(filter: { from?: string; to?: string; teamId?: string; userId?: string }) {
    const from = filter.from ? new Date(filter.from) : new Date(Date.now() - 24 * 3600_000);
    const to = filter.to ? new Date(filter.to) : new Date(Date.now() + 14 * 24 * 3600_000);
    const shifts = await this.prisma.platformShift.findMany({
      where: {
        startsAt: { lt: to },
        endsAt: { gt: from },
        ...(filter.teamId ? { teamId: filter.teamId } : {}),
        ...(filter.userId ? { userId: filter.userId } : {}),
      },
      orderBy: { startsAt: "asc" },
      take: 1000,
    });
    const names = await this.names(shifts.map((s) => s.userId));
    return shifts.map((s) => ({ ...s, user: names.get(s.userId) ?? null }));
  }

  async createShift(input: { userId: string; teamId?: string | null; kind: string; startsAt: string; endsAt: string; note?: string }) {
    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(input.endsAt);
    if (!(endsAt > startsAt)) throw new BadRequestException("Shift must end after it starts");
    if (endsAt.getTime() - startsAt.getTime() > 31 * 24 * 3600_000) {
      throw new BadRequestException("Shifts longer than 31 days are not allowed");
    }
    const u = await this.prisma.user.findFirst({ where: { id: input.userId, isSuperAdmin: true }, select: { id: true } });
    if (!u) throw new BadRequestException("Not a platform staff member");
    return this.prisma.platformShift.create({
      data: {
        userId: input.userId,
        teamId: input.teamId || null,
        kind: input.kind,
        startsAt,
        endsAt,
        note: input.note?.trim() || null,
      },
    });
  }

  async deleteShift(id: string) {
    await this.prisma.platformShift.delete({ where: { id } }).catch(() => {
      throw new NotFoundException("Shift not found");
    });
    return { ok: true };
  }

  async listRotations() {
    const rotations = await this.prisma.platformOnCallRotation.findMany({ orderBy: { createdAt: "asc" } });
    const teams = await this.prisma.platformTeam.findMany({
      where: { id: { in: rotations.map((r) => r.teamId) } },
      select: { id: true, name: true },
    });
    const teamMap = new Map(teams.map((t) => [t.id, t]));
    const names = await this.names(rotations.flatMap((r) => r.memberUserIds));
    const now = new Date();
    return rotations.map((r) => {
      const current = onCallUserId(r, now);
      return {
        ...r,
        team: teamMap.get(r.teamId) ?? null,
        members: r.memberUserIds.map((id) => ({ id, ...names.get(id) })),
        onCall: current ? { id: current, ...names.get(current) } : null,
        schedule: rotationSchedule(r, now, 6).map((s) => ({ ...s, user: names.get(s.userId) ?? null })),
      };
    });
  }

  async upsertRotation(
    id: string | null,
    input: { teamId?: string; name?: string; memberUserIds?: string[]; rotationDays?: number; startsAt?: string; isActive?: boolean },
  ) {
    if (input.memberUserIds) {
      const found = await this.prisma.user.count({
        where: { id: { in: input.memberUserIds }, isSuperAdmin: true, status: "active" },
      });
      if (found !== new Set(input.memberUserIds).size) {
        throw new BadRequestException("Every rotation member must be active platform staff");
      }
    }
    if (input.teamId) {
      const t = await this.prisma.platformTeam.findUnique({ where: { id: input.teamId }, select: { id: true } });
      if (!t) throw new BadRequestException("Team not found");
    }
    if (input.rotationDays !== undefined && (input.rotationDays < 1 || input.rotationDays > 31)) {
      throw new BadRequestException("Rotation length must be 1-31 days");
    }
    if (!id) {
      if (!input.teamId || !input.name || !input.startsAt) {
        throw new BadRequestException("Team, name and start are required");
      }
      return this.prisma.platformOnCallRotation.create({
        data: {
          teamId: input.teamId,
          name: input.name.trim(),
          memberUserIds: input.memberUserIds ?? [],
          rotationDays: input.rotationDays ?? 7,
          startsAt: new Date(input.startsAt),
          isActive: input.isActive ?? true,
        },
      });
    }
    return this.prisma.platformOnCallRotation.update({
      where: { id },
      data: {
        ...(input.teamId ? { teamId: input.teamId } : {}),
        ...(input.name ? { name: input.name.trim() } : {}),
        ...(input.memberUserIds ? { memberUserIds: input.memberUserIds } : {}),
        ...(input.rotationDays ? { rotationDays: input.rotationDays } : {}),
        ...(input.startsAt ? { startsAt: new Date(input.startsAt) } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });
  }

  async deleteRotation(id: string) {
    await this.prisma.platformOnCallRotation.delete({ where: { id } }).catch(() => {
      throw new NotFoundException("Rotation not found");
    });
    return { ok: true };
  }

  // ─── helpers ──────────────────────────────────────────────────────────────

  private toEmployee(e: Prisma.PlatformEmployeeGetPayload<{ include: typeof EMPLOYEE_INCLUDE }>) {
    return {
      id: e.id,
      userId: e.userId,
      employeeCode: e.employeeCode,
      name: e.user.name,
      email: e.user.email,
      phone: e.user.phone,
      avatarUrl: e.user.avatarUrl,
      accountStatus: e.user.status,
      primaryRole: e.user.platformRole,
      lastLoginAt: e.user.lastLoginAt,
      title: e.title,
      team: e.team,
      department: e.department,
      manager: e.manager
        ? { userId: e.manager.userId, employeeCode: e.manager.employeeCode, name: e.manager.user.name }
        : null,
      region: e.region,
      location: e.location,
      employmentStatus: e.employmentStatus,
      joinedAt: e.joinedAt,
      exitedAt: e.exitedAt,
    };
  }

  private async assertNoManagerCycle(employeeId: string, newManagerId: string) {
    let cursor: string | null = newManagerId;
    for (let depth = 0; cursor && depth < 100; depth++) {
      if (cursor === employeeId) throw new BadRequestException("That would create a reporting loop");
      const m: { managerId: string | null } | null = await this.prisma.platformEmployee.findUnique({
        where: { id: cursor },
        select: { managerId: true },
      });
      cursor = m?.managerId ?? null;
    }
  }

  private async names(ids: string[]) {
    const unique = [...new Set(ids)];
    if (!unique.length) return new Map<string, { name: string; employeeCode: string | null }>();
    const users = await this.prisma.user.findMany({
      where: { id: { in: unique } },
      select: { id: true, name: true, platformEmployee: { select: { employeeCode: true } } },
    });
    return new Map(users.map((u) => [u.id, { name: u.name, employeeCode: u.platformEmployee?.employeeCode ?? null }]));
  }
}

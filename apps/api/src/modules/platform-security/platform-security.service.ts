import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  type OnApplicationBootstrap,
} from "@nestjs/common";
import type { PlatformApprovalRequest, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { SessionTokensService } from "../auth/session-tokens.service";
import { PlatformApprovalsService } from "../platform-approvals/platform-approvals.service";
import { PlatformAccessService } from "../platform-iam/platform-access.service";
import type { EffectiveAccess } from "../platform-iam/platform-access.util";
import { PlatformNotificationsService } from "../platform-iam/platform-notifications.service";
import {
  buildReviewItems,
  campaignProgress,
  parsePrimaryAssignmentId,
  primaryAssignmentId,
  type ReviewSubject,
} from "./access-review.util";

export type SecurityActor = { sub: string; email?: string };

const MAX_ELEVATION_MINUTES = 8 * 60;

/** Access reviews, staff session management and just-in-time elevation. */
@Injectable()
export class PlatformSecurityService implements OnApplicationBootstrap {
  constructor(
    private prisma: PrismaService,
    private sessions: SessionTokensService,
    private access: PlatformAccessService,
    private approvals: PlatformApprovalsService,
    private notifications: PlatformNotificationsService,
  ) {}

  onApplicationBootstrap() {
    this.approvals.registerHook("iam.elevate", (req, outcome) => this.onElevationDecision(req, outcome));
  }

  // ─── Access reviews ───────────────────────────────────────────────────────

  async createCampaign(
    actor: SecurityActor,
    input: { name: string; dueAt: string; departmentId?: string; teamId?: string; includePrimaryRoles?: boolean },
  ) {
    const dueAt = new Date(input.dueAt);
    if (Number.isNaN(dueAt.getTime()) || dueAt <= new Date()) {
      throw new BadRequestException("Due date must be in the future");
    }
    const employeeFilter: Prisma.PlatformEmployeeWhereInput = {
      employmentStatus: { not: "exited" },
      ...(input.departmentId ? { departmentId: input.departmentId } : {}),
      ...(input.teamId ? { teamId: input.teamId } : {}),
    };
    const employees = await this.prisma.platformEmployee.findMany({
      where: { ...employeeFilter, user: { status: "active", isSuperAdmin: true } },
      select: {
        userId: true,
        manager: { select: { userId: true } },
        user: { select: { platformRole: true } },
      },
    });
    const byUser = new Map(employees.map((e) => [e.userId, e]));
    const assignments = await this.prisma.platformRoleAssignment.findMany({
      where: { userId: { in: [...byUser.keys()] }, revokedAt: null },
      include: { role: { select: { key: true } } },
    });
    const subjects: ReviewSubject[] = assignments.map((a) => ({
      assignmentId: a.id,
      userId: a.userId,
      roleKey: a.role.key,
      managerUserId: byUser.get(a.userId)?.manager?.userId ?? null,
    }));
    if (input.includePrimaryRoles ?? true) {
      for (const e of employees) {
        subjects.push({
          assignmentId: primaryAssignmentId(e.userId),
          userId: e.userId,
          roleKey: e.user.platformRole ?? "viewer",
          managerUserId: e.manager?.userId ?? null,
        });
      }
    }
    if (!subjects.length) throw new BadRequestException("Nobody in scope has access to review");

    const campaign = await this.prisma.platformAccessReviewCampaign.create({
      data: {
        name: input.name.trim(),
        dueAt,
        createdById: actor.sub,
        items: { create: buildReviewItems(subjects) },
      },
      include: { items: true },
    });
    const reviewers = [...new Set(campaign.items.map((i) => i.reviewerId).filter((x): x is string => Boolean(x)))];
    await this.notifications.notify(reviewers, {
      kind: "review.requested",
      title: `Access review "${campaign.name}" needs you`,
      body: `Certify or revoke your reports' access by ${dueAt.toDateString()}. Anything left unreviewed is revoked.`,
      link: `/access/reviews/${campaign.id}`,
      email: true,
    });
    return { ...campaign, items: undefined, progress: campaignProgress(campaign.items) };
  }

  async listCampaigns() {
    const campaigns = await this.prisma.platformAccessReviewCampaign.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { items: { select: { decision: true } } },
    });
    return campaigns.map((c) => ({ ...c, items: undefined, progress: campaignProgress(c.items) }));
  }

  async getCampaign(actor: SecurityActor, access: EffectiveAccess | undefined, id: string) {
    const c = await this.prisma.platformAccessReviewCampaign.findUnique({
      where: { id },
      include: { items: { orderBy: [{ decision: "asc" }, { userId: "asc" }] } },
    });
    if (!c) throw new NotFoundException("Campaign not found");
    const manager = this.canManage(access);
    const items = manager ? c.items : c.items.filter((i) => i.reviewerId === actor.sub);
    if (!manager && !items.length) throw new ForbiddenException("You have nothing to review in this campaign");
    const names = await this.names(items.flatMap((i) => [i.userId, i.reviewerId, i.decidedById]));
    const assignmentIds = items.map((i) => i.assignmentId).filter((id) => !parsePrimaryAssignmentId(id));
    const assignments = await this.prisma.platformRoleAssignment.findMany({
      where: { id: { in: assignmentIds } },
      select: { id: true, scopeType: true, scopeValues: true, expiresAt: true, reason: true, createdAt: true },
    });
    const aMap = new Map(assignments.map((a) => [a.id, a]));
    return {
      ...c,
      progress: campaignProgress(c.items),
      canManage: manager,
      items: items.map((i) => ({
        ...i,
        isPrimary: Boolean(parsePrimaryAssignmentId(i.assignmentId)),
        assignment: aMap.get(i.assignmentId) ?? null,
        user: names.get(i.userId) ?? null,
        reviewer: i.reviewerId ? (names.get(i.reviewerId) ?? null) : null,
        decidedBy: i.decidedById ? (names.get(i.decidedById) ?? null) : null,
      })),
    };
  }

  async myReviews(actor: SecurityActor) {
    const items = await this.prisma.platformAccessReviewItem.findMany({
      where: { reviewerId: actor.sub, decision: "pending", campaign: { status: "open" } },
      include: { campaign: { select: { id: true, name: true, dueAt: true } } },
      take: 500,
    });
    const byCampaign = new Map<string, { campaign: { id: string; name: string; dueAt: Date }; pending: number }>();
    for (const i of items) {
      const entry = byCampaign.get(i.campaignId) ?? { campaign: i.campaign, pending: 0 };
      entry.pending += 1;
      byCampaign.set(i.campaignId, entry);
    }
    return [...byCampaign.values()];
  }

  async decideItem(
    actor: SecurityActor,
    access: EffectiveAccess | undefined,
    itemId: string,
    decision: "certified" | "revoked",
    comment?: string,
  ) {
    const item = await this.prisma.platformAccessReviewItem.findUnique({
      where: { id: itemId },
      include: { campaign: true },
    });
    if (!item) throw new NotFoundException("Review item not found");
    if (item.campaign.status !== "open") throw new ConflictException("Campaign is closed");
    if (item.decision !== "pending") throw new ConflictException("Already decided");
    if (item.userId === actor.sub) throw new ForbiddenException("You cannot review your own access");
    if (item.reviewerId !== actor.sub && !this.canManage(access)) {
      throw new ForbiddenException("You are not the reviewer for this item");
    }
    if (decision === "revoked") await this.applyRevocation(actor, item.assignmentId, `Access review: ${item.campaign.name}`);
    return this.prisma.platformAccessReviewItem.update({
      where: { id: itemId },
      data: { decision, comment: comment?.trim() || null, decidedAt: new Date(), decidedById: actor.sub },
    });
  }

  /** Closing revokes everything still unreviewed. */
  async closeCampaign(actor: SecurityActor, id: string) {
    const c = await this.prisma.platformAccessReviewCampaign.findUnique({ where: { id }, include: { items: true } });
    if (!c) throw new NotFoundException("Campaign not found");
    if (c.status !== "open") throw new ConflictException("Campaign is already closed");
    const pending = c.items.filter((i) => i.decision === "pending");
    const now = new Date();
    for (const i of pending) {
      const applied = await this.applyRevocation(actor, i.assignmentId, `Unreviewed in "${c.name}"`);
      await this.prisma.platformAccessReviewItem.update({
        where: { id: i.id },
        data: {
          decision: "revoked",
          comment: applied ? "Auto-revoked: not reviewed before close" : "Not reviewed; kept (last active owner)",
          decidedAt: now,
          decidedById: actor.sub,
        },
      });
    }
    await this.prisma.platformAccessReviewCampaign.update({
      where: { id },
      data: { status: "closed", closedAt: now },
    });
    return { closed: true, autoRevoked: pending.length };
  }

  /** Returns false when revocation was skipped to keep the last active owner. */
  private async applyRevocation(actor: SecurityActor, assignmentId: string, reason: string): Promise<boolean> {
    const primaryUser = parsePrimaryAssignmentId(assignmentId);
    if (primaryUser) {
      const u = await this.prisma.user.findUnique({ where: { id: primaryUser }, select: { platformRole: true } });
      if (!u || u.platformRole === "viewer") return true;
      if (u.platformRole === "owner") {
        const others = await this.prisma.user.count({
          where: { isSuperAdmin: true, status: "active", platformRole: "owner", id: { not: primaryUser } },
        });
        if (others === 0) return false;
      }
      await this.prisma.user.update({ where: { id: primaryUser }, data: { platformRole: "viewer" } });
      await this.sessions.revokeAllForUser(primaryUser);
      this.access.invalidate(primaryUser);
      await this.notifications.notify([primaryUser], {
        kind: "access.revoked",
        title: "Your platform role was reduced to Viewer",
        body: reason,
      });
      return true;
    }
    const a = await this.prisma.platformRoleAssignment.findUnique({ where: { id: assignmentId } });
    if (!a || a.revokedAt) return true;
    await this.prisma.platformRoleAssignment.update({
      where: { id: assignmentId },
      data: { revokedAt: new Date(), revokedById: actor.sub },
    });
    this.access.invalidate(a.userId);
    return true;
  }

  // ─── Sessions ─────────────────────────────────────────────────────────────

  async listSessions(filter: { userId?: string }) {
    const sessions = await this.prisma.session.findMany({
      where: {
        revokedAt: null,
        expiresAt: { gt: new Date() },
        user: { isSuperAdmin: true },
        ...(filter.userId ? { userId: filter.userId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 500,
      select: {
        id: true,
        familyId: true,
        portal: true,
        userAgent: true,
        createdAt: true,
        lastUsedAt: true,
        expiresAt: true,
        user: {
          select: { id: true, name: true, email: true, platformEmployee: { select: { employeeCode: true } } },
        },
      },
    });
    return sessions.map((s) => ({
      ...s,
      user: { ...s.user, employeeCode: s.user.platformEmployee?.employeeCode ?? null, platformEmployee: undefined },
    }));
  }

  async revokeSession(actor: SecurityActor, id: string, onlyOwn: boolean) {
    const s = await this.prisma.session.findUnique({ where: { id }, select: { userId: true, familyId: true } });
    if (!s) throw new NotFoundException("Session not found");
    if (onlyOwn && s.userId !== actor.sub) throw new ForbiddenException("Not your session");
    await this.prisma.session.updateMany({
      where: { familyId: s.familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }

  async revokeAllForUser(actor: SecurityActor, userId: string) {
    const u = await this.prisma.user.findFirst({ where: { id: userId, isSuperAdmin: true }, select: { id: true } });
    if (!u) throw new NotFoundException("Staff member not found");
    await this.sessions.revokeAllForUser(userId);
    this.access.invalidate(userId);
    if (userId !== actor.sub) {
      await this.notifications.notify([userId], {
        kind: "sessions.revoked",
        title: "You were signed out of all devices by a security admin",
      });
    }
    return { ok: true };
  }

  // ─── Just-in-time elevation ───────────────────────────────────────────────

  async elevationRoles() {
    const roles = await this.prisma.platformRoleDef.findMany({
      where: { key: { not: "owner" } },
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
      select: { id: true, key: true, name: true, description: true, permissions: { select: { permission: true } } },
    });
    return roles.map((r) => ({ ...r, permissions: r.permissions.map((p) => p.permission) }));
  }

  async requestElevation(
    actor: SecurityActor,
    input: { roleId: string; durationMinutes: number; justification: string; ticketId?: string },
  ) {
    const role = await this.prisma.platformRoleDef.findUnique({ where: { id: input.roleId } });
    if (!role) throw new NotFoundException("Role not found");
    if (role.key === "owner") throw new ForbiddenException("Owner cannot be requested as an elevation");
    const minutes = Math.round(input.durationMinutes);
    if (minutes < 15 || minutes > MAX_ELEVATION_MINUTES) {
      throw new BadRequestException(`Duration must be 15-${MAX_ELEVATION_MINUTES} minutes`);
    }
    const policy = await this.approvals.activePolicy("iam.elevate");
    const summary = { userId: actor.sub, roleId: role.id, roleKey: role.key, durationMinutes: minutes };
    if (!policy) {
      const assignment = await this.grantElevation(summary, actor.sub, null, input.justification);
      return { status: "active", assignment };
    }
    const req = await this.approvals.createRequest({
      policy,
      title: `Temporary ${role.name} for ${minutes} min`,
      requestedBy: actor,
      justification: input.justification,
      summary,
      ticketId: input.ticketId ?? null,
    });
    return { status: "pending_approval", approvalRequest: { id: req.id, ref: req.ref } };
  }

  private async grantElevation(
    s: { userId: string; roleId: string; durationMinutes: number },
    grantedById: string,
    approvalRequestId: string | null,
    reason: string,
  ) {
    const a = await this.prisma.platformRoleAssignment.create({
      data: {
        userId: s.userId,
        roleId: s.roleId,
        scopeType: "global",
        expiresAt: new Date(Date.now() + s.durationMinutes * 60_000),
        grantedById,
        reason: `Elevation: ${reason}`.slice(0, 500),
        approvalRequestId,
      },
    });
    this.access.invalidate(s.userId);
    return a;
  }

  private async onElevationDecision(req: PlatformApprovalRequest, outcome: string) {
    if (outcome !== "approved") return;
    const summary = (req.payload as { summary?: { userId: string; roleId: string; durationMinutes: number } }).summary;
    if (!summary) return;
    const lastApprover = await this.prisma.platformApprovalDecision.findFirst({
      where: { requestId: req.id, decision: "approved" },
      orderBy: { createdAt: "desc" },
    });
    const a = await this.grantElevation(summary, lastApprover?.approverId ?? req.requestedById, req.id, req.justification);
    await this.approvals.markExecuted(req.id, { assignmentId: a.id, expiresAt: a.expiresAt });
    await this.notifications.notify([summary.userId], {
      kind: "elevation.active",
      title: "Your temporary access is active",
      body: `Expires ${a.expiresAt?.toISOString()}. Reload the page to see new sections.`,
    });
  }

  // ─── helpers ──────────────────────────────────────────────────────────────

  private canManage(access: EffectiveAccess | undefined) {
    return Boolean(access?.isOwner || access?.global.includes("access_reviews.manage"));
  }

  private async names(ids: (string | null | undefined)[]) {
    const unique = [...new Set(ids.filter((x): x is string => Boolean(x)))];
    if (!unique.length) return new Map<string, { id: string; name: string; email: string; employeeCode: string | null }>();
    const users = await this.prisma.user.findMany({
      where: { id: { in: unique } },
      select: { id: true, name: true, email: true, platformEmployee: { select: { employeeCode: true } } },
    });
    return new Map(
      users.map((u) => [u.id, { id: u.id, name: u.name, email: u.email, employeeCode: u.platformEmployee?.employeeCode ?? null }]),
    );
  }
}

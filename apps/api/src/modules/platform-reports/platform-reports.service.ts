import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  type OnApplicationBootstrap,
} from "@nestjs/common";
import type { PlatformApprovalRequest, PlatformJob, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { PlatformApprovalsService } from "../platform-approvals/platform-approvals.service";
import { PlatformAccessService } from "../platform-iam/platform-access.service";
import { orgWhereForGrants, type EffectiveAccess } from "../platform-iam/platform-access.util";
import { PlatformActivityService } from "../platform-iam/platform-activity.service";
import { PlatformNotificationsService } from "../platform-iam/platform-notifications.service";
import { SuperAdminService } from "../super-admin/super-admin.service";
import { averageHours, toCsv } from "./csv.util";

export type ReportsActor = { sub: string; email?: string };

export const EXPORT_KINDS = ["tenants", "tenant_users", "tickets", "activity"] as const;
export type ExportKind = (typeof EXPORT_KINDS)[number];
/** Exports carrying customer contact details always go through the reports.export policy. */
const PII_EXPORTS = new Set<ExportKind>(["tenants", "tenant_users", "activity"]);

export const BULK_ACTIONS = ["suspend", "reactivate"] as const;
export type BulkAction = (typeof BULK_ACTIONS)[number];

const MAX_EXPORT_ROWS = 50_000;
const MAX_BULK_TARGETS = 1_000;
const DAY_MS = 24 * 3600_000;

@Injectable()
export class PlatformReportsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PlatformReportsService.name);

  constructor(
    private prisma: PrismaService,
    private approvals: PlatformApprovalsService,
    private notifications: PlatformNotificationsService,
    private activity: PlatformActivityService,
    private access: PlatformAccessService,
    private superAdmin: SuperAdminService,
  ) {}

  async onApplicationBootstrap() {
    this.approvals.registerHook("reports.export", (r, o) => this.onJobDecision(r, o));
    this.approvals.registerHook("bulk.run", (r, o) => this.onJobDecision(r, o));
    if (process.env.NODE_ENV === "test") return;
    try {
      // Jobs interrupted by a restart cannot resume safely mid-way.
      await this.prisma.platformJob.updateMany({
        where: { status: "running" },
        data: { status: "failed", finishedAt: new Date(), errors: [{ message: "Interrupted by server restart" }] },
      });
      const queued = await this.prisma.platformJob.findMany({ where: { status: "queued" }, select: { id: true } });
      for (const j of queued) this.start(j.id);
    } catch (err) {
      this.logger.warn(`Job recovery skipped: ${(err as Error).message}`);
    }
  }

  // ─── Operations overview ──────────────────────────────────────────────────

  async overview() {
    const now = new Date();
    const since = new Date(now.getTime() - 30 * DAY_MS);
    const open = { in: ["open", "in_progress", "waiting_customer"] as ("open" | "in_progress" | "waiting_customer")[] };
    const [
      openByPriority,
      breached,
      resolved30,
      responded30,
      ticketsByTeam,
      ticketsByAssignee,
      approvalsPending,
      approvalsDecided,
      orgStatus,
      orgsNew30,
      staffByDept,
      grantsActive,
      grants30,
      activity24h,
    ] = await Promise.all([
      this.prisma.supportTicket.groupBy({ by: ["priority"], where: { status: open }, _count: { _all: true } }),
      this.prisma.supportTicket.count({ where: { status: open, slaDueAt: { lt: now } } }),
      this.prisma.supportTicket.findMany({
        where: { resolvedAt: { gte: since } },
        select: { createdAt: true, resolvedAt: true },
        take: 5000,
      }),
      this.prisma.supportTicket.findMany({
        where: { createdAt: { gte: since }, firstResponseAt: { not: null } },
        select: { createdAt: true, firstResponseAt: true },
        take: 5000,
      }),
      this.prisma.supportTicket.groupBy({ by: ["assigneeTeamId"], where: { status: open }, _count: { _all: true } }),
      this.prisma.supportTicket.groupBy({
        by: ["assigneeUserId"],
        where: { status: open },
        _count: { _all: true },
        orderBy: { _count: { assigneeUserId: "desc" } },
        take: 10,
      }),
      this.prisma.platformApprovalRequest.count({ where: { status: "pending" } }),
      this.prisma.platformApprovalRequest.findMany({
        where: { decidedAt: { gte: since } },
        select: { createdAt: true, decidedAt: true, status: true },
        take: 5000,
      }),
      this.prisma.organization.groupBy({ by: ["status"], where: { deletedAt: null }, _count: { _all: true } }),
      this.prisma.organization.count({ where: { createdAt: { gte: since }, deletedAt: null } }),
      this.prisma.platformEmployee.groupBy({
        by: ["departmentId"],
        where: { employmentStatus: { not: "exited" } },
        _count: { _all: true },
      }),
      this.prisma.tenantAccessGrant.count({ where: { status: "active", expiresAt: { gt: now } } }),
      this.prisma.tenantAccessGrant.groupBy({
        by: ["status"],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
      }),
      this.prisma.platformActivityLog.count({ where: { createdAt: { gte: new Date(now.getTime() - DAY_MS) } } }),
    ]);

    const [teams, depts, users] = await Promise.all([
      this.prisma.platformTeam.findMany({ select: { id: true, name: true } }),
      this.prisma.platformDepartment.findMany({ select: { id: true, name: true } }),
      this.prisma.user.findMany({
        where: { id: { in: ticketsByAssignee.map((t) => t.assigneeUserId).filter((x): x is string => Boolean(x)) } },
        select: { id: true, name: true },
      }),
    ]);
    const teamName = new Map(teams.map((t) => [t.id, t.name]));
    const deptName = new Map(depts.map((d) => [d.id, d.name]));
    const userName = new Map(users.map((u) => [u.id, u.name]));

    return {
      generatedAt: now,
      tickets: {
        openByPriority: Object.fromEntries(openByPriority.map((r) => [r.priority, r._count._all])),
        slaBreached: breached,
        resolvedLast30d: resolved30.length,
        avgResolutionHours: averageHours(resolved30.map((t) => ({ start: t.createdAt, end: t.resolvedAt }))),
        avgFirstResponseHours: averageHours(responded30.map((t) => ({ start: t.createdAt, end: t.firstResponseAt }))),
        byTeam: ticketsByTeam.map((r) => ({
          teamId: r.assigneeTeamId,
          team: r.assigneeTeamId ? (teamName.get(r.assigneeTeamId) ?? "Unknown") : "No team",
          open: r._count._all,
        })),
        byAssignee: ticketsByAssignee.map((r) => ({
          userId: r.assigneeUserId,
          name: r.assigneeUserId ? (userName.get(r.assigneeUserId) ?? "Unknown") : "Unassigned",
          open: r._count._all,
        })),
      },
      approvals: {
        pending: approvalsPending,
        decidedLast30d: approvalsDecided.length,
        rejectedLast30d: approvalsDecided.filter((a) => a.status === "rejected").length,
        avgTurnaroundHours: averageHours(approvalsDecided.map((a) => ({ start: a.createdAt, end: a.decidedAt }))),
      },
      tenants: {
        byStatus: Object.fromEntries(orgStatus.map((r) => [r.status, r._count._all])),
        newLast30d: orgsNew30,
      },
      staff: {
        byDepartment: staffByDept.map((r) => ({
          departmentId: r.departmentId,
          department: r.departmentId ? (deptName.get(r.departmentId) ?? "Unknown") : "Unassigned",
          count: r._count._all,
        })),
        actionsLast24h: activity24h,
      },
      tenantAccess: {
        active: grantsActive,
        last30dByStatus: Object.fromEntries(grants30.map((r) => [r.status, r._count._all])),
      },
    };
  }

  // ─── Saved views ──────────────────────────────────────────────────────────

  listViews(actor: ReportsActor, page: string) {
    return this.prisma.platformSavedView.findMany({
      where: { page, OR: [{ userId: actor.sub }, { isShared: true }] },
      orderBy: [{ isShared: "asc" }, { name: "asc" }],
    });
  }

  createView(actor: ReportsActor, input: { page: string; name: string; filters: Record<string, unknown>; isShared?: boolean }) {
    return this.prisma.platformSavedView.create({
      data: {
        userId: actor.sub,
        page: input.page.trim(),
        name: input.name.trim(),
        filters: input.filters as Prisma.InputJsonValue,
        isShared: input.isShared ?? false,
      },
    });
  }

  async deleteView(actor: ReportsActor, id: string, isOwner: boolean) {
    const v = await this.prisma.platformSavedView.findUnique({ where: { id } });
    if (!v) throw new NotFoundException("View not found");
    if (v.userId !== actor.sub && !isOwner) throw new ForbiddenException("Not your view");
    await this.prisma.platformSavedView.delete({ where: { id } });
    return { ok: true };
  }

  // ─── Jobs: exports and bulk actions ───────────────────────────────────────

  async createExport(
    actor: ReportsActor,
    access: EffectiveAccess | undefined,
    input: { exportKind: ExportKind; filters?: Record<string, unknown>; justification?: string },
  ) {
    if (!EXPORT_KINDS.includes(input.exportKind)) throw new BadRequestException("Unknown export");
    if (input.exportKind === "activity" && !access?.global.includes("activity.export")) {
      throw new ForbiddenException("Exporting the activity log needs activity.export");
    }
    const params = { filters: input.filters ?? {}, scope: this.scopeOf(access, "tenants.read") };
    const policy = PII_EXPORTS.has(input.exportKind) ? await this.approvals.activePolicy("reports.export") : null;
    return this.createJob(actor, {
      kind: "export",
      action: input.exportKind,
      params,
      policyKey: policy ? "reports.export" : null,
      title: `Export ${input.exportKind.replace("_", " ")}`,
      justification: input.justification,
    });
  }

  async createBulk(
    actor: ReportsActor,
    access: EffectiveAccess | undefined,
    input: { action: BulkAction; organizationIds: string[]; reason: string; justification?: string },
  ) {
    if (!BULK_ACTIONS.includes(input.action)) throw new BadRequestException("Unknown bulk action");
    const ids = [...new Set(input.organizationIds)];
    if (!ids.length || ids.length > MAX_BULK_TARGETS) {
      throw new BadRequestException(`Pick 1-${MAX_BULK_TARGETS} tenants`);
    }
    if (!access?.global.includes("tenants.suspend")) {
      throw new ForbiddenException("Bulk suspend / reactivate needs tenants.suspend");
    }
    const found = await this.prisma.organization.count({ where: { id: { in: ids }, deletedAt: null } });
    if (found !== ids.length) throw new BadRequestException("Some tenants were not found");
    const policy = await this.approvals.activePolicy("bulk.run");
    return this.createJob(actor, {
      kind: "bulk_action",
      action: input.action,
      params: { organizationIds: ids, reason: input.reason.trim() },
      policyKey: policy ? "bulk.run" : null,
      title: `Bulk ${input.action} of ${ids.length} tenant(s)`,
      justification: input.justification ?? input.reason,
      total: ids.length,
    });
  }

  private async createJob(
    actor: ReportsActor,
    input: {
      kind: "export" | "bulk_action";
      action: string;
      params: Record<string, unknown>;
      policyKey: string | null;
      title: string;
      justification?: string;
      total?: number;
    },
  ) {
    const policy = input.policyKey ? await this.approvals.activePolicy(input.policyKey) : null;
    if (policy && (input.justification ?? "").trim().length < 8) {
      throw new BadRequestException({
        code: "APPROVAL_JUSTIFICATION_REQUIRED",
        message: "This job needs approval. Add a justification (min 8 characters).",
      });
    }
    const job = await this.prisma.platformJob.create({
      data: {
        kind: input.kind,
        action: input.action,
        params: input.params as Prisma.InputJsonValue,
        status: policy ? "pending_approval" : "queued",
        total: input.total ?? 0,
        createdById: actor.sub,
      },
    });
    if (!policy) {
      this.start(job.id);
      return job;
    }
    const approval = await this.approvals.createRequest({
      policy,
      title: input.title,
      requestedBy: actor,
      justification: input.justification ?? "",
      summary: { jobId: job.id, kind: input.kind, action: input.action, params: input.params },
    });
    return this.prisma.platformJob.update({
      where: { id: job.id },
      data: { approvalRequestId: approval.id },
    });
  }

  async listJobs(actor: ReportsActor, isOwner: boolean) {
    return this.prisma.platformJob.findMany({
      where: isOwner ? {} : { createdById: actor.sub },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        kind: true,
        action: true,
        status: true,
        total: true,
        processed: true,
        failed: true,
        errors: true,
        approvalRequestId: true,
        createdById: true,
        createdAt: true,
        startedAt: true,
        finishedAt: true,
      },
    });
  }

  async download(actor: ReportsActor, id: string) {
    const job = await this.prisma.platformJob.findUnique({ where: { id } });
    if (!job) throw new NotFoundException("Job not found");
    if (job.createdById !== actor.sub) throw new ForbiddenException("Only the requester can download");
    if (job.kind !== "export" || job.status !== "completed" || !job.resultCsv) {
      throw new ConflictException("Export is not ready");
    }
    return { filename: `${job.action}-${job.createdAt.toISOString().slice(0, 10)}.csv`, csv: job.resultCsv };
  }

  async cancel(actor: ReportsActor, id: string) {
    const job = await this.prisma.platformJob.findUnique({ where: { id } });
    if (!job) throw new NotFoundException("Job not found");
    if (job.createdById !== actor.sub) throw new ForbiddenException("Only the requester can cancel");
    const res = await this.prisma.platformJob.updateMany({
      where: { id, status: { in: ["pending_approval", "queued", "running"] } },
      data: { status: "cancelled", finishedAt: new Date() },
    });
    if (!res.count) throw new ConflictException(`Job is ${job.status}`);
    return { ok: true };
  }

  private async onJobDecision(req: PlatformApprovalRequest, outcome: string) {
    const jobId = (req.payload as { summary?: { jobId?: string } }).summary?.jobId;
    if (!jobId) return;
    if (outcome === "approved") {
      const res = await this.prisma.platformJob.updateMany({
        where: { id: jobId, status: "pending_approval" },
        data: { status: "queued" },
      });
      if (res.count) {
        await this.approvals.markExecuted(req.id, { jobId });
        this.start(jobId);
      }
      return;
    }
    await this.prisma.platformJob.updateMany({
      where: { id: jobId, status: "pending_approval" },
      data: { status: "cancelled", finishedAt: new Date() },
    });
  }

  private start(jobId: string) {
    setImmediate(() => {
      this.run(jobId).catch((err: Error) => this.logger.error(`Job ${jobId} crashed: ${err.message}`));
    });
  }

  private async run(jobId: string) {
    const claimed = await this.prisma.platformJob.updateMany({
      where: { id: jobId, status: "queued" },
      data: { status: "running", startedAt: new Date() },
    });
    if (!claimed.count) return;
    const job = await this.prisma.platformJob.findUniqueOrThrow({ where: { id: jobId } });
    try {
      if (job.kind === "export") await this.runExport(job);
      else await this.runBulk(job);
    } catch (err) {
      await this.prisma.platformJob.update({
        where: { id: jobId },
        data: { status: "failed", finishedAt: new Date(), errors: [{ message: (err as Error).message }] },
      });
    }
    const done = await this.prisma.platformJob.findUniqueOrThrow({ where: { id: jobId } });
    await this.notifications.notify([done.createdById], {
      kind: `job.${done.status}`,
      title: `${done.kind === "export" ? "Export" : "Bulk job"} ${done.action} ${done.status}`,
      link: "/reports/jobs",
    });
  }

  private async runExport(job: PlatformJob) {
    const params = job.params as { filters?: Record<string, string>; scope?: unknown };
    const filters = params.filters ?? {};
    const scopeWhere = Array.isArray(params.scope) && params.scope.length
      ? (orgWhereForGrants(params.scope as never) as Prisma.OrganizationWhereInput)
      : {};
    let csv: string;
    let count: number;
    if (job.action === "tenants") {
      const orgs = await this.prisma.organization.findMany({
        where: {
          deletedAt: null,
          ...(filters.status ? { status: filters.status as never } : {}),
          ...scopeWhere,
        },
        orderBy: { createdAt: "desc" },
        take: MAX_EXPORT_ROWS,
        include: { subscriptions: { include: { plan: true }, orderBy: { createdAt: "desc" }, take: 1 } },
      });
      count = orgs.length;
      csv = toCsv(
        ["id", "name", "slug", "status", "email", "phone", "city", "state", "plan", "created_at"],
        orgs.map((o) => [o.id, o.name, o.slug, o.status, o.email, o.phone, o.city, o.state, o.subscriptions[0]?.plan.name, o.createdAt]),
      );
    } else if (job.action === "tenant_users") {
      const users = await this.prisma.user.findMany({
        where: {
          isSuperAdmin: false,
          ...(filters.organizationId ? { organizationId: filters.organizationId } : {}),
          ...(Object.keys(scopeWhere).length ? { organization: scopeWhere } : {}),
        },
        take: MAX_EXPORT_ROWS,
        orderBy: { createdAt: "desc" },
        include: { organization: { select: { name: true } } },
      });
      count = users.length;
      csv = toCsv(
        ["id", "organization", "name", "email", "phone", "status", "last_login_at", "created_at"],
        users.map((u) => [u.id, u.organization.name, u.name, u.email, u.phone, u.status, u.lastLoginAt, u.createdAt]),
      );
    } else if (job.action === "tickets") {
      const tickets = await this.prisma.supportTicket.findMany({
        where: filters.status ? { status: filters.status as never } : {},
        take: MAX_EXPORT_ROWS,
        orderBy: { seq: "desc" },
      });
      count = tickets.length;
      csv = toCsv(
        ["ref", "subject", "status", "priority", "category", "organization_id", "assignee_user_id", "sla_due_at", "first_response_at", "resolved_at", "created_at"],
        tickets.map((t) => [
          `TKT-${String(t.seq).padStart(6, "0")}`,
          t.subject,
          t.status,
          t.priority,
          t.category,
          t.organizationId,
          t.assigneeUserId,
          t.slaDueAt,
          t.firstResponseAt,
          t.resolvedAt,
          t.createdAt,
        ]),
      );
    } else {
      csv = await this.activity.exportCsv(filters, MAX_EXPORT_ROWS);
      count = Math.max(0, csv.split("\n").length - 1);
    }
    await this.prisma.platformJob.update({
      where: { id: job.id },
      data: { status: "completed", total: count, processed: count, resultCsv: csv, finishedAt: new Date() },
    });
  }

  private async runBulk(job: PlatformJob) {
    const params = job.params as { organizationIds: string[]; reason: string };
    const errors: { organizationId: string; message: string }[] = [];
    const actor = await this.access.identity(job.createdById);
    let processed = 0;
    for (const orgId of params.organizationIds) {
      const current = await this.prisma.platformJob.findUnique({ where: { id: job.id }, select: { status: true } });
      if (current?.status === "cancelled") return;
      try {
        if (job.action === "suspend") await this.superAdmin.suspendTenant(orgId, params.reason, job.createdById);
        else await this.superAdmin.reactivateTenant(orgId, job.createdById);
        await this.activity.record({
          userId: job.createdById,
          employeeCode: actor?.employeeCode ?? null,
          actorEmail: actor?.email ?? null,
          action: `bulk.${job.action}`,
          resourceType: "organizations",
          resourceId: orgId,
          targetOrgId: orgId,
          approvalRequestId: job.approvalRequestId,
          metadata: { jobId: job.id, reason: params.reason },
        });
      } catch (err) {
        errors.push({ organizationId: orgId, message: (err as Error).message });
      }
      processed += 1;
      if (processed % 10 === 0 || processed === params.organizationIds.length) {
        await this.prisma.platformJob.update({
          where: { id: job.id },
          data: { processed, failed: errors.length, errors: errors.slice(0, 200) },
        });
      }
    }
    await this.prisma.platformJob.update({
      where: { id: job.id },
      data: {
        status: errors.length === params.organizationIds.length ? "failed" : "completed",
        processed,
        failed: errors.length,
        errors: errors.slice(0, 200),
        finishedAt: new Date(),
      },
    });
  }

  private scopeOf(access: EffectiveAccess | undefined, permission: string) {
    if (!access || access.global.includes(permission)) return null;
    return access.scoped.filter((g) => g.permissions.includes(permission));
  }
}

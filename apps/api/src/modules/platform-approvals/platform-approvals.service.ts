import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import type { Prisma, PlatformApprovalPolicy, PlatformApprovalRequest } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { decryptSecret, encryptSecret, encryptionKeyConfigured } from "../platform-config/crypto.util";
import { PlatformAccessService } from "../platform-iam/platform-access.service";
import { redactForLog } from "../platform-iam/platform-activity.util";
import { PlatformNotificationsService } from "../platform-iam/platform-notifications.service";
import {
  conditionsMatch,
  decisionBlocker,
  formatApprovalRef,
  parseConditions,
  payloadHash,
  statusAfterDecisions,
  type PolicyCondition,
  type ReplayPayload,
} from "./approval.util";
import { DEFAULT_APPROVAL_POLICIES } from "./default-policies";

const POLICY_CACHE_MS = 30_000;

export type ApprovalActor = { sub: string; email?: string };

/** Runs when a domain approval (not an HTTP replay) is approved or rejected. */
export type DecisionHook = (
  request: PlatformApprovalRequest,
  outcome: "approved" | "rejected" | "expired" | "cancelled",
) => Promise<void>;

type FactsResolver = (input: { body: unknown; query: Record<string, unknown>; params: Record<string, string> }) =>
  Promise<Record<string, unknown>>;

export type PolicyInput = {
  name?: string;
  description?: string | null;
  requiredApprovals?: number;
  approverRoleKeys?: string[];
  approverTeamIds?: string[];
  blockSelfApproval?: boolean;
  expiryHours?: number;
  conditions?: PolicyCondition[] | null;
  isActive?: boolean;
};

@Injectable()
export class PlatformApprovalsService {
  private readonly logger = new Logger(PlatformApprovalsService.name);
  private policyCache = new Map<string, { policy: PlatformApprovalPolicy | null; expiresAt: number }>();
  private hooks = new Map<string, DecisionHook>();
  private factsResolvers = new Map<string, FactsResolver>();

  constructor(
    private prisma: PrismaService,
    private access: PlatformAccessService,
    private notifications: PlatformNotificationsService,
  ) {}

  /** Domain modules (tenant access, bulk jobs) react to decisions on their action keys. */
  registerHook(actionKeyPrefix: string, hook: DecisionHook) {
    this.hooks.set(actionKeyPrefix, hook);
  }

  /** Extra facts a policy condition can use, e.g. the max risk of a role being granted. */
  registerFacts(actionKey: string, resolver: FactsResolver) {
    this.factsResolvers.set(actionKey, resolver);
  }

  async seedDefaults() {
    for (const p of DEFAULT_APPROVAL_POLICIES) {
      await this.prisma.platformApprovalPolicy.upsert({
        where: { actionKey: p.actionKey },
        create: {
          actionKey: p.actionKey,
          name: p.name,
          description: p.description,
          requiredApprovals: p.requiredApprovals,
          approverRoleKeys: p.approverRoleKeys,
          expiryHours: p.expiryHours,
          isActive: p.isActive,
          conditions: (p.conditions ?? undefined) as Prisma.InputJsonValue | undefined,
        },
        update: {},
      });
    }
  }

  // ─── Policies ─────────────────────────────────────────────────────────────

  listPolicies() {
    return this.prisma.platformApprovalPolicy.findMany({ orderBy: { actionKey: "asc" } });
  }

  async updatePolicy(id: string, input: PolicyInput) {
    const existing = await this.prisma.platformApprovalPolicy.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Policy not found");
    if (input.requiredApprovals !== undefined && (input.requiredApprovals < 1 || input.requiredApprovals > 5)) {
      throw new BadRequestException("Required approvals must be 1-5");
    }
    if (input.expiryHours !== undefined && (input.expiryHours < 1 || input.expiryHours > 24 * 30)) {
      throw new BadRequestException("Expiry must be between 1 hour and 30 days");
    }
    const updated = await this.prisma.platformApprovalPolicy.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
        ...(input.requiredApprovals !== undefined ? { requiredApprovals: input.requiredApprovals } : {}),
        ...(input.approverRoleKeys !== undefined ? { approverRoleKeys: input.approverRoleKeys } : {}),
        ...(input.approverTeamIds !== undefined ? { approverTeamIds: input.approverTeamIds } : {}),
        ...(input.blockSelfApproval !== undefined ? { blockSelfApproval: input.blockSelfApproval } : {}),
        ...(input.expiryHours !== undefined ? { expiryHours: input.expiryHours } : {}),
        ...(input.conditions !== undefined
          ? { conditions: (parseConditions(input.conditions) as Prisma.InputJsonValue) ?? undefined }
          : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });
    this.policyCache.delete(existing.actionKey);
    return updated;
  }

  async activePolicy(actionKey: string): Promise<PlatformApprovalPolicy | null> {
    const hit = this.policyCache.get(actionKey);
    if (hit && hit.expiresAt > Date.now()) return hit.policy;
    const policy = await this.prisma.platformApprovalPolicy.findUnique({ where: { actionKey } });
    const active = policy?.isActive ? policy : null;
    this.policyCache.set(actionKey, { policy: active, expiresAt: Date.now() + POLICY_CACHE_MS });
    return active;
  }

  /** The active policy if it applies to this request's facts, else null (no approval needed). */
  async policyFor(
    actionKey: string,
    input: { body: unknown; query: Record<string, unknown>; params: Record<string, string> },
  ) {
    const policy = await this.activePolicy(actionKey);
    if (!policy) return null;
    const conditions = parseConditions(policy.conditions);
    if (!conditions.length) return policy;
    const resolver = this.factsResolvers.get(actionKey);
    const extra = resolver ? await resolver(input) : {};
    const facts = {
      ...(input.body && typeof input.body === "object" ? (input.body as Record<string, unknown>) : {}),
      ...input.query,
      ...input.params,
      ...extra,
    };
    return conditionsMatch(conditions, facts) ? policy : null;
  }

  // ─── Requests ─────────────────────────────────────────────────────────────

  async createRequest(input: {
    policy: PlatformApprovalPolicy;
    title: string;
    requestedBy: ApprovalActor;
    justification: string;
    replay?: ReplayPayload;
    sensitiveBody?: boolean;
    summary?: Record<string, unknown>;
    ticketId?: string | null;
    targetOrgId?: string | null;
  }) {
    const justification = input.justification.trim();
    if (justification.length < 8) {
      throw new BadRequestException({
        code: "APPROVAL_JUSTIFICATION_REQUIRED",
        message: "This action needs approval. Add a justification (min 8 characters).",
      });
    }
    const replay = input.replay;
    let bodyEnc: string | null = null;
    if (replay && input.sensitiveBody && replay.body !== undefined) {
      if (!encryptionKeyConfigured()) {
        throw new BadRequestException("ENCRYPTION_KEY must be set to route secret changes through approval");
      }
      bodyEnc = encryptSecret(JSON.stringify(replay.body));
    }
    const payload = {
      ...(replay
        ? {
            method: replay.method,
            path: replay.path,
            query: replay.query,
            body: input.sensitiveBody ? undefined : replay.body,
            bodyPreview: redactForLog(replay.body),
            sensitive: Boolean(input.sensitiveBody),
          }
        : {}),
      ...(input.summary ? { summary: input.summary } : {}),
    };
    const created = await this.prisma.platformApprovalRequest.create({
      data: {
        actionKey: input.policy.actionKey,
        policyId: input.policy.id,
        title: input.title.slice(0, 200),
        payload: payload as Prisma.InputJsonValue,
        bodyEnc,
        payloadHash: replay ? payloadHash(replay) : payloadHash({ method: "DOMAIN", path: input.policy.actionKey, query: {}, body: input.summary ?? {} }),
        justification: justification.slice(0, 2000),
        ticketId: input.ticketId ?? null,
        targetOrgId: input.targetOrgId ?? null,
        requestedById: input.requestedBy.sub,
        requiredApprovals: input.policy.requiredApprovals,
        approverRoleKeys: input.policy.approverRoleKeys,
        approverTeamIds: input.policy.approverTeamIds,
        blockSelfApproval: input.policy.blockSelfApproval,
        expiresAt: new Date(Date.now() + input.policy.expiryHours * 3600_000),
      },
    });
    const approvers = (await this.eligibleApprovers(created)).filter(
      (id) => !(created.blockSelfApproval && id === created.requestedById),
    );
    await this.notifications.notify(approvers, {
      kind: "approval.requested",
      title: `${formatApprovalRef(created.seq)} needs your approval: ${created.title}`,
      body: `${input.requestedBy.email ?? "A teammate"} wrote: ${justification.slice(0, 300)}`,
      link: `/approvals/${created.id}`,
      email: true,
    });
    return this.toDto(created);
  }

  async eligibleApprovers(req: Pick<PlatformApprovalRequest, "approverRoleKeys" | "approverTeamIds">) {
    const roleKeys = req.approverRoleKeys.length || req.approverTeamIds.length ? req.approverRoleKeys : ["owner"];
    const [byRole, byTeam, owners] = await Promise.all([
      this.access.userIdsWithRoles(roleKeys),
      req.approverTeamIds.length
        ? this.prisma.platformEmployee.findMany({
            where: { teamId: { in: req.approverTeamIds }, user: { status: "active", isSuperAdmin: true } },
            select: { userId: true },
          })
        : Promise.resolve([]),
      // Owners can always act as approvers of last resort.
      this.access.userIdsWithRoles(["owner"]),
    ]);
    return [...new Set([...byRole, ...byTeam.map((e) => e.userId), ...owners])];
  }

  async expireStale() {
    const stale = await this.prisma.platformApprovalRequest.findMany({
      where: { status: { in: ["pending", "approved"] }, expiresAt: { lt: new Date() } },
      take: 200,
    });
    for (const r of stale) {
      const res = await this.prisma.platformApprovalRequest.updateMany({
        where: { id: r.id, status: r.status },
        data: { status: "expired" },
      });
      if (res.count) await this.runHook(r, "expired");
    }
  }

  async list(
    actor: ApprovalActor,
    filter: { box: "mine" | "pending_for_me" | "all"; status?: string; actionKey?: string; cursor?: string; limit?: number },
    canSeeAll: boolean,
  ) {
    await this.expireStale();
    const limit = Math.min(Math.max(filter.limit ?? 50, 1), 100);
    const where: Prisma.PlatformApprovalRequestWhereInput = {
      ...(filter.status ? { status: filter.status as never } : {}),
      ...(filter.actionKey ? { actionKey: filter.actionKey } : {}),
    };
    if (filter.box === "mine") where.requestedById = actor.sub;
    if (filter.box === "all" && !canSeeAll) throw new ForbiddenException("You can only see your own requests");
    if (filter.box === "pending_for_me") {
      where.status = "pending";
      where.decisions = { none: { approverId: actor.sub } };
    }
    if (filter.cursor && /^\d+$/.test(filter.cursor)) where.seq = { lt: Number(filter.cursor) };

    const rows = await this.prisma.platformApprovalRequest.findMany({
      where,
      orderBy: { seq: "desc" },
      take: filter.box === "pending_for_me" ? 500 : limit + 1,
      include: { decisions: true },
    });

    let page = rows;
    if (filter.box === "pending_for_me") {
      const eligible: typeof rows = [];
      for (const r of rows) {
        if (r.blockSelfApproval && r.requestedById === actor.sub) continue;
        const ids = new Set(await this.eligibleApprovers(r));
        if (ids.has(actor.sub)) eligible.push(r);
        if (eligible.length > limit) break;
      }
      page = eligible;
    }
    const hasMore = page.length > limit;
    page = page.slice(0, limit);
    const names = await this.userNames(page.flatMap((r) => [r.requestedById, ...r.decisions.map((d) => d.approverId)]));
    return {
      data: page.map((r) => this.toDto(r, names)),
      nextCursor: hasMore ? String(page[page.length - 1].seq) : null,
    };
  }

  async pendingCountFor(actor: ApprovalActor) {
    const res = await this.list(actor, { box: "pending_for_me", limit: 99 }, false);
    return { count: res.data.length };
  }

  async get(actor: ApprovalActor, id: string, canSeeAll: boolean) {
    const r = await this.prisma.platformApprovalRequest.findUnique({
      where: { id },
      include: { decisions: { orderBy: { createdAt: "asc" } } },
    });
    if (!r) throw new NotFoundException("Approval request not found");
    const approvers = await this.eligibleApprovers(r);
    const involved = r.requestedById === actor.sub || approvers.includes(actor.sub);
    if (!involved && !canSeeAll) throw new ForbiddenException("Not your approval request");
    const names = await this.userNames([r.requestedById, ...r.decisions.map((d) => d.approverId), ...approvers]);
    const blocker =
      r.status === "pending"
        ? decisionBlocker({
            approverId: actor.sub,
            requestedById: r.requestedById,
            blockSelfApproval: r.blockSelfApproval,
            eligibleApproverIds: new Set(approvers),
            alreadyDecided: r.decisions.some((d) => d.approverId === actor.sub),
          })
        : "Request is no longer pending";
    return {
      ...this.toDto(r, names),
      approvers: approvers.map((uid) => ({ id: uid, ...names.get(uid) })),
      canDecide: blocker === null,
      decideBlocker: blocker,
      canExecute:
        r.status === "approved" && r.requestedById === actor.sub && Boolean((r.payload as { path?: string })?.path),
    };
  }

  async decide(actor: ApprovalActor, id: string, decision: "approved" | "rejected", comment?: string) {
    await this.expireStale();
    const r = await this.prisma.platformApprovalRequest.findUnique({
      where: { id },
      include: { decisions: true },
    });
    if (!r) throw new NotFoundException("Approval request not found");
    if (r.status !== "pending") throw new ConflictException(`Request is ${r.status}`);
    if (decision === "rejected" && !comment?.trim()) {
      throw new BadRequestException("Add a comment explaining the rejection");
    }
    const blocker = decisionBlocker({
      approverId: actor.sub,
      requestedById: r.requestedById,
      blockSelfApproval: r.blockSelfApproval,
      eligibleApproverIds: new Set(await this.eligibleApprovers(r)),
      alreadyDecided: r.decisions.some((d) => d.approverId === actor.sub),
    });
    if (blocker) throw new ForbiddenException(blocker);

    await this.prisma.platformApprovalDecision.create({
      data: { requestId: id, approverId: actor.sub, decision, comment: comment?.trim() || null },
    });
    const decisions = await this.prisma.platformApprovalDecision.findMany({ where: { requestId: id } });
    const next = statusAfterDecisions(decisions, r.requiredApprovals);
    if (next !== "pending") {
      const res = await this.prisma.platformApprovalRequest.updateMany({
        where: { id, status: "pending" },
        data: { status: next, decidedAt: new Date() },
      });
      if (res.count) {
        const updated = await this.prisma.platformApprovalRequest.findUniqueOrThrow({ where: { id } });
        await this.notifications.notify([r.requestedById], {
          kind: `approval.${next}`,
          title: `${formatApprovalRef(r.seq)} ${next}: ${r.title}`,
          body:
            next === "approved"
              ? (updated.payload as { path?: string })?.path
                ? "Approved. Open the request and press Execute to run it."
                : "Approved. It has been applied."
              : `Rejected: ${comment ?? ""}`,
          link: `/approvals/${id}`,
          email: true,
        });
        await this.runHook(updated, next);
      }
    }
    return this.get(actor, id, true);
  }

  async cancel(actor: ApprovalActor, id: string) {
    const r = await this.prisma.platformApprovalRequest.findUnique({ where: { id } });
    if (!r) throw new NotFoundException("Approval request not found");
    if (r.requestedById !== actor.sub) throw new ForbiddenException("Only the requester can cancel");
    const res = await this.prisma.platformApprovalRequest.updateMany({
      where: { id, status: { in: ["pending", "approved"] } },
      data: { status: "cancelled" },
    });
    if (!res.count) throw new ConflictException(`Request is ${r.status}`);
    await this.runHook({ ...r, status: "cancelled" }, "cancelled");
    return { ok: true };
  }

  /** Method, path and body the requester replays with X-Approval-Id to execute. */
  async replay(actor: ApprovalActor, id: string) {
    const r = await this.prisma.platformApprovalRequest.findUnique({ where: { id } });
    if (!r) throw new NotFoundException("Approval request not found");
    if (r.requestedById !== actor.sub) throw new ForbiddenException("Only the requester can execute");
    if (r.status !== "approved") throw new ConflictException(`Request is ${r.status}`);
    const p = r.payload as { method?: string; path?: string; query?: Record<string, unknown>; body?: unknown };
    if (!p.path || !p.method) throw new BadRequestException("This approval is applied automatically");
    const body = r.bodyEnc ? JSON.parse(decryptSecret(r.bodyEnc)) : p.body;
    return { method: p.method, path: p.path, query: p.query ?? {}, body };
  }

  /**
   * Atomically moves an approved request to `executing` when the replayed request is
   * byte-for-byte the approved one, so it can only ever run once.
   */
  async claimForExecution(actor: ApprovalActor, id: string, actionKey: string, hash: string) {
    await this.expireStale();
    const res = await this.prisma.platformApprovalRequest.updateMany({
      where: {
        id,
        actionKey,
        status: "approved",
        requestedById: actor.sub,
        payloadHash: hash,
        expiresAt: { gt: new Date() },
      },
      data: { status: "executing" },
    });
    if (res.count !== 1) {
      const r = await this.prisma.platformApprovalRequest.findUnique({ where: { id } });
      if (!r) throw new NotFoundException("Approval request not found");
      if (r.requestedById !== actor.sub) throw new ForbiddenException("Only the requester can execute");
      if (r.actionKey !== actionKey || r.payloadHash !== hash) {
        throw new ForbiddenException("This request differs from what was approved");
      }
      throw new ConflictException(`Approval is ${r.status}`);
    }
    return this.prisma.platformApprovalRequest.findUniqueOrThrow({ where: { id } });
  }

  async completeExecution(id: string, ok: boolean, result: unknown) {
    await this.prisma.platformApprovalRequest.update({
      where: { id },
      data: ok
        ? { status: "executed", executedAt: new Date(), executionResult: redactForLog(result) as Prisma.InputJsonValue }
        : { status: "approved", executionResult: { error: String((result as Error)?.message ?? result) } },
    });
  }

  /** Domain approvals apply immediately on approval and are marked executed. */
  async markExecuted(id: string, result: unknown) {
    await this.prisma.platformApprovalRequest.update({
      where: { id },
      data: { status: "executed", executedAt: new Date(), executionResult: redactForLog(result) as Prisma.InputJsonValue },
    });
  }

  private async runHook(r: PlatformApprovalRequest, outcome: "approved" | "rejected" | "expired" | "cancelled") {
    for (const [prefix, hook] of this.hooks) {
      if (!r.actionKey.startsWith(prefix)) continue;
      try {
        await hook(r, outcome);
      } catch (err) {
        this.logger.error(`Approval hook ${prefix} failed for ${r.id}: ${(err as Error).message}`);
      }
    }
  }

  private async userNames(ids: string[]) {
    const unique = [...new Set(ids.filter(Boolean))];
    const users = await this.prisma.user.findMany({
      where: { id: { in: unique } },
      select: { id: true, name: true, email: true, platformEmployee: { select: { employeeCode: true } } },
    });
    return new Map(
      users.map((u) => [u.id, { name: u.name, email: u.email, employeeCode: u.platformEmployee?.employeeCode ?? null }]),
    );
  }

  private toDto(
    r: PlatformApprovalRequest & { decisions?: { approverId: string; decision: string; comment: string | null; createdAt: Date }[] },
    names?: Map<string, { name: string; email: string; employeeCode: string | null }>,
  ) {
    return {
      id: r.id,
      ref: formatApprovalRef(r.seq),
      seq: r.seq,
      actionKey: r.actionKey,
      status: r.status,
      title: r.title,
      payload: r.payload,
      justification: r.justification,
      ticketId: r.ticketId,
      targetOrgId: r.targetOrgId,
      requestedBy: { id: r.requestedById, ...names?.get(r.requestedById) },
      requiredApprovals: r.requiredApprovals,
      approverRoleKeys: r.approverRoleKeys,
      expiresAt: r.expiresAt,
      decidedAt: r.decidedAt,
      executedAt: r.executedAt,
      executionResult: r.executionResult,
      createdAt: r.createdAt,
      decisions: (r.decisions ?? []).map((d) => ({
        approverId: d.approverId,
        approver: names?.get(d.approverId) ?? null,
        decision: d.decision,
        comment: d.comment,
        createdAt: d.createdAt,
      })),
    };
  }
}

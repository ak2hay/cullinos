import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  type OnApplicationBootstrap,
} from "@nestjs/common";
import type {
  PlatformApprovalRequest,
  PlatformTicketPriority,
  PlatformTicketStatus,
  Prisma,
} from "@prisma/client";
import { hashPassword } from "@cullinos/auth";
import { generateTemporaryPassword } from "../../common/generate-password";
import { PrismaService } from "../../prisma/prisma.service";
import { MailService } from "../mail/mail.service";
import { PlatformApprovalsService } from "../platform-approvals/platform-approvals.service";
import { grantCoversOrg, type EffectiveAccess } from "../platform-iam/platform-access.util";
import { PlatformNotificationsService } from "../platform-iam/platform-notifications.service";
import { onCallUserId, slaDueAt } from "../platform-people/on-call.util";

export type SupportActor = { sub: string; email?: string };

const OPEN_STATUSES: PlatformTicketStatus[] = ["open", "in_progress", "waiting_customer"];
const MIN_GRANT_MINUTES = 15;
export const MAX_GRANT_MINUTES = 4 * 60;
const SUPPORT_PASSWORD_LENGTH = 16;

export function formatTicketRef(seq: number) {
  return `TKT-${String(seq).padStart(6, "0")}`;
}

function supportPortalUrl() {
  return (process.env.SUPPORT_PORTAL_URL?.trim() || "https://support.cullinos.com").replace(/\/+$/, "");
}

export function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

/** Support desk and ticket-backed tenant access grants. */
@Injectable()
export class PlatformSupportService implements OnApplicationBootstrap {
  constructor(
    private prisma: PrismaService,
    private approvals: PlatformApprovalsService,
    private notifications: PlatformNotificationsService,
    private mail: MailService,
  ) {}

  onApplicationBootstrap() {
    this.approvals.registerHook("tenant_access.", (req, outcome) => this.onGrantDecision(req, outcome));
  }

  // ─── Tickets ──────────────────────────────────────────────────────────────

  async listTickets(
    actor: SupportActor,
    filter: {
      status?: string;
      priority?: string;
      assignee?: string;
      teamId?: string;
      organizationId?: string;
      q?: string;
      breached?: boolean;
      cursor?: string;
      limit?: number;
    },
  ) {
    const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
    const where: Prisma.SupportTicketWhereInput = {};
    if (filter.status === "open_all") where.status = { in: OPEN_STATUSES };
    else if (filter.status) where.status = filter.status as PlatformTicketStatus;
    if (filter.priority) where.priority = filter.priority as PlatformTicketPriority;
    if (filter.assignee === "me") where.assigneeUserId = actor.sub;
    else if (filter.assignee === "unassigned") where.assigneeUserId = null;
    else if (filter.assignee) where.assigneeUserId = filter.assignee;
    if (filter.teamId) where.assigneeTeamId = filter.teamId;
    if (filter.organizationId) where.organizationId = filter.organizationId;
    if (filter.breached) {
      where.slaDueAt = { lt: new Date() };
      where.status = { in: OPEN_STATUSES };
    }
    const q = filter.q?.trim();
    if (q) {
      const num = Number(q.replace(/^TKT-0*/i, ""));
      where.OR = [
        { subject: { contains: q, mode: "insensitive" } },
        { requesterEmail: { contains: q, mode: "insensitive" } },
        ...(Number.isInteger(num) && num > 0 ? [{ seq: num }] : []),
      ];
    }
    if (filter.cursor && /^\d+$/.test(filter.cursor)) where.seq = { lt: Number(filter.cursor) };

    const rows = await this.prisma.supportTicket.findMany({
      where,
      orderBy: { seq: "desc" },
      take: limit + 1,
      include: { _count: { select: { comments: true, accessGrants: true } } },
    });
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const [names, orgs] = await Promise.all([
      this.userNames(page.flatMap((t) => [t.assigneeUserId, t.createdById])),
      this.orgNames(page.map((t) => t.organizationId)),
    ]);
    return {
      data: page.map((t) => ({
        ...t,
        ref: formatTicketRef(t.seq),
        organization: t.organizationId ? (orgs.get(t.organizationId) ?? null) : null,
        assignee: t.assigneeUserId ? (names.get(t.assigneeUserId) ?? null) : null,
        slaBreached: Boolean(t.slaDueAt && t.slaDueAt < new Date() && OPEN_STATUSES.includes(t.status)),
      })),
      nextCursor: hasMore ? String(page[page.length - 1].seq) : null,
    };
  }

  async createTicket(
    actor: SupportActor,
    input: {
      subject: string;
      description: string;
      organizationId?: string | null;
      category?: string;
      priority?: PlatformTicketPriority;
      requesterName?: string;
      requesterEmail?: string;
      requesterPhone?: string;
      assigneeTeamId?: string | null;
      assigneeUserId?: string | null;
      tags?: string[];
    },
  ) {
    if (input.organizationId) {
      const org = await this.prisma.organization.findUnique({
        where: { id: input.organizationId },
        select: { id: true },
      });
      if (!org) throw new BadRequestException("Tenant not found");
    }
    const priority = input.priority ?? "normal";
    let assigneeUserId = input.assigneeUserId ?? null;
    if (!assigneeUserId && input.assigneeTeamId) {
      assigneeUserId = await this.onCallFor(input.assigneeTeamId);
    }
    const ticket = await this.prisma.supportTicket.create({
      data: {
        subject: input.subject.trim(),
        description: input.description.trim(),
        organizationId: input.organizationId || null,
        category: input.category?.trim() || "general",
        priority,
        requesterName: input.requesterName?.trim() || null,
        requesterEmail: input.requesterEmail?.trim().toLowerCase() || null,
        requesterPhone: input.requesterPhone?.trim() || null,
        assigneeTeamId: input.assigneeTeamId || null,
        assigneeUserId,
        createdById: actor.sub,
        slaDueAt: slaDueAt(priority),
        tags: [...new Set((input.tags ?? []).map((t) => t.trim().toLowerCase()).filter(Boolean))],
      },
    });
    if (assigneeUserId && assigneeUserId !== actor.sub) {
      await this.notifications.notify([assigneeUserId], {
        kind: "ticket.assigned",
        title: `${formatTicketRef(ticket.seq)} assigned to you: ${ticket.subject}`,
        link: `/support/tickets/${ticket.id}`,
        email: priority === "urgent" || priority === "high",
      });
    }
    return { ...ticket, ref: formatTicketRef(ticket.seq) };
  }

  async getTicket(id: string) {
    const t = await this.prisma.supportTicket.findUnique({
      where: { id },
      include: {
        comments: { orderBy: { createdAt: "asc" } },
        accessGrants: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!t) throw new NotFoundException("Ticket not found");
    const [names, orgs, activityCount] = await Promise.all([
      this.userNames([
        t.assigneeUserId,
        t.createdById,
        ...t.comments.map((c) => c.authorId),
        ...t.accessGrants.map((g) => g.userId),
      ]),
      this.orgNames([t.organizationId]),
      this.prisma.platformActivityLog.count({ where: { ticketId: t.id } }),
    ]);
    const team = t.assigneeTeamId
      ? await this.prisma.platformTeam.findUnique({
          where: { id: t.assigneeTeamId },
          select: { id: true, name: true },
        })
      : null;
    return {
      ...t,
      ref: formatTicketRef(t.seq),
      organization: t.organizationId ? (orgs.get(t.organizationId) ?? null) : null,
      assignee: t.assigneeUserId ? (names.get(t.assigneeUserId) ?? null) : null,
      assigneeTeam: team,
      createdBy: names.get(t.createdById) ?? null,
      comments: t.comments.map((c) => ({ ...c, author: c.authorId ? (names.get(c.authorId) ?? null) : null })),
      accessGrants: t.accessGrants.map((g) => ({ ...g, employee: names.get(g.userId) ?? null })),
      activityCount,
      slaBreached: Boolean(t.slaDueAt && t.slaDueAt < new Date() && OPEN_STATUSES.includes(t.status)),
    };
  }

  async updateTicket(
    actor: SupportActor,
    access: EffectiveAccess | undefined,
    id: string,
    input: {
      status?: PlatformTicketStatus;
      priority?: PlatformTicketPriority;
      category?: string;
      tags?: string[];
      assigneeUserId?: string | null;
      assigneeTeamId?: string | null;
    },
  ) {
    const t = await this.prisma.supportTicket.findUnique({ where: { id } });
    if (!t) throw new NotFoundException("Ticket not found");
    const reassigning =
      (input.assigneeUserId !== undefined && input.assigneeUserId !== t.assigneeUserId) ||
      (input.assigneeTeamId !== undefined && input.assigneeTeamId !== t.assigneeTeamId);
    const selfAssign = input.assigneeUserId === actor.sub && input.assigneeTeamId === undefined;
    if (reassigning && !selfAssign && !access?.global.includes("tickets.assign")) {
      throw new ForbiddenException("Assigning tickets to others needs the tickets.assign permission");
    }
    if (input.assigneeUserId) {
      const u = await this.prisma.user.findFirst({
        where: { id: input.assigneeUserId, isSuperAdmin: true, status: "active" },
        select: { id: true },
      });
      if (!u) throw new BadRequestException("Assignee must be an active platform staff member");
    }
    const now = new Date();
    const data: Prisma.SupportTicketUncheckedUpdateInput = {
      ...(input.status ? { status: input.status } : {}),
      ...(input.priority ? { priority: input.priority, slaDueAt: slaDueAt(input.priority, t.createdAt) } : {}),
      ...(input.category ? { category: input.category.trim() } : {}),
      ...(input.tags ? { tags: [...new Set(input.tags.map((x) => x.trim().toLowerCase()).filter(Boolean))] } : {}),
      ...(input.assigneeUserId !== undefined ? { assigneeUserId: input.assigneeUserId } : {}),
      ...(input.assigneeTeamId !== undefined ? { assigneeTeamId: input.assigneeTeamId } : {}),
    };
    if (input.status === "resolved" || input.status === "closed") data.resolvedAt = t.resolvedAt ?? now;
    if (input.status && OPEN_STATUSES.includes(input.status)) data.resolvedAt = null;
    if (input.assigneeTeamId && input.assigneeUserId === undefined && !t.assigneeUserId) {
      data.assigneeUserId = await this.onCallFor(input.assigneeTeamId);
    }
    const updated = await this.prisma.supportTicket.update({ where: { id }, data });

    if (input.status === "resolved" || input.status === "closed") {
      // Closing the ticket ends any tenant access it justified.
      await this.prisma.tenantAccessGrant.updateMany({
        where: { ticketId: id, status: { in: ["pending", "active"] } },
        data: { status: "revoked", revokedAt: now, revokedById: actor.sub },
      });
      await this.prisma.supportLoginCredential.updateMany({
        where: { ticketId: id, revokedAt: null },
        data: { revokedAt: now },
      });
    }
    const newAssignee = updated.assigneeUserId;
    if (newAssignee && newAssignee !== t.assigneeUserId && newAssignee !== actor.sub) {
      await this.notifications.notify([newAssignee], {
        kind: "ticket.assigned",
        title: `${formatTicketRef(t.seq)} assigned to you: ${t.subject}`,
        link: `/support/tickets/${id}`,
      });
    }
    return this.getTicket(id);
  }

  async addComment(
    actor: SupportActor,
    id: string,
    input: { body: string; isInternal?: boolean; attachments?: { name: string; url: string }[] },
  ) {
    const t = await this.prisma.supportTicket.findUnique({ where: { id } });
    if (!t) throw new NotFoundException("Ticket not found");
    await this.prisma.supportTicketComment.create({
      data: {
        ticketId: id,
        authorId: actor.sub,
        body: input.body.trim(),
        isInternal: input.isInternal ?? true,
        attachments: input.attachments?.length ? input.attachments : undefined,
      },
    });
    await this.prisma.supportTicket.update({
      where: { id },
      data: {
        ...(t.firstResponseAt || actor.sub === t.createdById ? {} : { firstResponseAt: new Date() }),
        ...(t.status === "open" ? { status: "in_progress" } : {}),
      },
    });
    const watchers = [t.assigneeUserId, t.createdById].filter((u): u is string => Boolean(u) && u !== actor.sub);
    await this.notifications.notify(watchers, {
      kind: "ticket.comment",
      title: `New comment on ${formatTicketRef(t.seq)}: ${t.subject}`,
      body: input.body.slice(0, 300),
      link: `/support/tickets/${id}`,
    });
    if (input.isInternal === false && t.requesterEmail) {
      await this.emailRequester(t, input.body);
    }
    return this.getTicket(id);
  }

  private async emailRequester(t: { id: string; seq: number; subject: string; requesterEmail: string | null; requesterName: string | null }, body: string) {
    if (!t.requesterEmail) return;
    const ref = formatTicketRef(t.seq);
    const link = `${supportPortalUrl()}/tickets/${t.id}`;
    const greeting = t.requesterName ? `Hi ${t.requesterName},` : "Hi,";
    const safe = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
    await this.mail.sendMail({
      to: t.requesterEmail,
      subject: `[${ref}] ${t.subject}`,
      text: `${greeting}\n\nCullinos support replied to your ticket ${ref}:\n\n${body}\n\nView or reply: ${link}`,
      html: `<p>${safe(greeting)}</p><p>Cullinos support replied to your ticket <strong>${ref}</strong>:</p><blockquote style="border-left:3px solid #D4A017;padding-left:12px;white-space:pre-wrap">${safe(body)}</blockquote><p><a href="${link}">View or reply in the support portal</a></p>`,
    });
  }

  // ─── Knowledge base ───────────────────────────────────────────────────────

  listArticles(includeDrafts: boolean) {
    return this.prisma.knowledgeArticle.findMany({
      where: includeDrafts ? {} : { published: true },
      orderBy: { updatedAt: "desc" },
      take: 500,
    });
  }

  async saveArticle(
    actor: SupportActor,
    id: string | null,
    input: { title: string; slug?: string; summary?: string | null; body: string; category?: string; published?: boolean },
  ) {
    const slug = slugify(input.slug?.trim() || input.title);
    if (!slug) throw new BadRequestException("Article needs a title");
    const clash = await this.prisma.knowledgeArticle.findFirst({
      where: { slug, ...(id ? { NOT: { id } } : {}) },
      select: { id: true },
    });
    if (clash) throw new ConflictException(`An article with slug "${slug}" already exists`);
    const data = {
      title: input.title.trim(),
      slug,
      summary: input.summary?.trim() || null,
      body: input.body,
      category: input.category?.trim() || "general",
      published: input.published ?? false,
    };
    if (!id) return this.prisma.knowledgeArticle.create({ data: { ...data, createdById: actor.sub } });
    const existing = await this.prisma.knowledgeArticle.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundException("Article not found");
    return this.prisma.knowledgeArticle.update({ where: { id }, data });
  }

  async deleteArticle(id: string) {
    const res = await this.prisma.knowledgeArticle.deleteMany({ where: { id } });
    if (!res.count) throw new NotFoundException("Article not found");
    return { deleted: true, id };
  }

  // ─── Tenant access grants ─────────────────────────────────────────────────

  async requestGrant(
    actor: SupportActor,
    access: EffectiveAccess | undefined,
    ticketId: string,
    input: { accessLevel: "read_only" | "full"; durationMinutes: number; justification: string },
  ) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException("Ticket not found");
    if (!ticket.organizationId) throw new BadRequestException("Link the ticket to a tenant first");
    if (!OPEN_STATUSES.includes(ticket.status)) {
      throw new BadRequestException("Tenant access needs an open ticket");
    }
    const justification = input.justification.trim();
    if (justification.length < 15) {
      throw new BadRequestException("Explain why you need access (min 15 characters)");
    }
    const minutes = Math.round(input.durationMinutes);
    if (minutes < MIN_GRANT_MINUTES || minutes > MAX_GRANT_MINUTES) {
      throw new BadRequestException(`Duration must be ${MIN_GRANT_MINUTES}-${MAX_GRANT_MINUTES} minutes`);
    }
    await this.assertOrgInScope(access, ticket.organizationId);

    const existing = await this.prisma.tenantAccessGrant.findFirst({
      where: { userId: actor.sub, ticketId, status: { in: ["pending", "active"] } },
    });
    if (existing) throw new ConflictException("You already have a pending or active grant on this ticket");

    const grant = await this.prisma.tenantAccessGrant.create({
      data: {
        ticketId,
        userId: actor.sub,
        organizationId: ticket.organizationId,
        accessLevel: input.accessLevel,
        justification,
        durationMinutes: minutes,
      },
    });
    const actionKey = `tenant_access.${input.accessLevel}`;
    const policy = await this.approvals.activePolicy(actionKey);
    if (!policy) {
      return this.activateGrant(grant.id);
    }
    const org = await this.prisma.organization.findUnique({
      where: { id: ticket.organizationId },
      select: { name: true },
    });
    const approval = await this.approvals.createRequest({
      policy,
      title: `${input.accessLevel === "full" ? "Full" : "Read-only"} access to ${org?.name ?? "tenant"} for ${minutes} min (${formatTicketRef(ticket.seq)})`,
      requestedBy: actor,
      justification,
      summary: { grantId: grant.id, ticketId, organizationId: ticket.organizationId, accessLevel: input.accessLevel, durationMinutes: minutes },
      ticketId,
      targetOrgId: ticket.organizationId,
    });
    return this.prisma.tenantAccessGrant.update({
      where: { id: grant.id },
      data: { approvalRequestId: approval.id },
    });
  }

  async listGrants(
    actor: SupportActor,
    access: EffectiveAccess | undefined,
    filter: { status?: string; mine?: boolean; organizationId?: string },
  ) {
    await this.expireGrants();
    const canSeeAll = Boolean(
      access?.global.includes("tenant_access.revoke") || access?.global.includes("tickets.assign"),
    );
    const rows = await this.prisma.tenantAccessGrant.findMany({
      where: {
        ...(filter.mine || !canSeeAll ? { userId: actor.sub } : {}),
        ...(filter.status ? { status: filter.status as never } : {}),
        ...(filter.organizationId ? { organizationId: filter.organizationId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { ticket: { select: { id: true, seq: true, subject: true } } },
    });
    const [names, orgs] = await Promise.all([
      this.userNames(rows.flatMap((g) => [g.userId, g.revokedById])),
      this.orgNames(rows.map((g) => g.organizationId)),
    ]);
    return rows.map((g) => ({
      ...g,
      ticketRef: formatTicketRef(g.ticket.seq),
      employee: names.get(g.userId) ?? null,
      organization: orgs.get(g.organizationId) ?? null,
      revokedBy: g.revokedById ? (names.get(g.revokedById) ?? null) : null,
    }));
  }

  async revokeGrant(actor: SupportActor, access: EffectiveAccess | undefined, id: string) {
    const g = await this.prisma.tenantAccessGrant.findUnique({ where: { id } });
    if (!g) throw new NotFoundException("Grant not found");
    if (g.userId !== actor.sub && !access?.global.includes("tenant_access.revoke")) {
      throw new ForbiddenException("You can only revoke your own grants");
    }
    if (g.status !== "pending" && g.status !== "active") return g;
    const now = new Date();
    const updated = await this.prisma.tenantAccessGrant.update({
      where: { id },
      data: { status: "revoked", revokedAt: now, revokedById: actor.sub },
    });
    await this.prisma.supportLoginCredential.updateMany({
      where: { grantId: id, revokedAt: null },
      data: { revokedAt: now },
    });
    if (g.userId !== actor.sub) {
      await this.notifications.notify([g.userId], {
        kind: "grant.revoked",
        title: "Your tenant access grant was revoked",
        link: `/support/tickets/${g.ticketId}`,
      });
    }
    return updated;
  }

  async expireGrants() {
    const now = new Date();
    await this.prisma.tenantAccessGrant.updateMany({
      where: { status: "active", expiresAt: { lt: now } },
      data: { status: "expired" },
    });
    await this.prisma.supportLoginCredential.updateMany({
      where: { revokedAt: null, expiresAt: { lt: now } },
      data: { revokedAt: now },
    });
  }

  // ─── Support login passwords ──────────────────────────────────────────────

  /** Credential summary for a grant; the plain password is only ever returned by `createSupportPassword`. */
  async getSupportPassword(actor: SupportActor, grantId: string) {
    const g = await this.prisma.tenantAccessGrant.findUnique({
      where: { id: grantId },
      include: { loginCredential: true },
    });
    if (!g) throw new NotFoundException("Grant not found");
    if (g.userId !== actor.sub) throw new ForbiddenException("You can only view your own grant's password");
    return g.loginCredential ? await this.credentialSummary(g.loginCredential) : null;
  }

  async createSupportPassword(actor: SupportActor, grantId: string, input: { targetUserId?: string }) {
    const g = await this.prisma.tenantAccessGrant.findUnique({ where: { id: grantId } });
    if (!g) throw new NotFoundException("Grant not found");
    if (g.userId !== actor.sub) throw new ForbiddenException("You can only create a password for your own grant");
    const now = Date.now();
    if (g.status !== "active" || !g.expiresAt || g.expiresAt.getTime() - now < 60_000) {
      throw new BadRequestException("An active access grant with at least one minute left is required");
    }

    const target = input.targetUserId
      ? await this.prisma.user.findFirst({
          where: { id: input.targetUserId, organizationId: g.organizationId, status: "active", isSuperAdmin: false },
          select: { id: true, email: true, name: true },
        })
      : await this.defaultTargetUser(g.organizationId);
    if (!target) throw new BadRequestException("No active tenant user to sign in as");

    const password = generateTemporaryPassword(SUPPORT_PASSWORD_LENGTH);
    const passwordHash = await hashPassword(password);
    const data = {
      organizationId: g.organizationId,
      targetUserId: target.id,
      ticketId: g.ticketId,
      createdById: actor.sub,
      passwordHash,
      expiresAt: g.expiresAt,
      revokedAt: null,
      lastUsedAt: null,
      useCount: 0,
      createdAt: new Date(now),
    };
    const credential = await this.prisma.supportLoginCredential.upsert({
      where: { grantId },
      create: { grantId, ...data },
      update: data,
    });
    await this.prisma.supportTicketComment.create({
      data: {
        ticketId: g.ticketId,
        authorId: actor.sub,
        body: `Support login password generated for ${target.email}, valid until ${g.expiresAt.toISOString()}.`,
        isInternal: true,
      },
    });
    return { ...(await this.credentialSummary(credential)), password };
  }

  async revokeSupportPassword(actor: SupportActor, access: EffectiveAccess | undefined, grantId: string) {
    const c = await this.prisma.supportLoginCredential.findUnique({ where: { grantId } });
    if (!c) throw new NotFoundException("No support password for this grant");
    if (c.createdById !== actor.sub && !access?.global.includes("tenant_access.revoke")) {
      throw new ForbiddenException("You can only revoke your own support password");
    }
    if (c.revokedAt) return this.credentialSummary(c);
    const updated = await this.prisma.supportLoginCredential.update({
      where: { grantId },
      data: { revokedAt: new Date() },
    });
    return this.credentialSummary(updated);
  }

  private async defaultTargetUser(organizationId: string) {
    const select = { id: true, email: true, name: true } as const;
    const owner = await this.prisma.user.findFirst({
      where: {
        organizationId,
        status: "active",
        isSuperAdmin: false,
        userRoles: { some: { role: { slug: "owner" } } },
      },
      select,
    });
    if (owner) return owner;
    return this.prisma.user.findFirst({
      where: { organizationId, status: "active", isSuperAdmin: false },
      orderBy: { createdAt: "asc" },
      select,
    });
  }

  private async credentialSummary(c: {
    id: string;
    grantId: string;
    targetUserId: string;
    expiresAt: Date;
    revokedAt: Date | null;
    lastUsedAt: Date | null;
    useCount: number;
    createdAt: Date;
  }) {
    const target = await this.prisma.user.findUnique({
      where: { id: c.targetUserId },
      select: { id: true, email: true, name: true },
    });
    return {
      id: c.id,
      grantId: c.grantId,
      targetUser: target,
      expiresAt: c.expiresAt,
      revokedAt: c.revokedAt,
      lastUsedAt: c.lastUsedAt,
      useCount: c.useCount,
      createdAt: c.createdAt,
      active: !c.revokedAt && c.expiresAt.getTime() > Date.now(),
    };
  }

  private async activateGrant(grantId: string) {
    const g = await this.prisma.tenantAccessGrant.findUniqueOrThrow({ where: { id: grantId } });
    const now = new Date();
    return this.prisma.tenantAccessGrant.update({
      where: { id: grantId },
      data: {
        status: "active",
        approvedAt: now,
        startsAt: now,
        expiresAt: new Date(now.getTime() + g.durationMinutes * 60_000),
      },
    });
  }

  private async onGrantDecision(
    req: PlatformApprovalRequest,
    outcome: "approved" | "rejected" | "expired" | "cancelled",
  ) {
    const grantId = (req.payload as { summary?: { grantId?: string } })?.summary?.grantId;
    if (!grantId) return;
    const g = await this.prisma.tenantAccessGrant.findUnique({ where: { id: grantId } });
    if (!g || g.status !== "pending") return;
    if (outcome === "approved") {
      const activated = await this.activateGrant(grantId);
      await this.approvals.markExecuted(req.id, { grantId, expiresAt: activated.expiresAt });
      await this.notifications.notify([g.userId], {
        kind: "grant.active",
        title: "Tenant access approved",
        body: `Active until ${activated.expiresAt?.toISOString()}. Open it from the ticket.`,
        link: `/support/tickets/${g.ticketId}`,
      });
      return;
    }
    await this.prisma.tenantAccessGrant.update({
      where: { id: grantId },
      data: { status: outcome === "rejected" ? "rejected" : outcome === "expired" ? "expired" : "revoked" },
    });
  }

  private async assertOrgInScope(access: EffectiveAccess | undefined, orgId: string) {
    if (!access || access.global.includes("tenants.impersonate")) return;
    const org = await this.prisma.organization.findUnique({ where: { id: orgId }, select: { id: true, state: true } });
    const grants = access.scoped.filter((g) => g.permissions.includes("tenants.impersonate"));
    if (!org || !grants.some((g) => grantCoversOrg(g, org))) {
      throw new ForbiddenException("This tenant is outside your assigned scope");
    }
  }

  private async onCallFor(teamId: string): Promise<string | null> {
    const rotations = await this.prisma.platformOnCallRotation.findMany({
      where: { teamId, isActive: true },
      orderBy: { createdAt: "asc" },
    });
    for (const r of rotations) {
      const uid = onCallUserId(r);
      if (uid) return uid;
    }
    return null;
  }

  private async userNames(ids: (string | null | undefined)[]) {
    const unique = [...new Set(ids.filter((x): x is string => Boolean(x)))];
    if (!unique.length) return new Map<string, { id: string; name: string; email: string; employeeCode: string | null }>();
    const users = await this.prisma.user.findMany({
      where: { id: { in: unique } },
      select: { id: true, name: true, email: true, platformEmployee: { select: { employeeCode: true } } },
    });
    return new Map(
      users.map((u) => [
        u.id,
        { id: u.id, name: u.name, email: u.email, employeeCode: u.platformEmployee?.employeeCode ?? null },
      ]),
    );
  }

  private async orgNames(ids: (string | null | undefined)[]) {
    const unique = [...new Set(ids.filter((x): x is string => Boolean(x)))];
    if (!unique.length) return new Map<string, { id: string; name: string; slug: string }>();
    const orgs = await this.prisma.organization.findMany({
      where: { id: { in: unique } },
      select: { id: true, name: true, slug: true },
    });
    return new Map(orgs.map((o) => [o.id, o]));
  }
}

import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { PlatformTicketPriority, PlatformTicketStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { PlatformAccessService } from "../platform-iam/platform-access.service";
import { PlatformNotificationsService } from "../platform-iam/platform-notifications.service";
import { slaDueAt } from "../platform-people/on-call.util";
import { formatTicketRef } from "./platform-support.service";

export type TenantActor = { sub: string; organizationId: string };

const OPEN_STATUSES: PlatformTicketStatus[] = ["open", "in_progress", "waiting_customer"];
/** Tenants cannot raise urgent tickets themselves; staff escalate. */
const TENANT_PRIORITIES: PlatformTicketPriority[] = ["low", "normal", "high"];
/** Staff triage queue for tickets raised from the portal. */
const TRIAGE_ROLES = ["owner", "support"];

export const TICKET_CATEGORIES = [
  "general",
  "billing",
  "pos",
  "kds",
  "menu",
  "orders",
  "payments",
  "inventory",
  "integrations",
  "account",
  "bug",
  "feature_request",
] as const;

/**
 * Restaurant-side view of the support desk. Every query is scoped by the caller's
 * organizationId, and internal staff notes are never returned.
 */
@Injectable()
export class TenantSupportService {
  constructor(
    private prisma: PrismaService,
    private access: PlatformAccessService,
    private notifications: PlatformNotificationsService,
  ) {}

  async list(actor: TenantActor, filter: { status?: string; q?: string; mine?: boolean }) {
    const where: Prisma.SupportTicketWhereInput = { organizationId: actor.organizationId };
    if (filter.status === "open") where.status = { in: OPEN_STATUSES };
    else if (filter.status === "closed") where.status = { in: ["resolved", "closed"] };
    if (filter.mine) where.createdById = actor.sub;
    const q = filter.q?.trim();
    if (q) {
      const num = Number(q.replace(/^TKT-0*/i, ""));
      where.OR = [
        { subject: { contains: q, mode: "insensitive" } },
        ...(Number.isInteger(num) && num > 0 ? [{ seq: num }] : []),
      ];
    }
    const rows = await this.prisma.supportTicket.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: 200,
      select: {
        id: true,
        seq: true,
        subject: true,
        category: true,
        priority: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        resolvedAt: true,
        satisfaction: true,
        createdById: true,
        _count: { select: { comments: { where: { isInternal: false } } } },
      },
    });
    return rows.map(({ _count, ...t }) => ({
      ...t,
      ref: formatTicketRef(t.seq),
      replyCount: _count.comments,
      isMine: t.createdById === actor.sub,
    }));
  }

  async get(actor: TenantActor, id: string) {
    const t = await this.prisma.supportTicket.findFirst({
      where: { id, organizationId: actor.organizationId },
      include: {
        comments: { where: { isInternal: false }, orderBy: { createdAt: "asc" } },
      },
    });
    if (!t) throw new NotFoundException("Ticket not found");
    const authorIds = [...new Set(t.comments.map((c) => c.authorId).filter((x): x is string => Boolean(x)))];
    const authors = authorIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: authorIds } },
          select: { id: true, name: true, isSuperAdmin: true },
        })
      : [];
    const byId = new Map(authors.map((a) => [a.id, a]));
    const assignee = t.assigneeUserId
      ? await this.prisma.user.findUnique({ where: { id: t.assigneeUserId }, select: { name: true } })
      : null;
    return {
      id: t.id,
      ref: formatTicketRef(t.seq),
      subject: t.subject,
      description: t.description,
      category: t.category,
      priority: t.priority,
      status: t.status,
      channel: t.channel,
      requesterName: t.requesterName,
      requesterEmail: t.requesterEmail,
      assigneeName: assignee?.name ?? null,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      resolvedAt: t.resolvedAt,
      satisfaction: t.satisfaction,
      satisfactionComment: t.satisfactionComment,
      isMine: t.createdById === actor.sub,
      comments: t.comments.map((c) => {
        const a = c.authorId ? byId.get(c.authorId) : undefined;
        return {
          id: c.id,
          body: c.body,
          attachments: c.attachments,
          createdAt: c.createdAt,
          fromCustomer: c.fromCustomer,
          authorName: c.fromCustomer ? (a?.name ?? "You") : a?.name ? `${a.name} (Cullinos support)` : "Cullinos support",
        };
      }),
    };
  }

  async create(
    actor: TenantActor,
    input: {
      subject: string;
      description: string;
      category?: string;
      priority?: PlatformTicketPriority;
      requesterPhone?: string;
    },
  ) {
    const priority = input.priority && TENANT_PRIORITIES.includes(input.priority) ? input.priority : "normal";
    const category = (TICKET_CATEGORIES as readonly string[]).includes(input.category ?? "")
      ? input.category!
      : "general";
    const user = await this.prisma.user.findFirst({
      where: { id: actor.sub, organizationId: actor.organizationId },
      select: { name: true, email: true, phone: true },
    });
    if (!user) throw new NotFoundException("User not found");
    const ticket = await this.prisma.supportTicket.create({
      data: {
        subject: input.subject.trim(),
        description: input.description.trim(),
        organizationId: actor.organizationId,
        category,
        priority,
        channel: "portal",
        requesterName: user.name,
        requesterEmail: user.email?.toLowerCase() ?? null,
        requesterPhone: input.requesterPhone?.trim() || user.phone || null,
        createdById: actor.sub,
        slaDueAt: slaDueAt(priority),
      },
    });
    const org = await this.prisma.organization.findUnique({
      where: { id: actor.organizationId },
      select: { name: true },
    });
    const triage = await this.access.userIdsWithRoles(TRIAGE_ROLES);
    await this.notifications.notify(triage, {
      kind: "ticket.created",
      title: `${formatTicketRef(ticket.seq)} new from ${org?.name ?? "a tenant"}: ${ticket.subject}`,
      body: ticket.description.slice(0, 300),
      link: `/support/tickets/${ticket.id}`,
      email: priority === "high",
    });
    return this.get(actor, ticket.id);
  }

  async comment(
    actor: TenantActor,
    id: string,
    input: { body: string; attachments?: { name: string; url: string }[] },
  ) {
    const t = await this.prisma.supportTicket.findFirst({
      where: { id, organizationId: actor.organizationId },
    });
    if (!t) throw new NotFoundException("Ticket not found");
    if (t.status === "closed") {
      throw new BadRequestException("This ticket is closed. Reopen it or raise a new ticket.");
    }
    await this.prisma.supportTicketComment.create({
      data: {
        ticketId: id,
        authorId: actor.sub,
        body: input.body.trim(),
        isInternal: false,
        fromCustomer: true,
        attachments: input.attachments?.length ? input.attachments : undefined,
      },
    });
    // A customer reply puts the ball back in the agent's court.
    const nextStatus: PlatformTicketStatus | null =
      t.status === "waiting_customer" || t.status === "resolved" ? "in_progress" : null;
    await this.prisma.supportTicket.update({
      where: { id },
      data: nextStatus ? { status: nextStatus, resolvedAt: null } : { updatedAt: new Date() },
    });
    const watchers = t.assigneeUserId ? [t.assigneeUserId] : await this.access.userIdsWithRoles(TRIAGE_ROLES);
    await this.notifications.notify(watchers, {
      kind: "ticket.customer_reply",
      title: `Customer replied on ${formatTicketRef(t.seq)}: ${t.subject}`,
      body: input.body.slice(0, 300),
      link: `/support/tickets/${id}`,
    });
    return this.get(actor, id);
  }

  async setStatus(actor: TenantActor, id: string, action: "close" | "reopen", reason?: string) {
    const t = await this.prisma.supportTicket.findFirst({
      where: { id, organizationId: actor.organizationId },
    });
    if (!t) throw new NotFoundException("Ticket not found");
    const now = new Date();
    if (action === "close") {
      if (t.status === "closed") return this.get(actor, id);
      await this.prisma.supportTicket.update({
        where: { id },
        data: { status: "closed", resolvedAt: t.resolvedAt ?? now, closedReason: reason?.trim() || "Closed by customer" },
      });
      await this.prisma.tenantAccessGrant.updateMany({
        where: { ticketId: id, status: { in: ["pending", "active"] } },
        data: { status: "revoked", revokedAt: now },
      });
      await this.prisma.supportLoginCredential.updateMany({
        where: { ticketId: id, revokedAt: null },
        data: { revokedAt: now },
      });
    } else {
      if (OPEN_STATUSES.includes(t.status)) return this.get(actor, id);
      await this.prisma.supportTicket.update({
        where: { id },
        data: { status: "open", resolvedAt: null, closedReason: null, satisfaction: null, satisfactionComment: null },
      });
      if (t.assigneeUserId) {
        await this.notifications.notify([t.assigneeUserId], {
          kind: "ticket.reopened",
          title: `${formatTicketRef(t.seq)} reopened by customer: ${t.subject}`,
          body: reason?.slice(0, 300),
          link: `/support/tickets/${id}`,
        });
      }
    }
    return this.get(actor, id);
  }

  async rate(actor: TenantActor, id: string, rating: number, comment?: string) {
    const t = await this.prisma.supportTicket.findFirst({
      where: { id, organizationId: actor.organizationId },
      select: { id: true, status: true },
    });
    if (!t) throw new NotFoundException("Ticket not found");
    if (OPEN_STATUSES.includes(t.status)) {
      throw new BadRequestException("You can rate a ticket once it is resolved");
    }
    const score = Math.round(rating);
    if (score < 1 || score > 5) throw new BadRequestException("Rating must be 1-5");
    await this.prisma.supportTicket.update({
      where: { id },
      data: { satisfaction: score, satisfactionComment: comment?.trim().slice(0, 1000) || null },
    });
    return this.get(actor, id);
  }

  // ─── Knowledge base (read-only for tenants) ───────────────────────────────

  async listArticles(filter: { q?: string; category?: string }) {
    const q = filter.q?.trim();
    return this.prisma.knowledgeArticle.findMany({
      where: {
        published: true,
        ...(filter.category ? { category: filter.category } : {}),
        ...(q
          ? {
              OR: [
                { title: { contains: q, mode: "insensitive" } },
                { summary: { contains: q, mode: "insensitive" } },
                { body: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: [{ viewCount: "desc" }, { updatedAt: "desc" }],
      take: 50,
      select: { id: true, slug: true, title: true, summary: true, category: true, updatedAt: true },
    });
  }

  async getArticle(slug: string) {
    const a = await this.prisma.knowledgeArticle.findFirst({ where: { slug, published: true } });
    if (!a) throw new NotFoundException("Article not found");
    await this.prisma.knowledgeArticle.update({ where: { id: a.id }, data: { viewCount: { increment: 1 } } });
    return a;
  }
}

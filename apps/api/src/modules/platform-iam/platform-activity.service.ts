import { Injectable, Logger } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { activityHash, verifyActivityChain, type ActivityHashFields } from "./platform-activity.util";

/** Arbitrary constant key for the advisory lock that serialises chain appends. */
const CHAIN_LOCK_KEY = 784_221_901;

export type ActivityEntry = {
  userId?: string | null;
  employeeCode?: string | null;
  actorEmail?: string | null;
  sessionId?: string | null;
  action: string;
  resourceType?: string | null;
  resourceId?: string | null;
  method?: string | null;
  route?: string | null;
  statusCode?: number | null;
  targetOrgId?: string | null;
  requestId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  approvalRequestId?: string | null;
  ticketId?: string | null;
  grantId?: string | null;
  diff?: unknown;
  metadata?: unknown;
};

export type ActivityFilter = {
  employeeCode?: string;
  userId?: string;
  action?: string;
  targetOrgId?: string;
  grantId?: string;
  ticketId?: string;
  from?: string;
  to?: string;
  /** seq of the last row on the previous page */
  cursor?: string;
  limit?: number;
};

function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  return value === undefined || value === null ? undefined : (value as Prisma.InputJsonValue);
}

/** Append-only, hash-chained staff activity log (see platform_activity_logs trigger). */
@Injectable()
export class PlatformActivityService {
  private readonly logger = new Logger(PlatformActivityService.name);

  constructor(private prisma: PrismaService) {}

  /** Never throws: losing a log line must not fail the staff action that produced it. */
  async record(entry: ActivityEntry): Promise<void> {
    try {
      await this.append(entry);
    } catch (err) {
      this.logger.error(`Failed to write platform activity: ${(err as Error).message}`);
    }
  }

  async append(entry: ActivityEntry) {
    const createdAt = new Date();
    const fields: ActivityHashFields = {
      userId: entry.userId ?? null,
      employeeCode: entry.employeeCode ?? null,
      action: entry.action,
      resourceType: entry.resourceType ?? null,
      resourceId: entry.resourceId ?? null,
      targetOrgId: entry.targetOrgId ?? null,
      statusCode: entry.statusCode ?? null,
      approvalRequestId: entry.approvalRequestId ?? null,
      ticketId: entry.ticketId ?? null,
      grantId: entry.grantId ?? null,
      diff: entry.diff ?? null,
      metadata: entry.metadata ?? null,
      createdAt: createdAt.toISOString(),
    };
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${CHAIN_LOCK_KEY})`;
      const last = await tx.platformActivityLog.findFirst({
        orderBy: { seq: "desc" },
        select: { hash: true },
      });
      const prevHash = last?.hash ?? null;
      return tx.platformActivityLog.create({
        data: {
          ...fields,
          diff: toJson(entry.diff),
          metadata: toJson(entry.metadata),
          actorEmail: entry.actorEmail ?? null,
          sessionId: entry.sessionId ?? null,
          method: entry.method ?? null,
          route: entry.route ?? null,
          requestId: entry.requestId ?? null,
          ip: entry.ip ?? null,
          userAgent: entry.userAgent?.slice(0, 255) ?? null,
          createdAt,
          prevHash,
          hash: activityHash(prevHash, fields),
        },
        select: { id: true },
      });
    });
  }

  private where(filter: ActivityFilter): Prisma.PlatformActivityLogWhereInput {
    const createdAt: Prisma.DateTimeFilter = {};
    if (filter.from) createdAt.gte = new Date(filter.from);
    if (filter.to) createdAt.lte = new Date(filter.to);
    return {
      ...(filter.employeeCode ? { employeeCode: filter.employeeCode.trim().toUpperCase() } : {}),
      ...(filter.userId ? { userId: filter.userId } : {}),
      ...(filter.action ? { action: { contains: filter.action.trim(), mode: "insensitive" } } : {}),
      ...(filter.targetOrgId ? { targetOrgId: filter.targetOrgId } : {}),
      ...(filter.grantId ? { grantId: filter.grantId } : {}),
      ...(filter.ticketId ? { ticketId: filter.ticketId } : {}),
      ...(filter.from || filter.to ? { createdAt } : {}),
    };
  }

  async list(filter: ActivityFilter) {
    const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
    const where = this.where(filter);
    if (filter.cursor && /^\d+$/.test(filter.cursor)) {
      where.seq = { lt: BigInt(filter.cursor) };
    }
    const rows = await this.prisma.platformActivityLog.findMany({
      where,
      orderBy: { seq: "desc" },
      take: limit + 1,
    });
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    return {
      data: page.map((r) => ({ ...r, seq: r.seq.toString() })),
      nextCursor: hasMore ? page[page.length - 1].seq.toString() : null,
    };
  }

  async exportCsv(filter: ActivityFilter, maxRows = 10_000) {
    const rows = await this.prisma.platformActivityLog.findMany({
      where: this.where(filter),
      orderBy: { seq: "desc" },
      take: maxRows,
    });
    const header = [
      "seq",
      "created_at",
      "employee_code",
      "actor_email",
      "action",
      "status",
      "resource_type",
      "resource_id",
      "target_org_id",
      "ticket_id",
      "grant_id",
      "approval_request_id",
      "ip",
    ];
    const esc = (v: unknown) => {
      const s = v === null || v === undefined ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = rows.map((r) =>
      [
        r.seq.toString(),
        r.createdAt.toISOString(),
        r.employeeCode,
        r.actorEmail,
        r.action,
        r.statusCode,
        r.resourceType,
        r.resourceId,
        r.targetOrgId,
        r.ticketId,
        r.grantId,
        r.approvalRequestId,
        r.ip,
      ]
        .map(esc)
        .join(","),
    );
    return [header.join(","), ...lines].join("\n");
  }

  /** Re-computes the chain over the most recent `limit` rows. */
  async verify(limit = 1000) {
    const take = Math.min(Math.max(limit, 2), 20_000);
    const rows = await this.prisma.platformActivityLog.findMany({
      orderBy: { seq: "desc" },
      take,
    });
    rows.reverse();
    return verifyActivityChain(
      rows.map((r) => ({
        id: r.id,
        prevHash: r.prevHash,
        hash: r.hash,
        userId: r.userId,
        employeeCode: r.employeeCode,
        action: r.action,
        resourceType: r.resourceType,
        resourceId: r.resourceId,
        targetOrgId: r.targetOrgId,
        statusCode: r.statusCode,
        approvalRequestId: r.approvalRequestId,
        ticketId: r.ticketId,
        grantId: r.grantId,
        diff: r.diff,
        metadata: r.metadata,
        createdAt: r.createdAt.toISOString(),
      })),
    );
  }
}

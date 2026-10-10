import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { normalizePhoneE164 } from "../../common/phone.util";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { ConsentService } from "../privacy/consent.service";
import { CustomerPrivacyService } from "../privacy/customer-privacy.service";
import { DPDP_PURPOSES } from "../privacy/privacy.constants";
import { newUnsubscribeToken } from "../privacy/privacy.crypto";

/** "98765 43210" / "+91-98765-43210" should still match a stored "+919876543210". */
export function phoneSearchTerm(q: string): string {
  if (!/^[\d\s+\-().]+$/.test(q)) return q;
  const digits = q.replace(/\D/g, "");
  if (!digits) return q;
  return digits.length > 10 ? digits.slice(-10) : digits;
}

export const CUSTOMER_SORTS = ["name", "points", "spent", "visits", "recent", "joined"] as const;
export type CustomerSort = (typeof CUSTOMER_SORTS)[number];

/** Orders that count as a visit / spend. */
const VISIT_EXCLUDED_STATUSES = ["draft", "cancelled", "voided"] as const;

/** totalSpent is in paise, like other admin money fields. */
export type CustomerStats = { visits: number; totalSpent: number; lastVisitAt: Date | null };

const EMPTY_STATS: CustomerStats = { visits: 0, totalSpent: 0, lastVisitAt: null };

@Injectable()
export class CustomersService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private consent: ConsentService,
    private customerPrivacy: CustomerPrivacyService,
  ) {}

  private customerWhere(orgId: string, q?: string): Prisma.CustomerWhereInput {
    const term = q?.trim();
    return {
      organizationId: orgId,
      anonymizedAt: null,
      ...(term
        ? {
            OR: [
              { name: { contains: term, mode: "insensitive" } },
              { phone: { contains: phoneSearchTerm(term) } },
              { email: { contains: term, mode: "insensitive" } },
            ],
          }
        : {}),
    };
  }

  private visitOrderWhere(orgId: string): Prisma.OrderWhereInput {
    return {
      organizationId: orgId,
      status: { notIn: [...VISIT_EXCLUDED_STATUSES] },
    };
  }

  /** Visits, spend and last visit for the given customers (same org only). */
  async statsFor(orgId: string, customerIds: string[]): Promise<Map<string, CustomerStats>> {
    const map = new Map<string, CustomerStats>();
    if (!customerIds.length) return map;
    const groups = await this.prisma.order.groupBy({
      by: ["customerId"],
      where: { ...this.visitOrderWhere(orgId), customerId: { in: customerIds } },
      _count: { _all: true },
      _sum: { total: true },
      _max: { createdAt: true },
    });
    for (const g of groups) {
      if (!g.customerId) continue;
      map.set(g.customerId, {
        visits: g._count._all,
        totalSpent: Math.round(Number(g._sum.total ?? 0) * 100),
        lastVisitAt: g._max.createdAt ?? null,
      });
    }
    return map;
  }

  list(orgId: string, q?: string) {
    return this.prisma.customer.findMany({
      where: this.customerWhere(orgId, q),
      include: { loyaltyTier: true },
      orderBy: { name: "asc" },
      take: 200,
    });
  }

  /** Owner CRM list: paginated, sortable, with visit/spend stats and org-wide totals. */
  async overview(
    orgId: string,
    opts: { q?: string; sort?: string; page?: number; limit?: number } = {},
  ) {
    const sort: CustomerSort = CUSTOMER_SORTS.includes(opts.sort as CustomerSort)
      ? (opts.sort as CustomerSort)
      : "recent";
    const limit = Math.min(100, Math.max(1, Math.floor(opts.limit ?? 50)));
    const page = Math.max(1, Math.floor(opts.page ?? 1));
    const skip = (page - 1) * limit;
    const where = this.customerWhere(orgId, opts.q);

    const [total, pointsAgg] = await Promise.all([
      this.prisma.customer.count({ where }),
      this.prisma.customer.aggregate({
        where: { organizationId: orgId, anonymizedAt: null },
        _sum: { loyaltyPoints: true },
        _count: { _all: true },
      }),
    ]);

    let ids: string[];
    if (sort === "name" || sort === "points" || sort === "joined") {
      const orderBy: Prisma.CustomerOrderByWithRelationInput[] =
        sort === "name"
          ? [{ name: "asc" }]
          : sort === "points"
            ? [{ loyaltyPoints: "desc" }, { name: "asc" }]
            : [{ createdAt: "desc" }];
      const rows = await this.prisma.customer.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        select: { id: true },
      });
      ids = rows.map((r) => r.id);
    } else {
      const groups = await this.prisma.order.groupBy({
        by: ["customerId"],
        where: { ...this.visitOrderWhere(orgId), customerId: { not: null }, customer: where },
        _count: { _all: true },
        _sum: { total: true },
        _max: { createdAt: true },
      });
      const key = (g: (typeof groups)[number]) =>
        sort === "spent"
          ? Number(g._sum.total ?? 0)
          : sort === "visits"
            ? g._count._all
            : (g._max.createdAt?.getTime() ?? 0);
      const ranked = groups
        .filter((g): g is typeof g & { customerId: string } => Boolean(g.customerId))
        .sort((a, b) => key(b) - key(a))
        .map((g) => g.customerId);
      ids = ranked.slice(skip, skip + limit);
      const remaining = limit - ids.length;
      if (remaining > 0) {
        const withoutVisits = await this.prisma.customer.findMany({
          where: { ...where, orders: { none: this.visitOrderWhere(orgId) } },
          orderBy: { createdAt: "desc" },
          skip: Math.max(0, skip - ranked.length),
          take: remaining,
          select: { id: true },
        });
        ids = ids.concat(withoutVisits.map((r) => r.id));
      }
    }

    const [rows, stats] = await Promise.all([
      this.prisma.customer.findMany({
        where: { organizationId: orgId, id: { in: ids } },
        include: { loyaltyTier: true },
      }),
      this.statsFor(orgId, ids),
    ]);
    const byId = new Map(rows.map((r) => [r.id, r]));
    const data = ids
      .map((id) => byId.get(id))
      .filter((c): c is NonNullable<typeof c> => Boolean(c))
      .map((c) => ({ ...c, ...(stats.get(c.id) ?? EMPTY_STATS) }));

    return {
      data,
      meta: { page, limit, total, hasMore: skip + data.length < total, sort },
      summary: {
        totalCustomers: pointsAgg._count._all,
        totalPoints: pointsAgg._sum.loyaltyPoints ?? 0,
      },
    };
  }

  async get(orgId: string, id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, organizationId: orgId, anonymizedAt: null },
      include: {
        loyaltyTier: true,
        loyaltyTransactions: { orderBy: { createdAt: "desc" }, take: 50 },
        orders: {
          where: { organizationId: orgId },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: { id: true, orderNumber: true, total: true, status: true, createdAt: true },
        },
      },
    });
    if (!customer) throw new NotFoundException("Customer not found");
    const stats = (await this.statsFor(orgId, [id])).get(id) ?? EMPTY_STATS;

    await this.audit.log({
      organizationId: orgId,
      action: "customer_pii_read",
      entityType: "Customer",
      entityId: id,
    });

    return {
      ...customer,
      ...stats,
      orders: customer.orders.map((o) => ({ ...o, total: Math.round(Number(o.total) * 100) })),
    };
  }

  async create(
    orgId: string,
    data: {
      name: string;
      phone?: string;
      email?: string;
      marketingEmailOptIn?: boolean;
      marketingSmsOptIn?: boolean;
    },
    actorUserId?: string,
  ) {
    if (!data.name?.trim()) throw new BadRequestException("name is required");

    const emailOptIn = Boolean(data.marketingEmailOptIn);
    const smsOptIn = Boolean(data.marketingSmsOptIn);

    const customer = await this.prisma.customer.create({
      data: {
        organizationId: orgId,
        name: data.name.trim(),
        phone: data.phone?.trim()
          ? normalizePhoneE164(data.phone.trim())
          : null,
        email: data.email?.trim() || null,
        unsubscribeToken: newUnsubscribeToken(),
      },
    });

    await this.consent.record({
      organizationId: orgId,
      subjectType: "customer",
      subjectId: customer.id,
      purpose: DPDP_PURPOSES.SERVICE,
      granted: true,
      source: "admin_crm",
      actorUserId,
    });

    if (emailOptIn) {
      await this.customerPrivacy.setMarketingEmailOptIn(
        orgId,
        customer.id,
        true,
        "admin_crm",
        { actorUserId },
      );
    }
    if (smsOptIn) {
      await this.customerPrivacy.setMarketingSmsOptIn(
        orgId,
        customer.id,
        true,
        "admin_crm",
        { actorUserId },
      );
    }

    return this.prisma.customer.findUniqueOrThrow({ where: { id: customer.id } });
  }

  async update(
    orgId: string,
    id: string,
    data: {
      name?: string;
      phone?: string;
      email?: string;
      marketingEmailOptIn?: boolean;
      marketingSmsOptIn?: boolean;
    },
    actorUserId?: string,
  ) {
    await this.get(orgId, id);
    const updated = await this.prisma.customer.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.phone !== undefined
          ? {
              phone: data.phone?.trim()
                ? normalizePhoneE164(data.phone.trim())
                : null,
            }
          : {}),
        ...(data.email !== undefined ? { email: data.email?.trim() || null } : {}),
      },
    });

    if (data.marketingEmailOptIn !== undefined) {
      await this.customerPrivacy.setMarketingEmailOptIn(
        orgId,
        id,
        data.marketingEmailOptIn,
        "admin_crm",
        { actorUserId },
      );
    }
    if (data.marketingSmsOptIn !== undefined) {
      await this.customerPrivacy.setMarketingSmsOptIn(
        orgId,
        id,
        data.marketingSmsOptIn,
        "admin_crm",
        { actorUserId },
      );
    }

    await this.audit.log({
      organizationId: orgId,
      userId: actorUserId,
      action: "customer_updated",
      entityType: "Customer",
      entityId: id,
    });

    return this.prisma.customer.findUniqueOrThrow({ where: { id } });
  }
}

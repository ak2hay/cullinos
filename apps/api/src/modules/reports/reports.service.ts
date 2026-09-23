import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { foodCostPct, ingredientCostForSales } from "../../common/food-cost.util";

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  list(orgId: string) {
    return this.prisma.analyticsSnapshot.findMany({
      where: { organizationId: orgId },
      take: 200,
    });
  }

  async smbSummary(orgId: string, outletId?: string, date?: string) {
    const dayStart = date ? new Date(date) : new Date();
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const [orders, wastage, attendance] = await Promise.all([
      this.prisma.order.findMany({
        where: {
          organizationId: orgId,
          status: { in: ["completed", "confirmed", "ready", "served"] },
          createdAt: { gte: dayStart, lt: dayEnd },
          ...(outletId ? { outletId } : {}),
        },
        include: { items: true },
      }),
      this.prisma.wastage.findMany({
        where: {
          recordedAt: { gte: dayStart, lt: dayEnd },
        },
        take: 100,
      }),
      this.prisma.attendanceRecord.findMany({
        where: {
          date: { gte: dayStart, lt: dayEnd },
          employee: { organizationId: orgId },
        },
        take: 100,
      }),
    ]);

    const revenue = orders.reduce((s, o) => s + Number(o.total), 0);
    const tips = orders.reduce((s, o) => s + Number(o.tipAmount), 0);
    const itemCounts = new Map<string, number>();
    const hourCounts = new Map<number, number>();

    for (const order of orders) {
      const hour = order.createdAt.getHours();
      hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1);
      for (const item of order.items) {
        itemCounts.set(item.name, (itemCounts.get(item.name) ?? 0) + item.quantity);
      }
    }

    const topItems = [...itemCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, quantity]) => ({ name, quantity }));

    const peakHours = [...hourCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([hour, orders]) => ({ hour, orders }));

    const expiringSoon = await this.prisma.inventoryItem.findMany({
      where: {
        organizationId: orgId,
        expiryDate: { lte: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) },
        ...(outletId ? { outletId } : {}),
      },
      take: 20,
    });

    return {
      date: dayStart.toISOString().slice(0, 10),
      revenue,
      tips,
      orderCount: orders.length,
      averageOrderValue: orders.length ? revenue / orders.length : 0,
      topItems,
      peakHours,
      wastageCount: wastage.length,
      wastageItems: wastage,
      staffPresent: attendance.filter((a) => a.status === "present").length,
      expiringInventory: expiringSoon,
    };
  }

  /** Export-friendly order summary rows for a date range (CSV-ish JSON). */
  async export(orgId: string, from?: string, to?: string, outletId?: string) {
    const fromDate = from ? new Date(from) : new Date();
    fromDate.setHours(0, 0, 0, 0);
    const toDate = to ? new Date(to) : new Date(fromDate);
    toDate.setHours(23, 59, 59, 999);
    if (!to) {
      // default: single day from `from` (or today)
      toDate.setTime(fromDate.getTime());
      toDate.setHours(23, 59, 59, 999);
    }

    const orders = await this.prisma.order.findMany({
      where: {
        organizationId: orgId,
        createdAt: { gte: fromDate, lte: toDate },
        ...(outletId ? { outletId } : {}),
      },
      orderBy: { createdAt: "asc" },
      take: 5000,
      select: {
        id: true,
        orderNumber: true,
        outletId: true,
        status: true,
        type: true,
        source: true,
        subtotal: true,
        taxTotal: true,
        discountTotal: true,
        tipAmount: true,
        total: true,
        createdAt: true,
        completedAt: true,
      },
    });

    const rows = orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      outletId: o.outletId,
      status: o.status,
      type: o.type,
      source: o.source,
      subtotal: Number(o.subtotal),
      taxTotal: Number(o.taxTotal),
      discountTotal: Number(o.discountTotal),
      tipAmount: Number(o.tipAmount),
      total: Number(o.total),
      createdAt: o.createdAt.toISOString(),
      completedAt: o.completedAt?.toISOString() ?? null,
    }));

    return {
      from: fromDate.toISOString().slice(0, 10),
      to: toDate.toISOString().slice(0, 10),
      count: rows.length,
      rows,
    };
  }

  private dateRange(from?: string, to?: string) {
    const fromDate = from ? new Date(from) : new Date();
    fromDate.setHours(0, 0, 0, 0);
    const toDate = to ? new Date(to) : new Date(fromDate);
    toDate.setHours(23, 59, 59, 999);
    if (!to) {
      toDate.setTime(fromDate.getTime());
      toDate.setHours(23, 59, 59, 999);
    }
    return { fromDate, toDate };
  }

  private orderWhere(
    orgId: string,
    params: { outletId?: string; from?: string; to?: string },
    statuses?: string[],
  ) {
    const { fromDate, toDate } = this.dateRange(params.from, params.to);
    return {
      organizationId: orgId,
      createdAt: { gte: fromDate, lte: toDate },
      ...(params.outletId ? { outletId: params.outletId } : {}),
      ...(statuses ? { status: { in: statuses as never[] } } : {}),
    };
  }

  async itemWiseSummary(
    orgId: string,
    params: { outletId?: string; from?: string; to?: string },
  ) {
    const orders = await this.prisma.order.findMany({
      where: this.orderWhere(orgId, params, [
        "completed",
        "confirmed",
        "preparing",
        "ready",
        "served",
      ]),
      include: { items: true },
      take: 5000,
    });

    const map = new Map<
      string,
      { name: string; quantity: number; revenue: number }
    >();
    for (const order of orders) {
      for (const item of order.items) {
        const row = map.get(item.name) ?? {
          name: item.name,
          quantity: 0,
          revenue: 0,
        };
        row.quantity += item.quantity;
        row.revenue += Number(item.total);
        map.set(item.name, row);
      }
    }

    const items = [...map.values()].sort((a, b) => b.revenue - a.revenue);
    return {
      from: this.dateRange(params.from, params.to).fromDate.toISOString().slice(0, 10),
      to: this.dateRange(params.from, params.to).toDate.toISOString().slice(0, 10),
      items,
      totalItems: items.reduce((s, i) => s + i.quantity, 0),
      totalRevenue: items.reduce((s, i) => s + i.revenue, 0),
    };
  }

  async categorySummary(
    orgId: string,
    params: { outletId?: string; from?: string; to?: string },
  ) {
    const orders = await this.prisma.order.findMany({
      where: this.orderWhere(orgId, params, [
        "completed",
        "confirmed",
        "preparing",
        "ready",
        "served",
      ]),
      include: {
        items: {
          include: {
            menuItem: { include: { category: { select: { name: true } } } },
          },
        },
      },
      take: 5000,
    });

    const map = new Map<string, { category: string; quantity: number; revenue: number }>();
    for (const order of orders) {
      for (const item of order.items) {
        const category = item.menuItem?.category?.name ?? "Uncategorized";
        const row = map.get(category) ?? { category, quantity: 0, revenue: 0 };
        row.quantity += item.quantity;
        row.revenue += Number(item.total);
        map.set(category, row);
      }
    }

    const categories = [...map.values()].sort((a, b) => b.revenue - a.revenue);
    return {
      from: this.dateRange(params.from, params.to).fromDate.toISOString().slice(0, 10),
      to: this.dateRange(params.from, params.to).toDate.toISOString().slice(0, 10),
      categories,
    };
  }

  async paymentMethodSummary(
    orgId: string,
    params: { outletId?: string; from?: string; to?: string },
  ) {
    const orders = await this.prisma.order.findMany({
      where: this.orderWhere(orgId, params, [
        "completed",
        "confirmed",
        "preparing",
        "ready",
        "served",
      ]),
      include: { payments: { include: { paymentMethod: true } } },
      take: 5000,
    });

    const map = new Map<string, { method: string; count: number; amount: number }>();
    for (const order of orders) {
      if (order.payments.length === 0) {
        const row = map.get("unpaid") ?? { method: "unpaid", count: 0, amount: 0 };
        row.count += 1;
        row.amount += Number(order.total);
        map.set("unpaid", row);
        continue;
      }
      for (const payment of order.payments) {
        const method = payment.paymentMethod?.name ?? payment.paymentMethod?.code ?? "other";
        const row = map.get(method) ?? { method, count: 0, amount: 0 };
        row.count += 1;
        row.amount += Number(payment.amount);
        map.set(method, row);
      }
    }

    return {
      from: this.dateRange(params.from, params.to).fromDate.toISOString().slice(0, 10),
      to: this.dateRange(params.from, params.to).toDate.toISOString().slice(0, 10),
      methods: [...map.values()].sort((a, b) => b.amount - a.amount),
    };
  }

  async discountSummary(
    orgId: string,
    params: { outletId?: string; from?: string; to?: string },
  ) {
    const orders = await this.prisma.order.findMany({
      where: {
        ...this.orderWhere(orgId, params),
        discountTotal: { gt: 0 },
      },
      include: { discounts: true },
      take: 5000,
    });

    const totalDiscount = orders.reduce((s, o) => s + Number(o.discountTotal), 0);
    const byType = new Map<string, { type: string; count: number; amount: number }>();
    for (const order of orders) {
      for (const d of order.discounts) {
        const row = byType.get(d.type) ?? { type: d.type, count: 0, amount: 0 };
        row.count += 1;
        row.amount += Number(d.amount);
        byType.set(d.type, row);
      }
    }

    return {
      from: this.dateRange(params.from, params.to).fromDate.toISOString().slice(0, 10),
      to: this.dateRange(params.from, params.to).toDate.toISOString().slice(0, 10),
      orderCount: orders.length,
      totalDiscount,
      byType: [...byType.values()].sort((a, b) => b.amount - a.amount),
    };
  }

  async cancellationSummary(
    orgId: string,
    params: { outletId?: string; from?: string; to?: string },
  ) {
    const orders = await this.prisma.order.findMany({
      where: this.orderWhere(orgId, params, ["cancelled", "voided"]),
      select: {
        id: true,
        orderNumber: true,
        status: true,
        total: true,
        createdAt: true,
        outletId: true,
      },
      take: 5000,
    });

    const byStatus = new Map<string, number>();
    for (const order of orders) {
      byStatus.set(order.status, (byStatus.get(order.status) ?? 0) + 1);
    }

    return {
      from: this.dateRange(params.from, params.to).fromDate.toISOString().slice(0, 10),
      to: this.dateRange(params.from, params.to).toDate.toISOString().slice(0, 10),
      count: orders.length,
      lostRevenue: orders.reduce((s, o) => s + Number(o.total), 0),
      byStatus: [...byStatus.entries()].map(([status, count]) => ({ status, count })),
      orders: orders.slice(0, 100),
    };
  }

  /** Per menu-item food cost % over a date range. */
  async foodCost(
    orgId: string,
    params: { outletId?: string; from?: string; to?: string },
  ) {
    const orders = await this.prisma.order.findMany({
      where: this.orderWhere(orgId, params, [
        "completed",
        "confirmed",
        "preparing",
        "ready",
        "served",
      ]),
      include: { items: true },
      take: 5000,
    });

    const sales = new Map<
      string,
      { menuItemId: string; name: string; qtySold: number; revenue: number }
    >();
    for (const order of orders) {
      for (const item of order.items) {
        if (!item.menuItemId) continue;
        const row = sales.get(item.menuItemId) ?? {
          menuItemId: item.menuItemId,
          name: item.name,
          qtySold: 0,
          revenue: 0,
        };
        row.qtySold += item.quantity;
        row.revenue += Number(item.total);
        sales.set(item.menuItemId, row);
      }
    }

    const menuItemIds = [...sales.keys()];
    const recipes = menuItemIds.length
      ? await this.prisma.recipe.findMany({
          where: {
            menuItemId: { in: menuItemIds },
            menuItem: { organizationId: orgId },
          },
          include: {
            ingredients: {
              include: {
                inventoryItem: { select: { id: true, costPerUnit: true } },
                subRecipe: {
                  include: {
                    ingredients: {
                      include: {
                        inventoryItem: { select: { id: true, costPerUnit: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        })
      : [];
    const recipeByMenu = new Map(recipes.map((r) => [r.menuItemId, r]));

    const costCache = new Map<string, number>();

    const recipeBatchCost = (
      recipe: {
        id: string;
        yield: unknown;
        ingredients: Array<{
          quantity: unknown;
          inventoryItemId: string | null;
          subRecipeId: string | null;
          inventoryItem: { costPerUnit: unknown } | null;
          subRecipe: {
            id: string;
            yield: unknown;
            ingredients: Array<{
              quantity: unknown;
              inventoryItemId: string | null;
              inventoryItem: { costPerUnit: unknown } | null;
            }>;
          } | null;
        }>;
      },
      visited: Set<string>,
    ): number => {
      if (costCache.has(recipe.id)) return costCache.get(recipe.id)!;
      if (visited.has(recipe.id)) return 0;
      visited.add(recipe.id);

      let batch = 0;
      for (const ing of recipe.ingredients) {
        const qty = Number(ing.quantity);
        if (ing.inventoryItemId && ing.inventoryItem) {
          batch += qty * Number(ing.inventoryItem.costPerUnit);
        } else if (ing.subRecipeId && ing.subRecipe) {
          const subBatch = recipeBatchCost(ing.subRecipe as never, new Set(visited));
          const subYield = Number(ing.subRecipe.yield) > 0 ? Number(ing.subRecipe.yield) : 1;
          batch += (subBatch / subYield) * qty;
        }
      }
      costCache.set(recipe.id, batch);
      return batch;
    };

    const items = [...sales.values()].map((row) => {
      const recipe = recipeByMenu.get(row.menuItemId);
      let ingredientCost = 0;
      if (recipe) {
        const batchCost = recipeBatchCost(recipe, new Set());
        ingredientCost = ingredientCostForSales(
          [{ quantity: batchCost, unitCost: 1 }],
          Number(recipe.yield),
          row.qtySold,
        );
      }
      return {
        name: row.name,
        qtySold: row.qtySold,
        revenue: Math.round(row.revenue * 100) / 100,
        ingredientCost,
        foodCostPct: foodCostPct(ingredientCost, row.revenue),
      };
    });

    items.sort((a, b) => b.revenue - a.revenue);

    return {
      from: this.dateRange(params.from, params.to).fromDate.toISOString().slice(0, 10),
      to: this.dateRange(params.from, params.to).toDate.toISOString().slice(0, 10),
      items,
    };
  }

  /** Date-wise CGST / SGST / IGST / Excise collection from OrderTaxLine. */
  async taxCollection(
    orgId: string,
    params: { outletId?: string; from?: string; to?: string },
  ) {
    const { fromDate, toDate } = this.dateRange(params.from, params.to);
    const orders = await this.prisma.order.findMany({
      where: {
        organizationId: orgId,
        createdAt: { gte: fromDate, lte: toDate },
        status: { notIn: ["cancelled", "voided"] },
        ...(params.outletId ? { outletId: params.outletId } : {}),
      },
      select: {
        id: true,
        createdAt: true,
        taxLines: true,
      },
    });

    type Bucket = {
      date: string;
      cgst: number;
      sgst: number;
      igst: number;
      excise: number;
      other: number;
      total: number;
    };
    const byDate = new Map<string, Bucket>();

    const classify = (name: string): keyof Omit<Bucket, "date" | "total"> => {
      const n = name.toUpperCase();
      if (n.includes("CGST")) return "cgst";
      if (n.includes("SGST") || n.includes("UTGST")) return "sgst";
      if (n.includes("IGST")) return "igst";
      if (n.includes("EXCISE")) return "excise";
      return "other";
    };

    for (const order of orders) {
      const date = order.createdAt.toISOString().slice(0, 10);
      let bucket = byDate.get(date);
      if (!bucket) {
        bucket = { date, cgst: 0, sgst: 0, igst: 0, excise: 0, other: 0, total: 0 };
        byDate.set(date, bucket);
      }
      for (const line of order.taxLines) {
        const amt = Number(line.amount);
        if (!Number.isFinite(amt) || amt === 0) continue;
        const key = classify(line.taxName);
        bucket[key] += amt;
        bucket.total += amt;
      }
    }

    const days = [...byDate.values()]
      .map((b) => ({
        ...b,
        cgst: Math.round(b.cgst * 100) / 100,
        sgst: Math.round(b.sgst * 100) / 100,
        igst: Math.round(b.igst * 100) / 100,
        excise: Math.round(b.excise * 100) / 100,
        other: Math.round(b.other * 100) / 100,
        total: Math.round(b.total * 100) / 100,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const totals = days.reduce(
      (acc, d) => ({
        cgst: acc.cgst + d.cgst,
        sgst: acc.sgst + d.sgst,
        igst: acc.igst + d.igst,
        excise: acc.excise + d.excise,
        other: acc.other + d.other,
        total: acc.total + d.total,
      }),
      { cgst: 0, sgst: 0, igst: 0, excise: 0, other: 0, total: 0 },
    );

    return {
      from: fromDate.toISOString().slice(0, 10),
      to: toDate.toISOString().slice(0, 10),
      days,
      totals: {
        cgst: Math.round(totals.cgst * 100) / 100,
        sgst: Math.round(totals.sgst * 100) / 100,
        igst: Math.round(totals.igst * 100) / 100,
        excise: Math.round(totals.excise * 100) / 100,
        other: Math.round(totals.other * 100) / 100,
        total: Math.round(totals.total * 100) / 100,
      },
    };
  }

  /** Sales + tax aggregated by menu item tax group. */
  async salesByTaxGroup(
    orgId: string,
    params: { outletId?: string; from?: string; to?: string },
  ) {
    const { fromDate, toDate } = this.dateRange(params.from, params.to);
    const orders = await this.prisma.order.findMany({
      where: {
        organizationId: orgId,
        createdAt: { gte: fromDate, lte: toDate },
        status: { notIn: ["cancelled", "voided"] },
        ...(params.outletId ? { outletId: params.outletId } : {}),
      },
      select: {
        items: {
          select: {
            name: true,
            quantity: true,
            unitPrice: true,
            taxAmount: true,
            menuItemId: true,
            menuItem: {
              select: {
                taxGroupId: true,
                taxGroup: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });

    type Agg = {
      taxGroupId: string | null;
      taxGroupName: string;
      quantity: number;
      revenue: number;
      tax: number;
    };
    const map = new Map<string, Agg>();

    for (const order of orders) {
      for (const item of order.items) {
        const groupId = item.menuItem?.taxGroupId ?? null;
        const groupName = item.menuItem?.taxGroup?.name ?? "Unassigned";
        const key = groupId ?? "unassigned";
        let row = map.get(key);
        if (!row) {
          row = {
            taxGroupId: groupId,
            taxGroupName: groupName,
            quantity: 0,
            revenue: 0,
            tax: 0,
          };
          map.set(key, row);
        }
        row.quantity += item.quantity;
        row.revenue += Number(item.unitPrice) * item.quantity;
        row.tax += Number(item.taxAmount);
      }
    }

    const groups = [...map.values()]
      .map((g) => ({
        ...g,
        revenue: Math.round(g.revenue * 100) / 100,
        tax: Math.round(g.tax * 100) / 100,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    return {
      from: fromDate.toISOString().slice(0, 10),
      to: toDate.toISOString().slice(0, 10),
      groups,
    };
  }
}

import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

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
  async export(orgId: string, from?: string, to?: string) {
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
}

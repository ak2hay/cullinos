import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { toPaise } from "../../common/money.util";

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  list(orgId: string) {
    return this.prisma.analyticsSnapshot.findMany({
      where: { organizationId: orgId },
      take: 200,
    });
  }

  async daily(orgId: string, params: { date?: string; outletId?: string }) {
    const date = params.date ? new Date(params.date) : new Date();
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    const where = {
      organizationId: orgId,
      createdAt: { gte: start, lte: end },
      ...(params.outletId ? { outletId: params.outletId } : {}),
    };

    const orders = await this.prisma.order.findMany({
      where,
      include: { payments: { include: { paymentMethod: true } } },
    });

    const completed = orders.filter((o) =>
      ["completed", "confirmed", "preparing", "ready", "served"].includes(o.status),
    );
    const openOrders = orders.filter((o) =>
      ["draft", "confirmed", "preparing", "ready"].includes(o.status),
    ).length;
    const cancelledOrders = orders.filter((o) => o.status === "cancelled").length;
    const totalRevenue = completed.reduce((sum, o) => sum + Number(o.total), 0);
    const totalOrders = orders.length;
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    const hourlyMap = new Map<number, { orders: number; revenue: number }>();
    for (const order of completed) {
      const hour = order.createdAt.getHours();
      const row = hourlyMap.get(hour) ?? { orders: 0, revenue: 0 };
      row.orders += 1;
      row.revenue += Number(order.total);
      hourlyMap.set(hour, row);
    }

    const paymentMap = new Map<string, { count: number; amount: number }>();
    for (const order of completed) {
      for (const payment of order.payments) {
        const method = payment.paymentMethod?.code ?? "unpaid";
        const row = paymentMap.get(method) ?? { count: 0, amount: 0 };
        row.count += 1;
        row.amount += Number(payment.amount);
        paymentMap.set(method, row);
      }
      if (order.payments.length === 0) {
        const row = paymentMap.get("unpaid") ?? { count: 0, amount: 0 };
        row.count += 1;
        row.amount += Number(order.total);
        paymentMap.set("unpaid", row);
      }
    }

    return {
      date: start.toISOString().slice(0, 10),
      summary: {
        totalOrders,
        totalRevenue: toPaise(totalRevenue),
        averageOrderValue: toPaise(averageOrderValue),
        openOrders,
        cancelledOrders,
      },
      hourlyBreakdown: [...hourlyMap.entries()]
        .sort(([a], [b]) => a - b)
        .map(([hour, row]) => ({
          hour,
          orders: row.orders,
          revenue: toPaise(row.revenue),
        })),
      paymentBreakdown: [...paymentMap.entries()].map(([method, row]) => ({
        method,
        count: row.count,
        amount: toPaise(row.amount),
      })),
    };
  }

  async trend(orgId: string, params: { outletId?: string; days?: number }) {
    const days = Math.min(Math.max(params.days ?? 7, 1), 90);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date();
    start.setDate(start.getDate() - (days - 1));
    start.setHours(0, 0, 0, 0);

    const orders = await this.prisma.order.findMany({
      where: {
        organizationId: orgId,
        createdAt: { gte: start, lte: end },
        ...(params.outletId ? { outletId: params.outletId } : {}),
      },
      select: { createdAt: true, total: true, status: true },
    });

    const map = new Map<string, { revenue: number; orders: number }>();
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      map.set(d.toISOString().slice(0, 10), { revenue: 0, orders: 0 });
    }

    const completedStatuses = new Set([
      "completed",
      "confirmed",
      "preparing",
      "ready",
      "served",
    ]);
    for (const order of orders) {
      const key = order.createdAt.toISOString().slice(0, 10);
      const row = map.get(key);
      if (!row) continue;
      row.orders += 1;
      if (completedStatuses.has(order.status)) {
        row.revenue += Number(order.total);
      }
    }

    return {
      from: start.toISOString().slice(0, 10),
      to: end.toISOString().slice(0, 10),
      days: [...map.entries()].map(([date, row]) => ({
        date,
        revenue: toPaise(row.revenue),
        orders: row.orders,
      })),
    };
  }

  async outletComparison(
    orgId: string,
    params: {
      date?: string;
      brandId?: string;
      city?: string;
      zone?: string;
      state?: string;
    },
  ) {
    const date = params.date ? new Date(params.date) : new Date();
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    const outlets = await this.prisma.outlet.findMany({
      where: {
        organizationId: orgId,
        ...(params.brandId ? { brandId: params.brandId } : {}),
        ...(params.city ? { city: params.city } : {}),
        ...(params.zone ? { zone: params.zone } : {}),
        ...(params.state ? { state: params.state } : {}),
      },
    });

    const results = await Promise.all(
      outlets.map(async (outlet) => {
        const orders = await this.prisma.order.findMany({
          where: {
            outletId: outlet.id,
            createdAt: { gte: start, lte: end },
            status: { notIn: ["cancelled", "voided"] },
          },
        });
        const revenue = orders.reduce((sum, o) => sum + Number(o.total), 0);
        const count = orders.length;
        return {
          outletId: outlet.id,
          outletName: outlet.name,
          city: outlet.city,
          zone: outlet.zone,
          state: outlet.state,
          revenue: toPaise(revenue),
          orders: count,
          averageOrderValue: toPaise(count > 0 ? revenue / count : 0),
        };
      }),
    );

    return results.sort((a, b) => b.revenue - a.revenue);
  }

  async outletGeoFilters(orgId: string, brandId?: string) {
    const outlets = await this.prisma.outlet.findMany({
      where: {
        organizationId: orgId,
        ...(brandId ? { brandId } : {}),
      },
      select: { city: true, zone: true, state: true },
    });
    const cities = [...new Set(outlets.map((o) => o.city).filter(Boolean))].sort();
    const zones = [...new Set(outlets.map((o) => o.zone).filter(Boolean))].sort();
    const states = [...new Set(outlets.map((o) => o.state).filter(Boolean))].sort();
    return { cities, zones, states };
  }
}

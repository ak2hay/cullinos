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

  async outletComparison(orgId: string, params: { date?: string; brandId?: string }) {
    const date = params.date ? new Date(params.date) : new Date();
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    const outlets = await this.prisma.outlet.findMany({
      where: {
        organizationId: orgId,
        ...(params.brandId ? { brandId: params.brandId } : {}),
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
          revenue: toPaise(revenue),
          orders: count,
          averageOrderValue: toPaise(count > 0 ? revenue / count : 0),
        };
      }),
    );

    return results.sort((a, b) => b.revenue - a.revenue);
  }
}

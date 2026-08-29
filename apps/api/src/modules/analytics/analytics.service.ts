import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AnalyticsQueryDto, DailyDashboardQueryDto } from './dto/analytics-query.dto';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  private resolveRange(query: AnalyticsQueryDto): { gte: Date; lte: Date } {
    const end = query.endDate ? new Date(query.endDate) : new Date();
    end.setHours(23, 59, 59, 999);
    const start = query.startDate
      ? new Date(query.startDate)
      : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    start.setHours(0, 0, 0, 0);
    return { gte: start, lte: end };
  }

  private completedOrderWhere(orgId: string, range: { gte: Date; lte: Date }, outletId?: string) {
    return {
      organizationId: orgId,
      ...(outletId ? { outletId } : {}),
      createdAt: range,
      status: { in: ['COMPLETED', 'SERVED'] as string[] },
    };
  }

  async executiveDashboard(orgId: string, query: AnalyticsQueryDto) {
    const range = this.resolveRange(query);
    const where = this.completedOrderWhere(orgId, range, query.outletId);

    const [orderAgg, wastageAgg, kotItems, topItems, outletRevenue] = await Promise.all([
      this.prisma.client.order.aggregate({
        where,
        _count: { id: true },
        _sum: { totalAmount: true, subtotal: true },
        _avg: { totalAmount: true },
      }),
      this.prisma.client.wastageRecord.aggregate({
        where: {
          inventoryItem: { organizationId: orgId },
          ...(query.outletId ? { outletId: query.outletId } : {}),
          createdAt: range,
        },
        _sum: { value: true, quantity: true },
        _count: { id: true },
      }),
      this.prisma.client.kOTItem.findMany({
        where: {
          kot: { order: where },
          readyAt: { not: null },
          startedAt: { not: null },
        },
        select: { startedAt: true, readyAt: true },
      }),
      this.prisma.client.orderItem.groupBy({
        by: ['menuItemId', 'name'],
        where: { order: where },
        _sum: { quantity: true, totalPrice: true },
        orderBy: { _sum: { totalPrice: 'desc' } },
        take: 5,
      }),
      this.prisma.client.order.groupBy({
        by: ['outletId'],
        where,
        _sum: { totalAmount: true },
        orderBy: { _sum: { totalAmount: 'desc' } },
        take: 1,
      }),
    ]);

    const revenue = orderAgg._sum.totalAmount ?? 0;
    const orders = orderAgg._count.id;
    const aov = Math.round(orderAgg._avg.totalAmount ?? 0);

    const foodCostSnapshots = await this.prisma.client.foodCostSnapshot.findMany({
      where: {
        ...(query.outletId ? { outletId: query.outletId } : {}),
        snapshotAt: range,
      },
      select: { foodCostPct: true },
    });
    const foodCostPct =
      foodCostSnapshots.length > 0
        ? foodCostSnapshots.reduce((sum, s) => sum + s.foodCostPct, 0) / foodCostSnapshots.length
        : null;

    const kitchenAvgSeconds =
      kotItems.length > 0
        ? kotItems.reduce((sum, item) => {
            const seconds =
              (item.readyAt!.getTime() - item.startedAt!.getTime()) / 1000;
            return sum + seconds;
          }, 0) / kotItems.length
        : 0;

    let bestOutlet: { outletId: string; name: string; revenue: number } | null = null;
    if (outletRevenue.length > 0) {
      const top = outletRevenue[0];
      const outlet = await this.prisma.client.outlet.findUnique({
        where: { id: top.outletId },
        select: { name: true },
      });
      bestOutlet = {
        outletId: top.outletId,
        name: outlet?.name ?? top.outletId,
        revenue: top._sum.totalAmount ?? 0,
      };
    }

    return {
      period: { start: range.gte.toISOString(), end: range.lte.toISOString() },
      kpis: {
        revenue,
        orders,
        aov,
        foodCostPct: foodCostPct !== null ? Number(foodCostPct.toFixed(2)) : null,
        wastage: {
          recordCount: wastageAgg._count.id,
          totalValue: wastageAgg._sum.value ?? 0,
          totalQuantity: wastageAgg._sum.quantity ?? 0,
        },
        kitchenAvgTimeSeconds: Math.round(kitchenAvgSeconds),
      },
      topItems: topItems.map((i) => ({
        menuItemId: i.menuItemId,
        name: i.name,
        quantitySold: i._sum.quantity ?? 0,
        revenue: i._sum.totalPrice ?? 0,
      })),
      bestOutlet,
    };
  }

  async dailyDashboard(orgId: string, query: DailyDashboardQueryDto) {
    const date = query.date ? new Date(query.date) : new Date();
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    const where = this.completedOrderWhere(orgId, { gte: start, lte: end }, query.outletId);

    const [hourlyOrders, paymentBreakdown, openOrders, cancelledCount] = await Promise.all([
      this.prisma.client.order.findMany({
        where,
        select: { createdAt: true, totalAmount: true },
      }),
      this.prisma.client.payment.groupBy({
        by: ['method'],
        where: { order: where, status: 'COMPLETED' },
        _sum: { amount: true },
        _count: { id: true },
      }),
      this.prisma.client.order.count({
        where: {
          organizationId: orgId,
          ...(query.outletId ? { outletId: query.outletId } : {}),
          status: { in: ['CONFIRMED', 'PREPARING', 'READY', 'HELD'] },
        },
      }),
      this.prisma.client.order.count({
        where: {
          organizationId: orgId,
          ...(query.outletId ? { outletId: query.outletId } : {}),
          createdAt: { gte: start, lte: end },
          status: 'CANCELLED',
        },
      }),
    ]);

    const hourlyMap = new Map<number, { orders: number; revenue: number }>();
    for (let h = 0; h < 24; h++) hourlyMap.set(h, { orders: 0, revenue: 0 });
    for (const order of hourlyOrders) {
      const hour = order.createdAt.getHours();
      const bucket = hourlyMap.get(hour)!;
      bucket.orders += 1;
      bucket.revenue += order.totalAmount;
    }

    const totalRevenue = hourlyOrders.reduce((sum, o) => sum + o.totalAmount, 0);

    return {
      date: start.toISOString().slice(0, 10),
      summary: {
        totalOrders: hourlyOrders.length,
        totalRevenue,
        averageOrderValue: hourlyOrders.length > 0 ? Math.round(totalRevenue / hourlyOrders.length) : 0,
        openOrders,
        cancelledOrders: cancelledCount,
      },
      hourlyBreakdown: Array.from(hourlyMap.entries()).map(([hour, stats]) => ({
        hour,
        orders: stats.orders,
        revenue: stats.revenue,
      })),
      paymentBreakdown: paymentBreakdown.map((p) => ({
        method: p.method,
        count: p._count.id,
        amount: p._sum.amount ?? 0,
      })),
    };
  }
}

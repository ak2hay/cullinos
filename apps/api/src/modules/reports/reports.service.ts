import { Injectable } from '@nestjs/common';
import { Prisma } from '@cullinos/database';
import { PrismaService } from '../../prisma/prisma.service';
import { ReportQueryDto } from './dto/report-query.dto';
import { toCsv } from './utils/csv.util';

type ReportResult = { data: Record<string, unknown>[]; csv?: string };

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  private dateRange(query: ReportQueryDto): { gte: Date; lte: Date } {
    const start = new Date(query.startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(query.endDate);
    end.setHours(23, 59, 59, 999);
    return { gte: start, lte: end };
  }

  private orderWhere(orgId: string, query: ReportQueryDto): Prisma.OrderWhereInput {
    return {
      organizationId: orgId,
      ...(query.outletId ? { outletId: query.outletId } : {}),
      createdAt: this.dateRange(query),
      status: { in: ['COMPLETED', 'SERVED'] },
    };
  }

  private formatResult(rows: Record<string, unknown>[], format?: string): ReportResult {
    if (format === 'csv') {
      return { data: rows, csv: toCsv(rows) };
    }
    return { data: rows };
  }

  async salesReport(orgId: string, query: ReportQueryDto): Promise<ReportResult> {
    const orders = await this.prisma.client.order.groupBy({
      by: ['outletId'],
      where: this.orderWhere(orgId, query),
      _count: { id: true },
      _sum: {
        subtotal: true,
        discountAmount: true,
        taxAmount: true,
        totalAmount: true,
      },
    });

    const outlets = await this.prisma.client.outlet.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true },
    });
    const outletMap = new Map(outlets.map((o) => [o.id, o.name]));

    const rows = orders.map((o) => ({
      outletId: o.outletId,
      outletName: outletMap.get(o.outletId) ?? o.outletId,
      orderCount: o._count.id,
      subtotal: o._sum.subtotal ?? 0,
      discountAmount: o._sum.discountAmount ?? 0,
      taxAmount: o._sum.taxAmount ?? 0,
      totalAmount: o._sum.totalAmount ?? 0,
    }));

    return this.formatResult(rows, query.format);
  }

  async itemReport(orgId: string, query: ReportQueryDto): Promise<ReportResult> {
    const items = await this.prisma.client.orderItem.groupBy({
      by: ['menuItemId', 'name'],
      where: {
        order: this.orderWhere(orgId, query),
      },
      _sum: { quantity: true, totalPrice: true },
      _count: { id: true },
      orderBy: { _sum: { totalPrice: 'desc' } },
    });

    const rows = items.map((i) => ({
      menuItemId: i.menuItemId,
      itemName: i.name,
      quantitySold: i._sum.quantity ?? 0,
      revenue: i._sum.totalPrice ?? 0,
      orderLineCount: i._count.id,
    }));

    return this.formatResult(rows, query.format);
  }

  async categoryReport(orgId: string, query: ReportQueryDto): Promise<ReportResult> {
    const orderItems = await this.prisma.client.orderItem.findMany({
      where: { order: this.orderWhere(orgId, query) },
      select: {
        quantity: true,
        totalPrice: true,
        menuItem: {
          select: {
            category: { select: { id: true, name: true } },
          },
        },
      },
    });

    const categoryMap = new Map<string, { categoryName: string; quantity: number; revenue: number }>();
    for (const item of orderItems) {
      const cat = item.menuItem.category;
      const existing = categoryMap.get(cat.id) ?? {
        categoryName: cat.name,
        quantity: 0,
        revenue: 0,
      };
      existing.quantity += item.quantity;
      existing.revenue += item.totalPrice;
      categoryMap.set(cat.id, existing);
    }

    const rows = Array.from(categoryMap.entries())
      .map(([categoryId, stats]) => ({
        categoryId,
        categoryName: stats.categoryName,
        quantitySold: stats.quantity,
        revenue: stats.revenue,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    return this.formatResult(rows, query.format);
  }

  async outletReport(orgId: string, query: ReportQueryDto): Promise<ReportResult> {
    const outlets = await this.prisma.client.outlet.findMany({
      where: {
        organizationId: orgId,
        ...(query.outletId ? { id: query.outletId } : {}),
      },
      select: { id: true, name: true, city: true, isActive: true },
    });

    const rows = await Promise.all(
      outlets.map(async (outlet) => {
        const where = this.orderWhere(orgId, { ...query, outletId: outlet.id });
        const agg = await this.prisma.client.order.aggregate({
          where,
          _count: { id: true },
          _sum: { totalAmount: true, taxAmount: true },
          _avg: { totalAmount: true },
        });
        return {
          outletId: outlet.id,
          outletName: outlet.name,
          city: outlet.city ?? '',
          isActive: outlet.isActive,
          orderCount: agg._count.id,
          totalRevenue: agg._sum.totalAmount ?? 0,
          taxCollected: agg._sum.taxAmount ?? 0,
          averageOrderValue: Math.round(agg._avg.totalAmount ?? 0),
        };
      }),
    );

    return this.formatResult(rows, query.format);
  }

  async employeeReport(orgId: string, query: ReportQueryDto): Promise<ReportResult> {
    const orders = await this.prisma.client.order.groupBy({
      by: ['employeeId'],
      where: {
        ...this.orderWhere(orgId, query),
        employeeId: { not: null },
      },
      _count: { id: true },
      _sum: { totalAmount: true },
    });

    const employeeIds = orders.map((o) => o.employeeId!).filter(Boolean);
    const employees = await this.prisma.client.employee.findMany({
      where: { id: { in: employeeIds } },
      include: { user: { select: { firstName: true, lastName: true, email: true } } },
    });
    const empMap = new Map(employees.map((e) => [e.id, e]));

    const rows = orders.map((o) => {
      const emp = empMap.get(o.employeeId!);
      const name = emp?.user
        ? `${emp.user.firstName} ${emp.user.lastName}`
        : emp?.employeeCode ?? o.employeeId;
      return {
        employeeId: o.employeeId,
        employeeName: name,
        orderCount: o._count.id,
        totalSales: o._sum.totalAmount ?? 0,
      };
    });

    return this.formatResult(rows, query.format);
  }

  async paymentReport(orgId: string, query: ReportQueryDto): Promise<ReportResult> {
    const payments = await this.prisma.client.payment.groupBy({
      by: ['method', 'status'],
      where: {
        order: this.orderWhere(orgId, query),
        status: 'COMPLETED',
      },
      _count: { id: true },
      _sum: { amount: true, tipAmount: true },
    });

    const rows = payments.map((p) => ({
      method: p.method,
      status: p.status,
      transactionCount: p._count.id,
      amount: p._sum.amount ?? 0,
      tips: p._sum.tipAmount ?? 0,
    }));

    return this.formatResult(rows, query.format);
  }

  async taxReport(orgId: string, query: ReportQueryDto): Promise<ReportResult> {
    const orders = await this.prisma.client.order.findMany({
      where: this.orderWhere(orgId, query),
      select: {
        outletId: true,
        subtotal: true,
        taxAmount: true,
        totalAmount: true,
        createdAt: true,
      },
    });

    const byDate = new Map<string, { subtotal: number; taxAmount: number; totalAmount: number; count: number }>();
    for (const order of orders) {
      const dateKey = order.createdAt.toISOString().slice(0, 10);
      const existing = byDate.get(dateKey) ?? { subtotal: 0, taxAmount: 0, totalAmount: 0, count: 0 };
      existing.subtotal += order.subtotal;
      existing.taxAmount += order.taxAmount;
      existing.totalAmount += order.totalAmount;
      existing.count += 1;
      byDate.set(dateKey, existing);
    }

    const rows = Array.from(byDate.entries())
      .map(([date, stats]) => ({
        date,
        orderCount: stats.count,
        subtotal: stats.subtotal,
        taxAmount: stats.taxAmount,
        totalAmount: stats.totalAmount,
        effectiveTaxRate: stats.subtotal > 0 ? ((stats.taxAmount / stats.subtotal) * 100).toFixed(2) : '0.00',
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return this.formatResult(rows, query.format);
  }

  async inventoryReport(orgId: string, query: ReportQueryDto): Promise<ReportResult> {
    const items = await this.prisma.client.inventoryItem.findMany({
      where: {
        organizationId: orgId,
        isActive: true,
        deletedAt: null,
      },
      include: {
        stocks: {
          where: query.outletId ? { outletId: query.outletId } : undefined,
          select: { outletId: true, quantity: true },
        },
      },
    });

    const movements = await this.prisma.client.stockMovement.groupBy({
      by: ['inventoryItemId', 'type'],
      where: {
        inventoryItem: { organizationId: orgId },
        ...(query.outletId ? { outletId: query.outletId } : {}),
        createdAt: this.dateRange(query),
      },
      _sum: { quantity: true },
    });

    const movementMap = new Map<string, Record<string, number>>();
    for (const m of movements) {
      const key = m.inventoryItemId;
      const existing = movementMap.get(key) ?? {};
      existing[m.type] = (existing[m.type] ?? 0) + (m._sum.quantity ?? 0);
      movementMap.set(key, existing);
    }

    const rows = items.map((item) => {
      const totalStock = item.stocks.reduce((sum, s) => sum + s.quantity, 0);
      const moves = movementMap.get(item.id) ?? {};
      return {
        inventoryItemId: item.id,
        name: item.name,
        sku: item.sku ?? '',
        unit: item.unit,
        currentStock: totalStock,
        minStock: item.minStock,
        reorderLevel: item.reorderLevel,
        belowReorder: totalStock <= item.reorderLevel,
        costPerUnit: item.costPerUnit,
        stockValue: Math.round(totalStock * item.costPerUnit),
        movements: JSON.stringify(moves),
      };
    });

    return this.formatResult(rows, query.format);
  }

  async kitchenReport(orgId: string, query: ReportQueryDto): Promise<ReportResult> {
    const kotItems = await this.prisma.client.kOTItem.findMany({
      where: {
        kot: {
          order: this.orderWhere(orgId, query),
        },
        readyAt: { not: null },
        startedAt: { not: null },
      },
      select: {
        id: true,
        name: true,
        quantity: true,
        status: true,
        startedAt: true,
        readyAt: true,
        kitchenStation: { select: { id: true, name: true } },
      },
    });

    const stationStats = new Map<
      string,
      { stationName: string; itemCount: number; totalPrepSeconds: number }
    >();

    for (const item of kotItems) {
      const stationId = item.kitchenStation?.id ?? 'unassigned';
      const stationName = item.kitchenStation?.name ?? 'Unassigned';
      const prepSeconds =
        item.readyAt && item.startedAt
          ? (item.readyAt.getTime() - item.startedAt.getTime()) / 1000
          : 0;

      const existing = stationStats.get(stationId) ?? {
        stationName,
        itemCount: 0,
        totalPrepSeconds: 0,
      };
      existing.itemCount += item.quantity;
      existing.totalPrepSeconds += prepSeconds;
      stationStats.set(stationId, existing);
    }

    const rows = Array.from(stationStats.entries()).map(([stationId, stats]) => ({
      stationId,
      stationName: stats.stationName,
      itemsPrepared: stats.itemCount,
      avgPrepTimeSeconds:
        stats.itemCount > 0 ? Math.round(stats.totalPrepSeconds / stats.itemCount) : 0,
    }));

    return this.formatResult(rows, query.format);
  }

  async deliveryReport(orgId: string, query: ReportQueryDto): Promise<ReportResult> {
    const deliveries = await this.prisma.client.deliveryOrder.findMany({
      where: {
        order: this.orderWhere(orgId, query),
      },
      select: {
        id: true,
        status: true,
        deliveryCharge: true,
        estimatedAt: true,
        deliveredAt: true,
        createdAt: true,
        order: { select: { orderNumber: true, totalAmount: true, outletId: true } },
      },
    });

    const rows = deliveries.map((d) => {
      const deliveryMinutes =
        d.deliveredAt && d.createdAt
          ? Math.round((d.deliveredAt.getTime() - d.createdAt.getTime()) / 60000)
          : null;
      return {
        deliveryOrderId: d.id,
        orderNumber: d.order.orderNumber,
        status: d.status,
        deliveryCharge: d.deliveryCharge,
        orderTotal: d.order.totalAmount,
        deliveryMinutes,
        estimatedAt: d.estimatedAt?.toISOString() ?? '',
        deliveredAt: d.deliveredAt?.toISOString() ?? '',
      };
    });

    return this.formatResult(rows, query.format);
  }

  async wastageReport(orgId: string, query: ReportQueryDto): Promise<ReportResult> {
    const records = await this.prisma.client.wastageRecord.findMany({
      where: {
        inventoryItem: { organizationId: orgId },
        ...(query.outletId ? { outletId: query.outletId } : {}),
        createdAt: this.dateRange(query),
      },
      include: {
        inventoryItem: { select: { id: true, name: true, sku: true, unit: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const rows = records.map((r) => ({
      wastageId: r.id,
      inventoryItemId: r.inventoryItemId,
      itemName: r.inventoryItem.name,
      sku: r.inventoryItem.sku ?? '',
      unit: r.inventoryItem.unit,
      quantity: r.quantity,
      reason: r.reason,
      value: r.value,
      outletId: r.outletId,
      recordedAt: r.createdAt.toISOString(),
    }));

    return this.formatResult(rows, query.format);
  }
}

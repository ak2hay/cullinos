import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OrdersService } from '../orders/orders.service';
import { QuickOrderDto } from './dto/pos.dto';

@Injectable()
export class PosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ordersService: OrdersService,
  ) {}

  async quickOrder(
    organizationId: string,
    userId: string,
    dto: QuickOrderDto,
    idempotencyKey?: string,
  ) {
    const created = await this.ordersService.createOrder(
      organizationId,
      userId,
      {
        outletId: dto.outletId,
        source: 'POS',
        orderType: dto.tableId ? 'DINE_IN' : 'TAKEAWAY',
        tableId: dto.tableId,
        customerId: dto.customerId,
        items: dto.items,
      },
      idempotencyKey,
    );

    const orderId =
      typeof created === 'object' && created !== null && 'id' in created
        ? String((created as { id: string }).id)
        : null;

    if (dto.autoConfirm !== false && orderId) {
      return this.ordersService.confirmOrder(organizationId, userId, orderId);
    }

    return created;
  }

  async holdOrder(organizationId: string, userId: string, orderId: string) {
    return this.ordersService.holdOrder(organizationId, userId, orderId);
  }

  async resumeOrder(organizationId: string, userId: string, orderId: string) {
    return this.ordersService.resumeOrder(organizationId, userId, orderId);
  }

  async getDaySummary(outletId: string, organizationId: string) {
    const outlet = await this.prisma.client.outlet.findFirst({
      where: { id: outletId, organizationId },
    });
    if (!outlet) throw new NotFoundException('Outlet not found');

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const orders = await this.prisma.client.order.findMany({
      where: {
        outletId,
        organizationId,
        createdAt: { gte: startOfDay, lte: endOfDay },
      },
      include: { payments: true },
    });

    const completed = orders.filter((o) => o.status === 'COMPLETED');
    const cancelled = orders.filter((o) => o.status === 'CANCELLED');
    const held = orders.filter((o) => o.status === 'HELD' || o.isHeld);
    const open = orders.filter(
      (o) => !['COMPLETED', 'CANCELLED', 'REFUNDED'].includes(o.status),
    );

    const grossSales = completed.reduce((sum, o) => sum + o.totalAmount, 0);
    const totalDiscount = completed.reduce((sum, o) => sum + o.discountAmount, 0);
    const totalTax = completed.reduce((sum, o) => sum + o.taxAmount, 0);
    const orderCount = completed.length;

    const paymentsByMethod = completed.flatMap((o) => o.payments).reduce(
      (acc, p) => {
        if (p.status === 'COMPLETED') {
          acc[p.method] = (acc[p.method] ?? 0) + p.amount;
        }
        return acc;
      },
      {} as Record<string, number>,
    );

    const avgOrderValue = orderCount > 0 ? Math.round(grossSales / orderCount) : 0;

    return {
      outletId,
      date: startOfDay.toISOString().slice(0, 10),
      summary: {
        totalOrders: orders.length,
        completedOrders: orderCount,
        cancelledOrders: cancelled.length,
        heldOrders: held.length,
        openOrders: open.length,
        grossSales,
        totalDiscount,
        totalTax,
        netSales: grossSales - totalDiscount,
        avgOrderValue,
        paymentsByMethod,
      },
      orders: {
        completed: completed.length,
        cancelled: cancelled.length,
        held: held.length,
        open: open.length,
      },
    };
  }
}

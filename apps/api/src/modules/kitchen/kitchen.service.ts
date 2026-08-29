import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { KotService } from '../kot/kot.service';
import { UpdateKitchenItemStatusDto } from './dto/kitchen.dto';

@Injectable()
export class KitchenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly kotService: KotService,
  ) {}

  async getDisplayData(outletId: string, organizationId: string, stationId?: string) {
    const outlet = await this.prisma.client.outlet.findFirst({
      where: { id: outletId, organizationId },
    });
    if (!outlet) throw new NotFoundException('Outlet not found');

    const orders = await this.prisma.client.order.findMany({
      where: { outletId, organizationId },
      select: { id: true },
    });
    const orderIds = orders.map((o) => o.id);

    const kots = await this.prisma.client.kOT.findMany({
      where: {
        orderId: { in: orderIds },
        status: { in: ['NEW', 'PREPARING', 'READY'] },
      },
      include: {
        items: {
          where: stationId ? { kitchenStationId: stationId } : undefined,
          include: { kitchenStation: true },
        },
        order: {
          select: {
            orderNumber: true,
            tableId: true,
            orderType: true,
            table: { select: { name: true } },
          },
        },
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    });

    const stations = await this.prisma.client.kitchenStation.findMany({
      where: { outletId, isActive: true },
      orderBy: { name: 'asc' },
    });

    const activeKots = kots.filter((k) => k.items.length > 0);

    const byStation = stations.map((station) => ({
      station,
      kots: activeKots
        .map((kot) => ({
          ...kot,
          items: kot.items.filter((i) => i.kitchenStationId === station.id),
        }))
        .filter((kot) => kot.items.length > 0),
    }));

    return {
      outletId,
      stations: byStation,
      allKots: activeKots,
    };
  }

  async updateItemStatus(
    organizationId: string,
    userId: string,
    itemId: string,
    dto: UpdateKitchenItemStatusDto,
  ) {
    return this.kotService.updateKotItemStatus(organizationId, userId, itemId, {
      status: dto.status,
    });
  }

  async getPerformanceStats(outletId: string, organizationId: string) {
    const outlet = await this.prisma.client.outlet.findFirst({
      where: { id: outletId, organizationId },
    });
    if (!outlet) throw new NotFoundException('Outlet not found');

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const orders = await this.prisma.client.order.findMany({
      where: { outletId, organizationId },
      select: { id: true },
    });
    const orderIds = orders.map((o) => o.id);

    const [kots, kotItems] = await Promise.all([
      this.prisma.client.kOT.findMany({
        where: { orderId: { in: orderIds }, createdAt: { gte: startOfDay } },
        include: { items: true },
      }),
      this.prisma.client.kOTItem.findMany({
        where: {
          kot: { orderId: { in: orderIds } },
          createdAt: { gte: startOfDay },
        },
      }),
    ]);

    const completedItems = kotItems.filter(
      (i) => i.status === 'READY' || i.status === 'SERVED',
    );

    const prepTimes = completedItems
      .filter((i) => i.startedAt && i.readyAt)
      .map((i) => (i.readyAt!.getTime() - i.startedAt!.getTime()) / 1000);

    const avgPrepTimeSeconds =
      prepTimes.length > 0
        ? Math.round(prepTimes.reduce((a, b) => a + b, 0) / prepTimes.length)
        : 0;

    const byStatus = kotItems.reduce(
      (acc, item) => {
        acc[item.status] = (acc[item.status] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const byStation = await this.prisma.client.kitchenStation.findMany({
      where: { outletId },
      include: {
        kotItems: {
          where: { createdAt: { gte: startOfDay } },
        },
      },
    });

    return {
      outletId,
      date: startOfDay.toISOString().slice(0, 10),
      totalKots: kots.length,
      totalItems: kotItems.length,
      completedItems: completedItems.length,
      avgPrepTimeSeconds,
      itemsByStatus: byStatus,
      stationStats: byStation.map((s) => ({
        stationId: s.id,
        stationName: s.name,
        itemCount: s.kotItems.length,
        completed: s.kotItems.filter((i) => i.status === 'READY' || i.status === 'SERVED').length,
      })),
    };
  }
}

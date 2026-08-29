import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DOMAIN_EVENTS } from '@cullinos/events';
import { KOTStatus } from '@cullinos/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EventsService } from '../../events/events.service';
import { WebsocketGateway } from '../../websocket/websocket.gateway';
import { UpdateKotStatusDto, UpdateKotItemStatusDto } from './dto/kot.dto';

@Injectable()
export class KotService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: EventsService,
    private readonly websocket: WebsocketGateway,
  ) {}

  async generateKotsFromOrder(
    organizationId: string,
    orderId: string,
    userId?: string,
  ) {
    const order = await this.prisma.client.order.findFirst({
      where: { id: orderId, organizationId },
      include: {
        items: {
          where: { kotId: null },
          include: {
            menuItem: { include: { kitchenStation: true } },
          },
        },
        outlet: true,
      },
    });

    if (!order) throw new NotFoundException('Order not found');
    if (!order.items.length) {
      throw new BadRequestException('No unassigned items to generate KOTs');
    }

    const byStation = new Map<string | null, typeof order.items>();
    for (const item of order.items) {
      const stationId = item.menuItem.kitchenStationId ?? null;
      const group = byStation.get(stationId) ?? [];
      group.push(item);
      byStation.set(stationId, group);
    }

    const existingKotCount = await this.prisma.client.kOT.count({
      where: { orderId },
    });

    const kots = await this.prisma.client.$transaction(async (tx) => {
      const created = [];
      let kotIndex = existingKotCount + 1;

      for (const [stationId, items] of byStation.entries()) {
        const kotNumber = `${order.orderNumber}-K${String(kotIndex).padStart(2, '0')}`;
        kotIndex++;

        const kot = await tx.kOT.create({
          data: {
            orderId,
            kotNumber,
            status: 'NEW',
            items: {
              create: items.map((item) => ({
                kitchenStationId: stationId ?? undefined,
                name: item.name,
                quantity: item.quantity,
                status: 'NEW',
                notes: item.notes ?? undefined,
              })),
            },
          },
          include: { items: true },
        });

        await tx.orderItem.updateMany({
          where: { id: { in: items.map((i) => i.id) } },
          data: { kotId: kot.id, status: 'SENT_TO_KITCHEN' },
        });

        created.push(kot);
      }

      return created;
    });

    for (const kot of kots) {
      await this.events.publish({
        type: DOMAIN_EVENTS.KOT_CREATED,
        organizationId,
        outletId: order.outletId,
        payload: { kotId: kot.id, orderId, kotNumber: kot.kotNumber },
      });

      this.websocket.emitKotCreated(order.outletId, {
        kotId: kot.id,
        orderId,
        kotNumber: kot.kotNumber,
        status: kot.status,
        items: kot.items,
      });
    }

    if (userId) {
      await this.audit.log({
        organizationId,
        userId,
        outletId: order.outletId,
        action: 'GENERATE',
        entityType: 'KOT',
        entityId: orderId,
        newValue: { kotCount: kots.length },
      });
    }

    return kots;
  }

  async listKotsForOutlet(
    outletId: string,
    organizationId: string,
    status?: string,
    limit = 50,
  ) {
    const orders = await this.prisma.client.order.findMany({
      where: { outletId, organizationId },
      select: { id: true },
    });
    const orderIds = orders.map((o) => o.id);

    return this.prisma.client.kOT.findMany({
      where: {
        orderId: { in: orderIds },
        ...(status ? { status } : {}),
      },
      include: {
        items: { include: { kitchenStation: true } },
        order: { select: { orderNumber: true, tableId: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getKot(id: string, organizationId: string) {
    const kot = await this.prisma.client.kOT.findFirst({
      where: { id, order: { organizationId } },
      include: {
        items: { include: { kitchenStation: true } },
        order: true,
      },
    });
    if (!kot) throw new NotFoundException('KOT not found');
    return kot;
  }

  async updateKotStatus(
    organizationId: string,
    userId: string,
    id: string,
    dto: UpdateKotStatusDto,
  ) {
    const kot = await this.getKot(id, organizationId);
    const updated = await this.prisma.client.kOT.update({
      where: { id },
      data: { status: dto.status },
      include: { items: true, order: true },
    });

    if (dto.status === 'READY') {
      await this.events.publish({
        type: DOMAIN_EVENTS.KOT_READY,
        organizationId,
        outletId: updated.order.outletId,
        payload: { kotId: id, orderId: updated.orderId },
      });
    }

    this.websocket.emitKotUpdate(updated.order.outletId, {
      kotId: id,
      status: dto.status,
      orderId: updated.orderId,
    });

    await this.audit.log({
      organizationId,
      userId,
      outletId: updated.order.outletId,
      action: 'STATUS_CHANGE',
      entityType: 'KOT',
      entityId: id,
      previousValue: { status: kot.status },
      newValue: { status: dto.status },
    });

    return updated;
  }

  async updateKotItemStatus(
    organizationId: string,
    userId: string,
    itemId: string,
    dto: UpdateKotItemStatusDto,
  ) {
    const item = await this.prisma.client.kOTItem.findFirst({
      where: { id: itemId },
      include: { kot: { include: { order: true } } },
    });

    if (!item || item.kot.order.organizationId !== organizationId) {
      throw new NotFoundException('KOT item not found');
    }

    const now = new Date();
    const data: Record<string, unknown> = { status: dto.status };

    if (dto.status === 'PREPARING' && !item.startedAt) {
      data.startedAt = now;
    }
    if (dto.status === 'READY') {
      data.readyAt = now;
    }

    const updated = await this.prisma.client.kOTItem.update({
      where: { id: itemId },
      data,
      include: { kot: { include: { order: true } } },
    });

    const allItems = await this.prisma.client.kOTItem.findMany({
      where: { kotId: item.kotId },
    });

    const allReady = allItems.every((i) =>
      i.id === itemId ? dto.status === 'READY' || dto.status === 'SERVED' : i.status === 'READY' || i.status === 'SERVED',
    );

    if (allReady) {
      await this.prisma.client.kOT.update({
        where: { id: item.kotId },
        data: { status: 'READY' as KOTStatus },
      });
    } else if (dto.status === 'PREPARING') {
      await this.prisma.client.kOT.update({
        where: { id: item.kotId },
        data: { status: 'PREPARING' },
      });
    }

    this.websocket.emitKotUpdate(updated.kot.order.outletId, {
      kotItemId: itemId,
      kotId: item.kotId,
      status: dto.status,
      orderId: updated.kot.orderId,
    });

    await this.audit.log({
      organizationId,
      userId,
      outletId: updated.kot.order.outletId,
      action: 'ITEM_STATUS_CHANGE',
      entityType: 'KOTItem',
      entityId: itemId,
      newValue: { status: dto.status },
    });

    return updated;
  }
}

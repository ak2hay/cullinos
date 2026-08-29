import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { toInputJson } from '../../common/utils/prisma-json';
import { AuditService } from '../audit/audit.service';

export interface CreateDeliveryZoneInput {
  outletId: string;
  name: string;
  minCharge?: number;
  charge?: number;
  radius?: number;
  polygon?: Record<string, unknown>;
}

export interface UpdateDeliveryZoneInput {
  name?: string;
  minCharge?: number;
  charge?: number;
  radius?: number;
  polygon?: Record<string, unknown>;
  isActive?: boolean;
}

export interface CreateDeliveryOrderInput {
  orderId: string;
  address?: string;
  phone?: string;
  deliveryCharge?: number;
  estimatedAt?: Date;
  notes?: string;
}

export interface UpdateDeliveryStatusInput {
  status: string;
  notes?: string;
}

export interface AssignDeliveryInput {
  deliveryPersonId: string;
}

@Injectable()
export class DeliveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // --- Zones ---

  async findAllZones(outletId: string) {
    return this.prisma.client.deliveryZone.findMany({
      where: { outletId },
      orderBy: { name: 'asc' },
    });
  }

  async createZone(
    organizationId: string,
    userId: string,
    input: CreateDeliveryZoneInput,
  ) {
    const zone = await this.prisma.client.deliveryZone.create({
      data: {
        outletId: input.outletId,
        name: input.name,
        minCharge: input.minCharge ?? 0,
        charge: input.charge ?? 0,
        radius: input.radius,
        polygon: toInputJson(input.polygon),
      },
    });

    await this.audit.log({
      organizationId,
      userId,
      outletId: input.outletId,
      action: 'DELIVERY_ZONE_CREATED',
      entityType: 'DeliveryZone',
      entityId: zone.id,
    });

    return zone;
  }

  async updateZone(
    id: string,
    organizationId: string,
    userId: string,
    input: UpdateDeliveryZoneInput,
  ) {
    const zone = await this.prisma.client.deliveryZone.findUnique({
      where: { id },
    });
    if (!zone) throw new NotFoundException('Delivery zone not found');

    const updated = await this.prisma.client.deliveryZone.update({
      where: { id },
      data: {
        ...input,
        polygon: input.polygon ? toInputJson(input.polygon) : undefined,
      },
    });

    await this.audit.log({
      organizationId,
      userId,
      outletId: zone.outletId,
      action: 'DELIVERY_ZONE_UPDATED',
      entityType: 'DeliveryZone',
      entityId: id,
    });

    return updated;
  }

  // --- Delivery Orders ---

  async findDeliveryOrders(outletId?: string, status?: string) {
    return this.prisma.client.deliveryOrder.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(outletId
          ? { order: { outletId } }
          : {}),
      },
      include: {
        order: { include: { customer: true } },
        statusLogs: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findDeliveryOrder(id: string) {
    const delivery = await this.prisma.client.deliveryOrder.findUnique({
      where: { id },
      include: {
        order: true,
        statusLogs: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!delivery) throw new NotFoundException('Delivery order not found');
    return delivery;
  }

  async createDeliveryOrder(
    organizationId: string,
    userId: string,
    input: CreateDeliveryOrderInput,
  ) {
    const order = await this.prisma.client.order.findFirst({
      where: { id: input.orderId, organizationId },
    });
    if (!order) throw new NotFoundException('Order not found');

    const existing = await this.prisma.client.deliveryOrder.findUnique({
      where: { orderId: input.orderId },
    });
    if (existing) {
      throw new BadRequestException('Delivery order already exists for this order');
    }

    const delivery = await this.prisma.client.$transaction(async (tx) => {
      const created = await tx.deliveryOrder.create({
        data: {
          orderId: input.orderId,
          address: input.address,
          phone: input.phone,
          deliveryCharge: input.deliveryCharge ?? 0,
          estimatedAt: input.estimatedAt,
          notes: input.notes,
          status: 'PENDING',
        },
      });

      await tx.deliveryStatusLog.create({
        data: {
          deliveryOrderId: created.id,
          status: 'PENDING',
          notes: 'Delivery order created',
        },
      });

      return created;
    });

    await this.audit.log({
      organizationId,
      userId,
      outletId: order.outletId,
      action: 'DELIVERY_ORDER_CREATED',
      entityType: 'DeliveryOrder',
      entityId: delivery.id,
    });

    return delivery;
  }

  async updateStatus(
    id: string,
    organizationId: string,
    userId: string,
    input: UpdateDeliveryStatusInput,
  ) {
    const delivery = await this.findDeliveryOrder(id);
    const order = await this.prisma.client.order.findFirst({
      where: { id: delivery.orderId, organizationId },
    });
    if (!order) throw new NotFoundException('Delivery order not found');

    const updated = await this.prisma.client.$transaction(async (tx) => {
      const result = await tx.deliveryOrder.update({
        where: { id },
        data: {
          status: input.status,
          deliveredAt: input.status === 'DELIVERED' ? new Date() : delivery.deliveredAt,
        },
      });

      await tx.deliveryStatusLog.create({
        data: {
          deliveryOrderId: id,
          status: input.status,
          notes: input.notes,
        },
      });

      if (input.status === 'DELIVERED') {
        await tx.order.update({
          where: { id: delivery.orderId },
          data: { status: 'COMPLETED', completedAt: new Date() },
        });
      }

      return result;
    });

    await this.audit.log({
      organizationId,
      userId,
      outletId: order.outletId,
      action: 'DELIVERY_STATUS_UPDATED',
      entityType: 'DeliveryOrder',
      entityId: id,
      newValue: { status: input.status },
    });

    return updated;
  }

  async assignDeliveryPerson(
    id: string,
    organizationId: string,
    userId: string,
    input: AssignDeliveryInput,
  ) {
    const delivery = await this.findDeliveryOrder(id);
    const order = await this.prisma.client.order.findFirst({
      where: { id: delivery.orderId, organizationId },
    });
    if (!order) throw new NotFoundException('Delivery order not found');

    const updated = await this.prisma.client.$transaction(async (tx) => {
      const result = await tx.deliveryOrder.update({
        where: { id },
        data: {
          deliveryPersonId: input.deliveryPersonId,
          status: 'ASSIGNED',
        },
      });

      await tx.deliveryStatusLog.create({
        data: {
          deliveryOrderId: id,
          status: 'ASSIGNED',
          notes: `Assigned to ${input.deliveryPersonId}`,
        },
      });

      return result;
    });

    await this.audit.log({
      organizationId,
      userId,
      outletId: order.outletId,
      action: 'DELIVERY_ASSIGNED',
      entityType: 'DeliveryOrder',
      entityId: id,
      newValue: { deliveryPersonId: input.deliveryPersonId },
    });

    return updated;
  }
}

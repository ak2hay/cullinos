import { Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { ListDevicesQueryDto, RegisterDeviceDto } from './dto/devices.dto';

@Injectable()
export class DevicesService {
  constructor(private prisma: PrismaService) {}

  async register(organizationId: string, dto: RegisterDeviceDto) {
    const outlet = await this.prisma.client.outlet.findFirst({
      where: { id: dto.outletId, organizationId },
    });
    if (!outlet) {
      throw new NotFoundException('Outlet not found');
    }

    const subscription = await this.prisma.client.organizationSubscription.findUnique({
      where: { organizationId },
      include: { plan: true },
    });

    if (subscription) {
      const deviceCount = await this.prisma.client.device.count({
        where: { organizationId, isActive: true },
      });
      if (deviceCount >= subscription.plan.maxTerminals) {
        throw new NotFoundException('Device limit reached for current plan');
      }
    }

    const deviceKey = randomBytes(32).toString('hex');

    return this.prisma.client.device.create({
      data: {
        organizationId,
        outletId: dto.outletId,
        name: dto.name,
        type: dto.type ?? 'POS',
        deviceKey,
      },
      select: {
        id: true,
        name: true,
        type: true,
        outletId: true,
        deviceKey: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  async list(organizationId: string, query: ListDevicesQueryDto) {
    return this.prisma.client.device.findMany({
      where: {
        organizationId,
        ...(query.outletId ? { outletId: query.outletId } : {}),
        ...(query.type ? { type: query.type } : {}),
      },
      select: {
        id: true,
        name: true,
        type: true,
        outletId: true,
        lastSyncAt: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async syncStatus(organizationId: string, deviceId: string) {
    const device = await this.prisma.client.device.findFirst({
      where: { id: deviceId, organizationId },
      include: {
        _count: {
          select: {
            syncEvents: true,
          },
        },
      },
    });

    if (!device) {
      throw new NotFoundException('Device not found');
    }

    const [pending, synced, failed, conflict] = await Promise.all([
      this.prisma.client.syncEvent.count({
        where: { deviceId, status: 'PENDING' },
      }),
      this.prisma.client.syncEvent.count({
        where: { deviceId, status: 'SYNCED' },
      }),
      this.prisma.client.syncEvent.count({
        where: { deviceId, status: 'FAILED' },
      }),
      this.prisma.client.syncEvent.count({
        where: { deviceId, status: 'CONFLICT' },
      }),
    ]);

    return {
      device: {
        id: device.id,
        name: device.name,
        type: device.type,
        outletId: device.outletId,
        lastSyncAt: device.lastSyncAt,
        isActive: device.isActive,
      },
      sync: {
        pending,
        synced,
        failed,
        conflict,
        totalEvents: device._count.syncEvents,
        isOnline: device.lastSyncAt
          ? Date.now() - device.lastSyncAt.getTime() < 5 * 60 * 1000
          : false,
      },
    };
  }
}

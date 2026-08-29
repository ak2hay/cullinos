import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  SyncEventPayload,
  SyncPushResponse,
  SyncPullResponse,
  validateChecksum,
  computeChecksum,
  SYNC_CONFLICT_RULES,
} from '@cullinos/sync';
import { PrismaService } from '../../prisma/prisma.service';
import { SyncPullQueryDto, SyncPushDto } from './dto/sync.dto';

@Injectable()
export class SyncService {
  constructor(private prisma: PrismaService) {}

  async push(organizationId: string, dto: SyncPushDto): Promise<SyncPushResponse> {
    if (dto.idempotencyKey) {
      const cached = await this.prisma.client.idempotencyKey.findUnique({
        where: { key: dto.idempotencyKey },
      });
      if (cached) {
        if (cached.expiresAt > new Date()) {
          return cached.response as unknown as SyncPushResponse;
        }
        await this.prisma.client.idempotencyKey.delete({ where: { key: dto.idempotencyKey } });
      }
    }

    const device = await this.prisma.client.device.findFirst({
      where: { id: dto.deviceId, organizationId, isActive: true },
    });
    if (!device) {
      throw new NotFoundException('Device not found');
    }

    const acknowledged: string[] = [];
    const conflicts: Array<{ eventId: string; reason: string }> = [];

    for (const event of dto.events) {
      const payload: SyncEventPayload = {
        id: event.id,
        deviceId: event.deviceId,
        eventType: event.eventType,
        payload: event.payload,
        timestamp: event.timestamp,
        checksum: event.checksum,
      };

      if (!validateChecksum(payload)) {
        conflicts.push({ eventId: event.id, reason: 'Invalid checksum' });
        continue;
      }

      const existing = await this.prisma.client.syncEvent.findUnique({
        where: { id: event.id },
      });

      if (existing && existing.status === 'SYNCED') {
        acknowledged.push(event.id);
        continue;
      }

      const conflictRule =
        SYNC_CONFLICT_RULES[event.eventType.split('.')[0] as keyof typeof SYNC_CONFLICT_RULES];
      if (existing && existing.status === 'CONFLICT' && conflictRule === 'cloud_authoritative') {
        conflicts.push({ eventId: event.id, reason: 'Cloud authoritative conflict' });
        continue;
      }

      await this.prisma.client.syncEvent.upsert({
        where: { id: event.id },
        create: {
          id: event.id,
          organizationId,
          deviceId: dto.deviceId,
          eventType: event.eventType,
          payload: event.payload as object,
          checksum: event.checksum,
          status: 'SYNCED',
          syncedAt: new Date(),
        },
        update: {
          payload: event.payload as object,
          checksum: event.checksum,
          status: 'SYNCED',
          syncedAt: new Date(),
        },
      });

      acknowledged.push(event.id);
    }

    await this.prisma.client.device.update({
      where: { id: dto.deviceId },
      data: { lastSyncAt: new Date() },
    });

    const serverEvents = await this.getPendingServerEvents(organizationId, dto.deviceId);

    const response: SyncPushResponse = { acknowledged, conflicts, serverEvents };

    if (dto.idempotencyKey) {
      await this.prisma.client.idempotencyKey.create({
        data: {
          key: dto.idempotencyKey,
          response: response as object,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
    }

    return response;
  }

  async pull(organizationId: string, query: SyncPullQueryDto): Promise<SyncPullResponse> {
    const device = await this.prisma.client.device.findFirst({
      where: { id: query.deviceId, organizationId, isActive: true },
    });
    if (!device) {
      throw new NotFoundException('Device not found');
    }

    const since = query.since ? new Date(query.since) : device.lastSyncAt ?? new Date(0);

    const events = await this.getPendingServerEvents(organizationId, query.deviceId, since);

    const menuVersion = computeChecksum({
      updatedAt: new Date().toISOString(),
      outletId: device.outletId,
    });

    await this.prisma.client.device.update({
      where: { id: query.deviceId },
      data: { lastSyncAt: new Date() },
    });

    return {
      events,
      menuVersion,
      lastSyncAt: new Date().toISOString(),
    };
  }

  private async getPendingServerEvents(
    organizationId: string,
    deviceId: string,
    since?: Date,
  ): Promise<SyncEventPayload[]> {
    const pending = await this.prisma.client.syncEvent.findMany({
      where: {
        organizationId,
        deviceId: { not: deviceId },
        status: 'PENDING',
        ...(since ? { createdAt: { gt: since } } : {}),
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });

    return pending.map((e) => {
      const payload = e.payload as Record<string, unknown>;
      return {
        id: e.id,
        deviceId: e.deviceId,
        eventType: e.eventType,
        payload,
        timestamp: e.createdAt.toISOString(),
        checksum: e.checksum ?? computeChecksum(payload),
      };
    });
  }

  validateEventChecksum(event: SyncEventPayload): boolean {
    if (!validateChecksum(event)) {
      throw new BadRequestException('Checksum validation failed');
    }
    return true;
  }

  async markConflict(eventId: string, reason: string) {
    const event = await this.prisma.client.syncEvent.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Sync event not found');

    await this.prisma.client.syncEvent.update({
      where: { id: eventId },
      data: { status: 'CONFLICT' },
    });

    throw new ConflictException(reason);
  }
}

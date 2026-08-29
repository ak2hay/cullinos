import { Injectable } from '@nestjs/common';
import { Prisma } from '@cullinos/database';
import { PrismaService } from '../../prisma/prisma.service';

export interface AuditLogInput {
  organizationId: string;
  userId?: string;
  outletId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  previousValue?: unknown;
  newValue?: unknown;
  ipAddress?: string;
  deviceId?: string;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(input: AuditLogInput) {
    return this.createAuditLog(input);
  }

  async createAuditLog(input: AuditLogInput) {
    return this.prisma.client.auditLog.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId,
        outletId: input.outletId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        previousValue: input.previousValue as Prisma.InputJsonValue | undefined,
        newValue: input.newValue as Prisma.InputJsonValue | undefined,
        ipAddress: input.ipAddress,
        deviceId: input.deviceId,
      },
    });
  }
}
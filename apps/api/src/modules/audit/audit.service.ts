import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  list(orgId: string) {
    return this.prisma.auditLog.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  async log(input: {
    organizationId: string;
    userId?: string;
    action: string;
    entityType: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
    ipAddress?: string;
  }) {
    return this.prisma.auditLog.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: input.metadata as object,
        ipAddress: input.ipAddress,
      },
    });
  }
}

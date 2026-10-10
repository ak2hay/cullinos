import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

export const REFUND_AUDIT_ACTIONS = [
  "order.refunded",
  "order.refund_pin_failed",
  "user.refund_pin_set",
] as const;

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  list(
    orgId: string,
    filter: { action?: string; actions?: string[]; entityId?: string } = {},
  ) {
    const action = filter.action?.trim();
    const entityId = filter.entityId?.trim();
    return this.prisma.auditLog.findMany({
      where: {
        organizationId: orgId,
        ...(filter.actions?.length
          ? { action: { in: filter.actions } }
          : action
            ? { action }
            : {}),
        ...(entityId ? { entityId } : {}),
      },
      include: { user: { select: { id: true, name: true, email: true } } },
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

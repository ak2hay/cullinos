import { Injectable } from "@nestjs/common";
import { NotificationChannel, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

export interface CreateNotificationInput {
  title: string;
  body?: string;
  channel?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  list(orgId: string, channel?: string) {
    return this.prisma.notification.findMany({
      where: {
        organizationId: orgId,
        ...(channel ? { channel: channel as NotificationChannel } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  create(orgId: string, input: CreateNotificationInput) {
    return this.prisma.notification.create({
      data: {
        organizationId: orgId,
        title: input.title,
        body: input.body,
        userId: input.userId,
        channel: (input.channel as NotificationChannel) ?? NotificationChannel.in_app,
        metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  }
}

import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SendNotificationDto, ListNotificationsQueryDto } from './dto/notifications.dto';
import {
  getTemplate,
  NOTIFICATION_TEMPLATES,
  renderTemplate,
} from './notification-templates.config';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async send(organizationId: string, dto: SendNotificationDto) {
    let title = dto.title;
    let body = dto.body;

    if (!title || !body) {
      const template = getTemplate(dto.type);
      if (!template) {
        throw new BadRequestException(`Unknown notification type: ${dto.type}`);
      }
      const rendered = renderTemplate(template, dto.variables ?? {});
      title = title ?? rendered.title;
      body = body ?? rendered.body;
    }

    const log = await this.prisma.client.notificationLog.create({
      data: {
        organizationId,
        channel: dto.channel,
        type: dto.type,
        recipient: dto.recipient,
        title,
        body,
        status: dto.channel === 'in_app' ? 'SENT' : 'PENDING',
        sentAt: dto.channel === 'in_app' ? new Date() : null,
        metadata: {
          ...(dto.metadata ?? {}),
          variables: dto.variables ?? {},
        },
      },
    });

    return log;
  }

  async list(organizationId: string, query: ListNotificationsQueryDto) {
    const page = query.page ? parseInt(query.page, 10) : 1;
    const limit = query.limit ? parseInt(query.limit, 10) : 20;
    const skip = (page - 1) * limit;

    const where = {
      organizationId,
      ...(query.channel ? { channel: query.channel } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.client.notificationLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.client.notificationLog.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, hasMore: skip + data.length < total },
    };
  }

  getTemplates() {
    return NOTIFICATION_TEMPLATES;
  }
}

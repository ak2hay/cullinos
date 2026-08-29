import { Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { toInputJson } from '../../common/utils/prisma-json';
import {
  ConfigureProviderDto,
  CreateWebhookDto,
  UpdateWebhookDto,
} from './dto/integrations.dto';

export const INTEGRATION_PROVIDER_CATALOG = [
  { type: 'payment', provider: 'razorpay', name: 'Razorpay' },
  { type: 'payment', provider: 'stripe', name: 'Stripe' },
  { type: 'payment', provider: 'paytm', name: 'Paytm' },
  { type: 'sms', provider: 'twilio', name: 'Twilio' },
  { type: 'sms', provider: 'msg91', name: 'MSG91' },
  { type: 'email', provider: 'sendgrid', name: 'SendGrid' },
  { type: 'email', provider: 'ses', name: 'Amazon SES' },
  { type: 'delivery', provider: 'dunzo', name: 'Dunzo' },
  { type: 'delivery', provider: 'shadowfax', name: 'Shadowfax' },
  { type: 'printer', provider: 'epson_escpos', name: 'Epson ESC/POS' },
  { type: 'accounting', provider: 'tally', name: 'Tally' },
  { type: 'accounting', provider: 'zoho_books', name: 'Zoho Books' },
];

@Injectable()
export class IntegrationsService {
  constructor(private prisma: PrismaService) {}

  listProviderCatalog() {
    return INTEGRATION_PROVIDER_CATALOG;
  }

  async listProviders(organizationId: string) {
    const configured = await this.prisma.client.integrationProvider.findMany({
      where: { organizationId },
      select: {
        id: true,
        type: true,
        provider: true,
        isActive: true,
        config: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      catalog: INTEGRATION_PROVIDER_CATALOG,
      configured,
    };
  }

  async configureProvider(organizationId: string, dto: ConfigureProviderDto) {
    const existing = await this.prisma.client.integrationProvider.findFirst({
      where: { organizationId, type: dto.type, provider: dto.provider },
    });

    if (existing) {
      return this.prisma.client.integrationProvider.update({
        where: { id: existing.id },
        data: {
          isActive: dto.isActive ?? true,
          config: toInputJson(dto.config ?? {}) ?? {},
        },
      });
    }

    return this.prisma.client.integrationProvider.create({
      data: {
        organizationId,
        type: dto.type,
        provider: dto.provider,
        isActive: dto.isActive ?? true,
        config: toInputJson(dto.config ?? {}) ?? {},
      },
    });
  }

  async listWebhooks(organizationId: string) {
    return this.prisma.client.webhookEndpoint.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createWebhook(organizationId: string, dto: CreateWebhookDto) {
    return this.prisma.client.webhookEndpoint.create({
      data: {
        organizationId,
        url: dto.url,
        events: dto.events,
        secret: dto.secret ?? randomBytes(32).toString('hex'),
        isActive: dto.isActive ?? true,
      },
    });
  }

  async updateWebhook(organizationId: string, id: string, dto: UpdateWebhookDto) {
    const webhook = await this.prisma.client.webhookEndpoint.findFirst({
      where: { id, organizationId },
    });
    if (!webhook) throw new NotFoundException('Webhook not found');

    return this.prisma.client.webhookEndpoint.update({
      where: { id },
      data: {
        ...(dto.url !== undefined ? { url: dto.url } : {}),
        ...(dto.events !== undefined ? { events: dto.events } : {}),
        ...(dto.secret !== undefined ? { secret: dto.secret } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async deleteWebhook(organizationId: string, id: string) {
    const webhook = await this.prisma.client.webhookEndpoint.findFirst({
      where: { id, organizationId },
    });
    if (!webhook) throw new NotFoundException('Webhook not found');

    await this.prisma.client.webhookEndpoint.delete({ where: { id } });
    return { deleted: true };
  }
}

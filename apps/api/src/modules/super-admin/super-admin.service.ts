import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import jwt from 'jsonwebtoken';
import { verifyPassword } from '@cullinos/auth';
import { PrismaService } from '../../prisma/prisma.service';
import { toInputJson } from '../../common/utils/prisma-json';
import { ManageSubscriptionDto, SuperAdminLoginDto } from './dto/super-admin.dto';

@Injectable()
export class SuperAdminService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async login(dto: SuperAdminLoginDto) {
    const admin = await this.prisma.client.superAdmin.findUnique({
      where: { email: dto.email },
    });

    if (!admin || !admin.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await verifyPassword(dto.password, admin.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const secret =
      this.config.get<string>('SUPER_ADMIN_JWT_SECRET') ??
      this.config.get<string>('JWT_SECRET') ??
      'super-admin-secret';

    const accessToken = jwt.sign(
      {
        sub: admin.id,
        email: admin.email,
        organizationId: 'system',
        type: 'super_admin',
      },
      secret,
      { expiresIn: '8h' },
    );

    return {
      accessToken,
      admin: { id: admin.id, email: admin.email, name: admin.name },
    };
  }

  async listOrganizations(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [orgs, total] = await Promise.all([
      this.prisma.client.organization.findMany({
        where: { deletedAt: null },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          subscription: { include: { plan: true } },
          _count: { select: { outlets: true, users: true } },
        },
      }),
      this.prisma.client.organization.count({ where: { deletedAt: null } }),
    ]);

    return {
      data: orgs.map((org) => ({
        id: org.id,
        name: org.name,
        slug: org.slug,
        email: org.email,
        isActive: org.isActive,
        plan: org.subscription?.plan.name ?? null,
        subscriptionStatus: org.subscription?.status ?? null,
        outletCount: org._count.outlets,
        userCount: org._count.users,
        createdAt: org.createdAt,
      })),
      meta: { total, page, limit, hasMore: skip + orgs.length < total },
    };
  }

  async suspendOrganization(orgId: string, reason: string) {
    const org = await this.prisma.client.organization.findUnique({ where: { id: orgId } });
    if (!org) throw new NotFoundException('Organization not found');

    return this.prisma.client.organization.update({
      where: { id: orgId },
      data: {
        isActive: false,
        settings: {
          ...(typeof org.settings === 'object' && org.settings !== null ? org.settings : {}),
          suspensionReason: reason,
          suspendedAt: new Date().toISOString(),
        },
      },
    });
  }

  async activateOrganization(orgId: string) {
    const org = await this.prisma.client.organization.findUnique({ where: { id: orgId } });
    if (!org) throw new NotFoundException('Organization not found');

    const settings =
      typeof org.settings === 'object' && org.settings !== null
        ? { ...(org.settings as Record<string, unknown>) }
        : {};
    delete settings.suspensionReason;
    delete settings.suspendedAt;

    return this.prisma.client.organization.update({
      where: { id: orgId },
      data: { isActive: true, settings: toInputJson(settings) ?? {} },
    });
  }

  async manageSubscription(orgId: string, dto: ManageSubscriptionDto) {
    const org = await this.prisma.client.organization.findUnique({ where: { id: orgId } });
    if (!org) throw new NotFoundException('Organization not found');

    const plan = await this.prisma.client.plan.findUnique({ where: { id: dto.planId } });
    if (!plan) throw new NotFoundException('Plan not found');

    return this.prisma.client.organizationSubscription.upsert({
      where: { organizationId: orgId },
      create: {
        organizationId: orgId,
        planId: dto.planId,
        status: dto.status,
        startsAt: new Date(),
      },
      update: {
        planId: dto.planId,
        status: dto.status,
      },
      include: { plan: true },
    });
  }

  async systemHealth() {
    const [orgCount, activeOrgCount, orderCountToday, pendingSyncEvents, failedNotifications] =
      await Promise.all([
        this.prisma.client.organization.count({ where: { deletedAt: null } }),
        this.prisma.client.organization.count({ where: { deletedAt: null, isActive: true } }),
        this.prisma.client.order.count({
          where: {
            createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
          },
        }),
        this.prisma.client.syncEvent.count({ where: { status: 'PENDING' } }),
        this.prisma.client.notificationLog.count({ where: { status: 'FAILED' } }),
      ]);

    let database = 'healthy';
    try {
      await this.prisma.client.$queryRaw`SELECT 1`;
    } catch {
      database = 'unhealthy';
    }

    return {
      status: database === 'healthy' ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      database,
      metrics: {
        totalOrganizations: orgCount,
        activeOrganizations: activeOrgCount,
        ordersToday: orderCountToday,
        pendingSyncEvents,
        failedNotifications,
      },
    };
  }
}

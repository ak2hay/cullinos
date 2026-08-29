import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@cullinos/database';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { UpdateOrganizationSettingsDto } from './dto/update-settings.dto';

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  private assertOrgAccess(organizationId: string, userOrgId: string) {
    if (organizationId !== userOrgId) {
      throw new ForbiddenException('Access denied to this organization');
    }
  }

  async findAll(organizationId: string) {
    const org = await this.prisma.client.organization.findFirst({
      where: { id: organizationId, deletedAt: null },
      include: {
        subscription: {
          include: { plan: true },
        },
      },
    });

    return org ? [org] : [];
  }

  async findOne(id: string, userOrgId: string) {
    this.assertOrgAccess(id, userOrgId);

    const org = await this.prisma.client.organization.findFirst({
      where: { id, deletedAt: null },
      include: {
        subscription: {
          include: { plan: true },
        },
      },
    });

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    return org;
  }

  async update(
    id: string,
    userOrgId: string,
    userId: string,
    dto: UpdateOrganizationDto,
    ipAddress?: string,
  ) {
    const existing = await this.findOne(id, userOrgId);

    const updated = await this.prisma.client.organization.update({
      where: { id },
      data: dto,
    });

    await this.auditService.createAuditLog({
      organizationId: id,
      userId,
      action: 'UPDATE',
      entityType: 'organization',
      entityId: id,
      previousValue: existing as unknown as Prisma.InputJsonValue,
      newValue: updated as unknown as Prisma.InputJsonValue,
      ipAddress,
    });

    return updated;
  }

  async remove(id: string, userOrgId: string, userId: string, ipAddress?: string) {
    const existing = await this.findOne(id, userOrgId);

    const updated = await this.prisma.client.organization.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });

    await this.auditService.createAuditLog({
      organizationId: id,
      userId,
      action: 'DELETE',
      entityType: 'organization',
      entityId: id,
      previousValue: existing as unknown as Prisma.InputJsonValue,
      ipAddress,
    });

    return updated;
  }

  async getSettings(id: string, userOrgId: string) {
    const org = await this.findOne(id, userOrgId);
    return { settings: org.settings };
  }

  async updateSettings(
    id: string,
    userOrgId: string,
    userId: string,
    dto: UpdateOrganizationSettingsDto,
    ipAddress?: string,
  ) {
    const existing = await this.findOne(id, userOrgId);

    const updated = await this.prisma.client.organization.update({
      where: { id },
      data: { settings: dto.settings as Prisma.InputJsonValue },
    });

    await this.auditService.createAuditLog({
      organizationId: id,
      userId,
      action: 'UPDATE_SETTINGS',
      entityType: 'organization',
      entityId: id,
      previousValue: { settings: existing.settings },
      newValue: { settings: dto.settings },
      ipAddress,
    });

    return { settings: updated.settings };
  }
}

import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@cullinos/database';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateBrandDto, UpdateBrandDto } from './dto/brand.dto';

@Injectable()
export class BrandsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(organizationId: string) {
    return this.prisma.client.brand.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, organizationId: string) {
    const brand = await this.prisma.client.brand.findFirst({
      where: { id, organizationId, deletedAt: null },
    });

    if (!brand) {
      throw new NotFoundException('Brand not found');
    }

    return brand;
  }

  async create(
    organizationId: string,
    userId: string,
    dto: CreateBrandDto,
    ipAddress?: string,
  ) {
    if (dto.code) {
      const existing = await this.prisma.client.brand.findFirst({
        where: { organizationId, code: dto.code, deletedAt: null },
      });
      if (existing) {
        throw new ConflictException('Brand code already exists');
      }
    }

    const brand = await this.prisma.client.brand.create({
      data: {
        organizationId,
        name: dto.name,
        code: dto.code,
        description: dto.description,
      },
    });

    await this.auditService.createAuditLog({
      organizationId,
      userId,
      action: 'CREATE',
      entityType: 'brand',
      entityId: brand.id,
      newValue: brand as unknown as Prisma.InputJsonValue,
      ipAddress,
    });

    return brand;
  }

  async update(
    id: string,
    organizationId: string,
    userId: string,
    dto: UpdateBrandDto,
    ipAddress?: string,
  ) {
    const existing = await this.findOne(id, organizationId);

    if (dto.code && dto.code !== existing.code) {
      const codeTaken = await this.prisma.client.brand.findFirst({
        where: { organizationId, code: dto.code, deletedAt: null, id: { not: id } },
      });
      if (codeTaken) {
        throw new ConflictException('Brand code already exists');
      }
    }

    const brand = await this.prisma.client.brand.update({
      where: { id },
      data: dto,
    });

    await this.auditService.createAuditLog({
      organizationId,
      userId,
      action: 'UPDATE',
      entityType: 'brand',
      entityId: id,
      previousValue: existing as unknown as Prisma.InputJsonValue,
      newValue: brand as unknown as Prisma.InputJsonValue,
      ipAddress,
    });

    return brand;
  }

  async remove(id: string, organizationId: string, userId: string, ipAddress?: string) {
    const existing = await this.findOne(id, organizationId);

    const brand = await this.prisma.client.brand.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });

    await this.auditService.createAuditLog({
      organizationId,
      userId,
      action: 'DELETE',
      entityType: 'brand',
      entityId: id,
      previousValue: existing as unknown as Prisma.InputJsonValue,
      ipAddress,
    });

    return brand;
  }
}

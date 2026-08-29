import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@cullinos/database';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateOutletDto, UpdateOutletDto } from './dto/outlet.dto';

@Injectable()
export class OutletsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(organizationId: string) {
    return this.prisma.client.outlet.findMany({
      where: { organizationId, deletedAt: null },
      include: { brand: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, organizationId: string) {
    const outlet = await this.prisma.client.outlet.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: { brand: true },
    });

    if (!outlet) {
      throw new NotFoundException('Outlet not found');
    }

    return outlet;
  }

  private async validateBrand(brandId: string | undefined, organizationId: string) {
    if (!brandId) return;

    const brand = await this.prisma.client.brand.findFirst({
      where: { id: brandId, organizationId, deletedAt: null },
    });

    if (!brand) {
      throw new BadRequestException('Invalid brand for this organization');
    }
  }

  async create(
    organizationId: string,
    userId: string,
    dto: CreateOutletDto,
    ipAddress?: string,
  ) {
    await this.validateBrand(dto.brandId, organizationId);

    if (dto.code) {
      const existing = await this.prisma.client.outlet.findFirst({
        where: { organizationId, code: dto.code, deletedAt: null },
      });
      if (existing) {
        throw new ConflictException('Outlet code already exists');
      }
    }

    const outlet = await this.prisma.client.outlet.create({
      data: {
        organizationId,
        name: dto.name,
        code: dto.code,
        address: dto.address,
        city: dto.city,
        state: dto.state,
        country: dto.country ?? 'IN',
        phone: dto.phone,
        email: dto.email,
        timezone: dto.timezone,
        brandId: dto.brandId,
      },
      include: { brand: true },
    });

    await this.auditService.createAuditLog({
      organizationId,
      userId,
      outletId: outlet.id,
      action: 'CREATE',
      entityType: 'outlet',
      entityId: outlet.id,
      newValue: outlet as unknown as Prisma.InputJsonValue,
      ipAddress,
    });

    return outlet;
  }

  async update(
    id: string,
    organizationId: string,
    userId: string,
    dto: UpdateOutletDto,
    ipAddress?: string,
  ) {
    const existing = await this.findOne(id, organizationId);
    await this.validateBrand(dto.brandId, organizationId);

    if (dto.code && dto.code !== existing.code) {
      const codeTaken = await this.prisma.client.outlet.findFirst({
        where: { organizationId, code: dto.code, deletedAt: null, id: { not: id } },
      });
      if (codeTaken) {
        throw new ConflictException('Outlet code already exists');
      }
    }

    const outlet = await this.prisma.client.outlet.update({
      where: { id },
      data: dto,
      include: { brand: true },
    });

    await this.auditService.createAuditLog({
      organizationId,
      userId,
      outletId: id,
      action: 'UPDATE',
      entityType: 'outlet',
      entityId: id,
      previousValue: existing as unknown as Prisma.InputJsonValue,
      newValue: outlet as unknown as Prisma.InputJsonValue,
      ipAddress,
    });

    return outlet;
  }

  async remove(id: string, organizationId: string, userId: string, ipAddress?: string) {
    const existing = await this.findOne(id, organizationId);

    const outlet = await this.prisma.client.outlet.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });

    await this.auditService.createAuditLog({
      organizationId,
      userId,
      outletId: id,
      action: 'DELETE',
      entityType: 'outlet',
      entityId: id,
      previousValue: existing as unknown as Prisma.InputJsonValue,
      ipAddress,
    });

    return outlet;
  }
}

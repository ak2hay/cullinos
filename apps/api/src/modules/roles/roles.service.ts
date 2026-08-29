import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@cullinos/database';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AssignPermissionsDto } from './dto/assign-permissions.dto';

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(organizationId: string) {
    return this.prisma.client.role.findMany({
      where: { organizationId },
      include: {
        rolePermissions: {
          include: { permission: true },
        },
        _count: { select: { userRoles: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string, organizationId: string) {
    const role = await this.prisma.client.role.findFirst({
      where: { id, organizationId },
      include: {
        rolePermissions: {
          include: { permission: true },
        },
        userRoles: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    return role;
  }

  async assignPermissions(
    roleId: string,
    organizationId: string,
    userId: string,
    dto: AssignPermissionsDto,
    ipAddress?: string,
  ) {
    const role = await this.findOne(roleId, organizationId);

    const permissions = await this.prisma.client.permission.findMany({
      where: { key: { in: dto.permissionKeys } },
    });

    if (permissions.length !== dto.permissionKeys.length) {
      const found = new Set(permissions.map((p) => p.key));
      const missing = dto.permissionKeys.filter((k) => !found.has(k));
      throw new BadRequestException(`Unknown permissions: ${missing.join(', ')}`);
    }

    const previousKeys = role.rolePermissions.map((rp) => rp.permission.key);

    await this.prisma.client.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId } });
      await tx.rolePermission.createMany({
        data: permissions.map((permission) => ({
          roleId,
          permissionId: permission.id,
        })),
      });
    });

    const updated = await this.findOne(roleId, organizationId);

    await this.auditService.createAuditLog({
      organizationId,
      userId,
      action: 'ASSIGN_PERMISSIONS',
      entityType: 'role',
      entityId: roleId,
      previousValue: { permissionKeys: previousKeys },
      newValue: { permissionKeys: dto.permissionKeys } as Prisma.InputJsonValue,
      ipAddress,
    });

    return updated;
  }
}

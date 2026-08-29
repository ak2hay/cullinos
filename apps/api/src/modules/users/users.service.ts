import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { hashPassword } from '@cullinos/auth';
import { Prisma } from '@cullinos/database';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateUserDto, ListUsersQueryDto, UpdateUserDto } from './dto/user.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(organizationId: string, query: ListUsersQueryDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.client.user.findMany({
        where: { organizationId, deletedAt: null },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          organizationId: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          avatarUrl: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
          userRoles: {
            include: {
              role: { select: { id: true, name: true } },
            },
          },
        },
      }),
      this.prisma.client.user.count({
        where: { organizationId, deletedAt: null },
      }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        hasMore: skip + data.length < total,
      },
    };
  }

  async findOne(id: string, organizationId: string) {
    const user = await this.prisma.client.user.findFirst({
      where: { id, organizationId, deletedAt: null },
      select: {
        id: true,
        organizationId: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        avatarUrl: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        userRoles: {
          include: {
            role: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  private async validateRoles(roleIds: string[], organizationId: string) {
    if (!roleIds.length) return;

    const roles = await this.prisma.client.role.findMany({
      where: { id: { in: roleIds }, organizationId },
    });

    if (roles.length !== roleIds.length) {
      throw new BadRequestException('One or more roles are invalid');
    }
  }

  async create(
    organizationId: string,
    actorId: string,
    dto: CreateUserDto,
    ipAddress?: string,
  ) {
    const existing = await this.prisma.client.user.findFirst({
      where: { organizationId, email: dto.email, deletedAt: null },
    });

    if (existing) {
      throw new ConflictException('User with this email already exists');
    }

    if (dto.roleIds?.length) {
      await this.validateRoles(dto.roleIds, organizationId);
    }

    const passwordHash = await hashPassword(dto.password);

    const user = await this.prisma.client.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          organizationId,
          email: dto.email,
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone,
        },
      });

      if (dto.roleIds?.length) {
        await tx.userRole.createMany({
          data: dto.roleIds.map((roleId) => ({
            userId: created.id,
            roleId,
          })),
        });
      }

      return created;
    });

    const result = await this.findOne(user.id, organizationId);

    await this.auditService.createAuditLog({
      organizationId,
      userId: actorId,
      action: 'CREATE',
      entityType: 'user',
      entityId: user.id,
      newValue: { email: user.email, firstName: user.firstName, lastName: user.lastName },
      ipAddress,
    });

    return result;
  }

  async update(
    id: string,
    organizationId: string,
    actorId: string,
    dto: UpdateUserDto,
    ipAddress?: string,
  ) {
    const existing = await this.findOne(id, organizationId);

    if (dto.roleIds?.length) {
      await this.validateRoles(dto.roleIds, organizationId);
    }

    const { roleIds, ...userData } = dto;

    await this.prisma.client.$transaction(async (tx) => {
      if (Object.keys(userData).length > 0) {
        await tx.user.update({
          where: { id },
          data: userData,
        });
      }

      if (roleIds !== undefined) {
        await tx.userRole.deleteMany({ where: { userId: id } });
        if (roleIds.length > 0) {
          await tx.userRole.createMany({
            data: roleIds.map((roleId) => ({ userId: id, roleId })),
          });
        }
      }
    });

    const updated = await this.findOne(id, organizationId);

    await this.auditService.createAuditLog({
      organizationId,
      userId: actorId,
      action: 'UPDATE',
      entityType: 'user',
      entityId: id,
      previousValue: existing as unknown as Prisma.InputJsonValue,
      newValue: updated as unknown as Prisma.InputJsonValue,
      ipAddress,
    });

    return updated;
  }
}

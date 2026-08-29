import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  hashPassword,
  verifyPassword,
  generateTokenPair,
  verifyToken,
} from '@cullinos/auth';
import { DEFAULT_ROLE_PERMISSIONS } from '@cullinos/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  private get accessSecret() {
    return this.configService.get<string>('JWT_ACCESS_SECRET') || 'dev-access-secret';
  }

  private get refreshSecret() {
    return this.configService.get<string>('JWT_REFRESH_SECRET') || 'dev-refresh-secret';
  }

  private slugify(name: string): string {
    const base = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return base || 'organization';
  }

  private async uniqueSlug(baseName: string): Promise<string> {
    let slug = this.slugify(baseName);
    let suffix = 0;

    while (true) {
      const candidate = suffix === 0 ? slug : `${slug}-${suffix}`;
      const existing = await this.prisma.client.organization.findUnique({
        where: { slug: candidate },
      });
      if (!existing) return candidate;
      suffix += 1;
    }
  }

  async getUserPermissions(userId: string): Promise<string[]> {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: { permission: true },
                },
              },
            },
          },
        },
      },
    });

    if (!user) return [];

    return [
      ...new Set(
        user.userRoles.flatMap((ur) =>
          ur.role.rolePermissions.map((rp) => rp.permission.key),
        ),
      ),
    ];
  }

  private sanitizeUser(user: {
    id: string;
    organizationId: string;
    email: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    avatarUrl: string | null;
    isActive: boolean;
    lastLoginAt: Date | null;
    createdAt: Date;
  }) {
    return {
      id: user.id,
      organizationId: user.organizationId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    };
  }

  private async createSession(userId: string, refreshToken: string, deviceInfo?: string, ipAddress?: string) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    return this.prisma.client.session.create({
      data: {
        userId,
        refreshToken,
        deviceInfo,
        ipAddress,
        expiresAt,
      },
    });
  }

  private async buildAuthResponse(userId: string, organizationId: string, email: string) {
    const tokens = generateTokenPair(
      { sub: userId, organizationId, email },
      this.accessSecret,
      this.refreshSecret,
    );

    await this.createSession(userId, tokens.refreshToken);

    const user = await this.prisma.client.user.findUniqueOrThrow({
      where: { id: userId },
    });
    const permissions = await this.getUserPermissions(userId);

    return {
      ...tokens,
      user: this.sanitizeUser(user),
      permissions,
    };
  }

  async register(dto: RegisterDto, ipAddress?: string) {
    const existingUser = await this.prisma.client.user.findFirst({
      where: { email: dto.email, deletedAt: null },
    });
    if (existingUser) {
      throw new ConflictException('Email is already registered');
    }

    const slug = await this.uniqueSlug(dto.organizationName);
    const passwordHash = await hashPassword(dto.password);

    const starterPlan = await this.prisma.client.plan.findUnique({
      where: { key: 'STARTER' },
    });
    if (!starterPlan) {
      throw new BadRequestException('STARTER plan is not configured. Run database seed.');
    }

    const allPermissions = await this.prisma.client.permission.findMany({
      where: { key: { in: DEFAULT_ROLE_PERMISSIONS.OWNER } },
    });

    const result = await this.prisma.client.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: dto.organizationName,
          slug,
          email: dto.email,
          phone: dto.phone,
        },
      });

      const user = await tx.user.create({
        data: {
          organizationId: organization.id,
          email: dto.email,
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone,
        },
      });

      const outlet = await tx.outlet.create({
        data: {
          organizationId: organization.id,
          name: 'Main Outlet',
          code: 'MAIN',
        },
      });

      await tx.organizationSubscription.create({
        data: {
          organizationId: organization.id,
          planId: starterPlan.id,
          status: 'ACTIVE',
          startsAt: new Date(),
        },
      });

      const ownerRole = await tx.role.create({
        data: {
          organizationId: organization.id,
          name: 'Owner',
          description: 'Organization owner with full access',
          isSystem: true,
        },
      });

      if (allPermissions.length > 0) {
        await tx.rolePermission.createMany({
          data: allPermissions.map((permission) => ({
            roleId: ownerRole.id,
            permissionId: permission.id,
          })),
          skipDuplicates: true,
        });
      }

      await tx.userRole.create({
        data: {
          userId: user.id,
          roleId: ownerRole.id,
          outletId: outlet.id,
        },
      });

      return { organization, user, outlet };
    });

    await this.auditService.createAuditLog({
      organizationId: result.organization.id,
      userId: result.user.id,
      action: 'REGISTER',
      entityType: 'organization',
      entityId: result.organization.id,
      newValue: { name: result.organization.name, slug: result.organization.slug },
      ipAddress,
    });

    const authResponse = await this.buildAuthResponse(
      result.user.id,
      result.organization.id,
      result.user.email,
    );

    return {
      organization: {
        id: result.organization.id,
        name: result.organization.name,
        slug: result.organization.slug,
        email: result.organization.email,
      },
      outlet: {
        id: result.outlet.id,
        name: result.outlet.name,
        code: result.outlet.code,
      },
      ...authResponse,
    };
  }

  async login(dto: LoginDto, ipAddress?: string) {
    const users = await this.prisma.client.user.findMany({
      where: {
        email: dto.email,
        isActive: true,
        deletedAt: null,
      },
    });

    if (users.length === 0) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const matched: typeof users = [];
    for (const user of users) {
      if (await verifyPassword(dto.password, user.passwordHash)) {
        matched.push(user);
      }
    }

    if (matched.length === 0) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (matched.length > 1) {
      throw new ConflictException(
        'Multiple accounts found for this email. Contact support to resolve.',
      );
    }

    const user = matched[0];

    await this.prisma.client.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await this.auditService.createAuditLog({
      organizationId: user.organizationId,
      userId: user.id,
      action: 'LOGIN',
      entityType: 'user',
      entityId: user.id,
      ipAddress,
    });

    return this.buildAuthResponse(user.id, user.organizationId, user.email);
  }

  async refresh(refreshToken: string) {
    let payload;
    try {
      payload = verifyToken(refreshToken, this.refreshSecret);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid token type');
    }

    const session = await this.prisma.client.session.findUnique({
      where: { refreshToken },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Session expired or invalid');
    }

    if (!session.user.isActive || session.user.deletedAt) {
      throw new UnauthorizedException('User is inactive');
    }

    const tokens = generateTokenPair(
      {
        sub: session.user.id,
        organizationId: session.user.organizationId,
        email: session.user.email,
      },
      this.accessSecret,
      this.refreshSecret,
    );

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.client.session.update({
      where: { id: session.id },
      data: {
        refreshToken: tokens.refreshToken,
        expiresAt,
      },
    });

    const permissions = await this.getUserPermissions(session.user.id);

    return {
      ...tokens,
      user: this.sanitizeUser(session.user),
      permissions,
    };
  }

  async logout(refreshToken: string, userId?: string, ipAddress?: string) {
    const session = await this.prisma.client.session.findUnique({
      where: { refreshToken },
      include: { user: true },
    });

    if (!session) {
      return { success: true };
    }

    await this.prisma.client.session.delete({
      where: { id: session.id },
    });

    await this.auditService.createAuditLog({
      organizationId: session.user.organizationId,
      userId: userId ?? session.userId,
      action: 'LOGOUT',
      entityType: 'session',
      entityId: session.id,
      ipAddress,
    });

    return { success: true };
  }
}

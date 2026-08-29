import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '@cullinos/auth';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SuperAdminJwtStrategy extends PassportStrategy(Strategy, 'super-admin-jwt') {
  constructor(
    config: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('SUPER_ADMIN_JWT_SECRET') ?? config.get<string>('JWT_SECRET') ?? 'super-admin-secret',
    });
  }

  async validate(payload: JwtPayload) {
    if (payload.type !== 'super_admin') {
      throw new UnauthorizedException('Invalid super admin token');
    }

    const admin = await this.prisma.client.superAdmin.findUnique({
      where: { id: payload.sub },
    });

    if (!admin || !admin.isActive) {
      throw new UnauthorizedException('Super admin not found or inactive');
    }

    return {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      type: 'super_admin' as const,
    };
  }
}

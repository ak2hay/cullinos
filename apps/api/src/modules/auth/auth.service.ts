import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { verifyPassword } from "@cullinos/auth";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService) {}

  async getUserPermissions(userId: string): Promise<string[]> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: { permission: true },
            },
          },
        },
      },
    });

    const permissions = new Set<string>();
    for (const ur of userRoles) {
      for (const rp of ur.role.rolePermissions) {
        permissions.add(`${rp.permission.module}:${rp.permission.action}`);
      }
    }
    return [...permissions];
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findFirst({
      where: { email, status: "active" },
      include: { organization: true },
    });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const permissions = await this.getUserPermissions(user.id);

    const token = this.jwt.sign({
      sub: user.id,
      organizationId: user.organizationId,
      email: user.email,
      isSuperAdmin: user.isSuperAdmin,
      permissions,
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const nameParts = user.name.trim().split(/\s+/);
    const refreshToken = this.jwt.sign(
      { sub: user.id, type: "refresh" },
      { expiresIn: "30d" },
    );

    return {
      token,
      accessToken: token,
      refreshToken,
      expiresIn: 7 * 24 * 60 * 60,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        firstName: nameParts[0] ?? "",
        lastName: nameParts.slice(1).join(" ") || "",
        phone: user.phone,
        avatarUrl: null,
        isActive: true,
        lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
        createdAt: user.createdAt.toISOString(),
        organizationId: user.organizationId,
        organizationName: user.organization.name,
        isSuperAdmin: user.isSuperAdmin,
      },
      permissions,
    };
  }
}

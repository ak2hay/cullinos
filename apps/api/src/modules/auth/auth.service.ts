import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { verifyPassword } from "@cullinos/auth";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService) {}

  async login(email: string, password: string) {
    const user = await this.prisma.user.findFirst({
      where: { email, status: "active" },
      include: { organization: true },
    });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const token = this.jwt.sign({
      sub: user.id,
      organizationId: user.organizationId,
      email: user.email,
      isSuperAdmin: user.isSuperAdmin,
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        organizationId: user.organizationId,
        organizationName: user.organization.name,
        isSuperAdmin: user.isSuperAdmin,
      },
    };
  }
}

import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}
  list(orgId: string) {
    return this.prisma.user.findMany({
      where: { organizationId: orgId },
      take: 200,
    });
  }
}

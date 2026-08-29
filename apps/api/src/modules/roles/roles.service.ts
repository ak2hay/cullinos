import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class RolesService {
  constructor(private prisma: PrismaService) {}
  list(orgId: string) {
    return this.prisma.role.findMany({
      where: { organizationId: orgId },
      take: 200,
    });
  }
}

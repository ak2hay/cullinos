import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class SuperAdminService {
  constructor(private prisma: PrismaService) {}
  listTenants() {
    return this.prisma.organization.findMany({
      include: { subscriptions: { include: { plan: true } }, outlets: true },
      orderBy: { createdAt: "desc" },
    });
  }
  suspendTenant(id: string) {
    return this.prisma.organization.update({ where: { id }, data: { status: "suspended" } });
  }
  reactivateTenant(id: string) {
    return this.prisma.organization.update({ where: { id }, data: { status: "active" } });
  }
}

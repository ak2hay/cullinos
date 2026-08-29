import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class OrganizationsService {
  constructor(private prisma: PrismaService) {}

  list(orgId: string) {
    return this.prisma.organization.findMany({ where: { id: orgId } });
  }

  get(orgId: string) {
    return this.prisma.organization.findUnique({
      where: { id: orgId },
      include: { brands: true, outlets: true, subscriptions: { include: { plan: true } } },
    });
  }
}

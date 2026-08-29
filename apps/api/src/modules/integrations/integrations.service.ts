import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class IntegrationsService {
  constructor(private prisma: PrismaService) {}
  list(orgId: string) {
    return this.prisma.integration.findMany({
      where: { organizationId: orgId },
      take: 200,
    });
  }
}

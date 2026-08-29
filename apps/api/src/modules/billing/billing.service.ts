import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class BillingService {
  constructor(private prisma: PrismaService) {}

  list(orgId: string) {
    return this.prisma.invoice.findMany({
      where: { order: { organizationId: orgId } },
      take: 200,
    });
  }
}

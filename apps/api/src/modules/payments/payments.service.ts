import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class PaymentsService {
  constructor(private prisma: PrismaService) {}

  list(orgId: string) {
    return this.prisma.payment.findMany({
      where: { order: { organizationId: orgId } },
      take: 200,
    });
  }
}

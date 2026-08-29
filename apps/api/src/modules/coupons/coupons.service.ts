import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class CouponsService {
  constructor(private prisma: PrismaService) {}
  list(orgId: string) {
    return this.prisma.coupon.findMany({
      where: { organizationId: orgId },
      take: 200,
    });
  }
}

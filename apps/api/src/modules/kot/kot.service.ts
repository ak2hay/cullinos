import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class KotService {
  constructor(private prisma: PrismaService) {}

  list(orgId: string) {
    return this.prisma.kOT.findMany({
      where: { order: { organizationId: orgId } },
      include: { items: true, order: true },
      take: 200,
    });
  }
}

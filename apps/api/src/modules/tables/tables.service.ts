import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class TablesService {
  constructor(private prisma: PrismaService) {}

  list(orgId: string) {
    return this.prisma.table.findMany({
      where: { section: { floor: { outlet: { organizationId: orgId } } } },
      include: { section: true },
      take: 200,
    });
  }
}

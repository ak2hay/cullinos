import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class SyncService {
  constructor(private prisma: PrismaService) {}

  list(orgId: string) {
    return this.prisma.syncEvent.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }
}

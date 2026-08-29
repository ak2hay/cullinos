import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class RoomsService {
  constructor(private prisma: PrismaService) {}
  list(orgId: string) {
    return this.prisma.room.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }
}

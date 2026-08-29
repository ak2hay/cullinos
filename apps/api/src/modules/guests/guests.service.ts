import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class GuestsService {
  constructor(private prisma: PrismaService) {}
  list(orgId: string) {
    return this.prisma.guest.findMany({
      where: { organizationId: orgId },
      take: 200,
    });
  }
}

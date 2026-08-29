import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class DevicesService {
  constructor(private prisma: PrismaService) {}
  list(orgId: string) {
    return this.prisma.device.findMany({
      where: { organizationId: orgId },
      take: 200,
    });
  }
}

import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class BrandsService {
  constructor(private prisma: PrismaService) {}
  list(orgId: string) {
    return this.prisma.brand.findMany({ where: { organizationId: orgId } });
  }
}

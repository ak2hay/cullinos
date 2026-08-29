import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class FranchiseService {
  constructor(private prisma: PrismaService) {}
  list(orgId: string) {
    return this.prisma.franchiseAgreement.findMany({
      where: { organizationId: orgId },
      take: 200,
    });
  }
}

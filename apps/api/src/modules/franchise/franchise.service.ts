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

  async listFranchisees(orgId: string) {
    const agreements = await this.prisma.franchiseAgreement.findMany({
      where: { organizationId: orgId },
      include: { outlets: true },
      orderBy: { startDate: "desc" },
    });

    const grouped = new Map<
      string,
      {
        id: string;
        name: string;
        contactEmail: string | null;
        contactPhone: string | null;
        status: string;
        outletCount: number;
        agreementCount: number;
      }
    >();

    for (const agreement of agreements) {
      const key = agreement.franchiseeName.toLowerCase();
      const existing = grouped.get(key);
      const isActive =
        !agreement.endDate || agreement.endDate.getTime() > Date.now();

      if (existing) {
        existing.outletCount += agreement.outlets.length;
        existing.agreementCount += 1;
        if (isActive) existing.status = "ACTIVE";
      } else {
        grouped.set(key, {
          id: agreement.id,
          name: agreement.franchiseeName,
          contactEmail: null,
          contactPhone: null,
          status: isActive ? "ACTIVE" : "INACTIVE",
          outletCount: agreement.outlets.length,
          agreementCount: 1,
        });
      }
    }

    return [...grouped.values()];
  }
}

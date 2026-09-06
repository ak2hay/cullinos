import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

export interface CreateFranchiseAgreementInput {
  franchiseeName: string;
  startDate: Date | string;
  endDate?: Date | string | null;
  terms?: Record<string, unknown> | null;
  outletIds?: string[];
}

@Injectable()
export class FranchiseService {
  constructor(private prisma: PrismaService) {}

  list(orgId: string) {
    return this.prisma.franchiseAgreement.findMany({
      where: { organizationId: orgId },
      include: { outlets: true },
      orderBy: { startDate: "desc" },
      take: 200,
    });
  }

  async createAgreement(orgId: string, input: CreateFranchiseAgreementInput) {
    const outletIds = input.outletIds ?? [];
    if (outletIds.length > 0) {
      const outlets = await this.prisma.outlet.findMany({
        where: { id: { in: outletIds }, organizationId: orgId },
        select: { id: true },
      });
      if (outlets.length !== outletIds.length) {
        throw new BadRequestException("One or more outlets not found for organization");
      }
    }

    return this.prisma.franchiseAgreement.create({
      data: {
        organizationId: orgId,
        franchiseeName: input.franchiseeName,
        startDate: new Date(input.startDate),
        endDate: input.endDate ? new Date(input.endDate) : null,
        terms: (input.terms ?? undefined) as Prisma.InputJsonValue | undefined,
        outlets:
          outletIds.length > 0
            ? { create: outletIds.map((outletId) => ({ outletId })) }
            : undefined,
      },
      include: { outlets: true },
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

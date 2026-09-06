import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class TaxService {
  constructor(private prisma: PrismaService) {}

  list(orgId: string) {
    return this.prisma.taxGroup.findMany({
      where: { organizationId: orgId },
      include: { rates: true },
      take: 200,
    });
  }

  async createGroup(
    orgId: string,
    data: {
      name: string;
      rates: Array<{ name: string; rate: number; type?: string }>;
      isInclusive?: boolean;
    },
  ) {
    if (!data.name?.trim()) throw new BadRequestException("name is required");
    if (!Array.isArray(data.rates) || data.rates.length === 0) {
      throw new BadRequestException("at least one rate is required");
    }

    for (const rate of data.rates) {
      if (!rate.name?.trim()) throw new BadRequestException("rate name is required");
      if (!Number.isFinite(Number(rate.rate))) {
        throw new BadRequestException("rate must be a number");
      }
    }

    return this.prisma.taxGroup.create({
      data: {
        organizationId: orgId,
        name: data.name.trim(),
        isInclusive: data.isInclusive ?? false,
        rates: {
          create: data.rates.map((r) => ({
            name: r.name.trim(),
            rate: Number(r.rate),
            type: r.type?.trim() || "percentage",
          })),
        },
      },
      include: { rates: true },
    });
  }
}

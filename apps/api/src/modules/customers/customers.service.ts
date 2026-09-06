import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  list(orgId: string, q?: string) {
    return this.prisma.customer.findMany({
      where: {
        organizationId: orgId,
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { phone: { contains: q } },
                { email: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      include: { loyaltyTier: true },
      orderBy: { name: "asc" },
      take: 200,
    });
  }

  async get(orgId: string, id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, organizationId: orgId },
      include: {
        loyaltyTier: true,
        loyaltyTransactions: { orderBy: { createdAt: "desc" }, take: 50 },
      },
    });
    if (!customer) throw new NotFoundException("Customer not found");
    return customer;
  }

  create(
    orgId: string,
    data: { name: string; phone?: string; email?: string },
  ) {
    if (!data.name?.trim()) throw new BadRequestException("name is required");
    return this.prisma.customer.create({
      data: {
        organizationId: orgId,
        name: data.name.trim(),
        phone: data.phone?.trim() || null,
        email: data.email?.trim() || null,
      },
    });
  }

  async update(
    orgId: string,
    id: string,
    data: { name?: string; phone?: string; email?: string },
  ) {
    await this.get(orgId, id);
    return this.prisma.customer.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.phone !== undefined ? { phone: data.phone?.trim() || null } : {}),
        ...(data.email !== undefined ? { email: data.email?.trim() || null } : {}),
      },
    });
  }
}

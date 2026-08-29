import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class CouponsService {
  constructor(private prisma: PrismaService) {}

  list(orgId: string) {
    return this.prisma.coupon.findMany({
      where: { organizationId: orgId },
      take: 200,
    });
  }

  create(
    orgId: string,
    data: {
      code: string;
      type: string;
      value: number;
      minOrder?: number;
      maxUses?: number;
      startsAt?: string;
      expiresAt?: string;
    },
  ) {
    return this.prisma.coupon.create({
      data: {
        organizationId: orgId,
        code: data.code.toUpperCase(),
        type: data.type,
        value: data.value,
        minOrder: data.minOrder,
        maxUses: data.maxUses,
        startsAt: data.startsAt ? new Date(data.startsAt) : undefined,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
      },
    });
  }

  async validate(orgId: string, code: string, orderTotal: number) {
    const coupon = await this.prisma.coupon.findFirst({
      where: { organizationId: orgId, code: code.toUpperCase(), isActive: true },
    });
    if (!coupon) throw new NotFoundException("Coupon not found");
    if (coupon.expiresAt && coupon.expiresAt < new Date()) {
      throw new BadRequestException("Coupon expired");
    }
    if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
      throw new BadRequestException("Coupon usage limit reached");
    }
    if (coupon.minOrder && orderTotal < Number(coupon.minOrder)) {
      throw new BadRequestException(`Minimum order is ${coupon.minOrder}`);
    }

    const discount =
      coupon.type === "percent"
        ? orderTotal * (Number(coupon.value) / 100)
        : Number(coupon.value);

    return { coupon, discountAmount: discount };
  }
}

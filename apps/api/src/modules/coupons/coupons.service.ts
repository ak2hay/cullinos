import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { MarketingUploadService } from "../marketing/marketing-upload.service";

@Injectable()
export class CouponsService {
  constructor(
    private prisma: PrismaService,
    private upload: MarketingUploadService,
  ) {}

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
      title?: string;
      description?: string;
      imageUrl?: string;
      minOrder?: number;
      maxUses?: number;
      startsAt?: string;
      expiresAt?: string;
      isActive?: boolean;
    },
  ) {
    return this.prisma.coupon.create({
      data: {
        organizationId: orgId,
        code: data.code.toUpperCase(),
        type: data.type,
        value: data.value,
        title: data.title?.trim() || null,
        description: data.description?.trim() || null,
        imageUrl: data.imageUrl?.trim() || null,
        minOrder: data.minOrder,
        maxUses: data.maxUses,
        startsAt: data.startsAt ? new Date(data.startsAt) : undefined,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
        isActive: data.isActive ?? true,
      },
    });
  }

  async update(
    orgId: string,
    id: string,
    data: {
      code?: string;
      type?: string;
      value?: number;
      title?: string | null;
      description?: string | null;
      imageUrl?: string | null;
      minOrder?: number | null;
      maxUses?: number | null;
      startsAt?: string | null;
      expiresAt?: string | null;
      isActive?: boolean;
    },
  ) {
    const existing = await this.prisma.coupon.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!existing) throw new NotFoundException("Coupon not found");
    if (
      data.imageUrl !== undefined &&
      (data.imageUrl?.trim() || null) !== existing.imageUrl
    ) {
      await this.upload.deleteManagedUrl(existing.imageUrl);
    }
    return this.prisma.coupon.update({
      where: { id },
      data: {
        ...(data.code !== undefined ? { code: data.code.toUpperCase() } : {}),
        ...(data.type !== undefined ? { type: data.type } : {}),
        ...(data.value !== undefined ? { value: data.value } : {}),
        ...(data.title !== undefined ? { title: data.title?.trim() || null } : {}),
        ...(data.description !== undefined
          ? { description: data.description?.trim() || null }
          : {}),
        ...(data.imageUrl !== undefined
          ? { imageUrl: data.imageUrl?.trim() || null }
          : {}),
        ...(data.minOrder !== undefined ? { minOrder: data.minOrder } : {}),
        ...(data.maxUses !== undefined ? { maxUses: data.maxUses } : {}),
        ...(data.startsAt !== undefined
          ? { startsAt: data.startsAt ? new Date(data.startsAt) : null }
          : {}),
        ...(data.expiresAt !== undefined
          ? { expiresAt: data.expiresAt ? new Date(data.expiresAt) : null }
          : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });
  }

  async deactivate(orgId: string, id: string) {
    return this.update(orgId, id, { isActive: false });
  }

  async remove(orgId: string, id: string) {
    const existing = await this.prisma.coupon.findFirst({
      where: { id, organizationId: orgId },
      include: { _count: { select: { usages: true } } },
    });
    if (!existing) throw new NotFoundException("Coupon not found");
    if (existing._count.usages > 0) {
      throw new BadRequestException(
        "Coupon has been used and cannot be deleted. Deactivate it instead.",
      );
    }
    await this.upload.deleteManagedUrl(existing.imageUrl);
    await this.prisma.coupon.delete({ where: { id } });
    return { success: true, id };
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

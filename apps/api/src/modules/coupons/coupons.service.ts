import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

export interface CreateCouponInput {
  code: string;
  type?: string;
  value: number;
  minOrderAmount?: number;
  maxUses?: number;
  startsAt?: Date;
  endsAt?: Date;
}

export interface UpdateCouponInput {
  type?: string;
  value?: number;
  minOrderAmount?: number;
  maxUses?: number;
  startsAt?: Date;
  endsAt?: Date;
  isActive?: boolean;
}

export interface ValidateCouponInput {
  code: string;
  orderAmount: number;
}

@Injectable()
export class CouponsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(organizationId: string) {
    return this.prisma.client.coupon.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, organizationId: string) {
    const coupon = await this.prisma.client.coupon.findFirst({
      where: { id, organizationId },
    });
    if (!coupon) throw new NotFoundException('Coupon not found');
    return coupon;
  }

  async create(
    organizationId: string,
    userId: string,
    input: CreateCouponInput,
  ) {
    const coupon = await this.prisma.client.coupon.create({
      data: {
        organizationId,
        code: input.code.toUpperCase(),
        type: input.type ?? 'PERCENTAGE',
        value: input.value,
        minOrderAmount: input.minOrderAmount ?? 0,
        maxUses: input.maxUses,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
      },
    });

    await this.audit.log({
      organizationId,
      userId,
      action: 'COUPON_CREATED',
      entityType: 'Coupon',
      entityId: coupon.id,
    });

    return coupon;
  }

  async update(
    id: string,
    organizationId: string,
    userId: string,
    input: UpdateCouponInput,
  ) {
    await this.findOne(id, organizationId);
    const coupon = await this.prisma.client.coupon.update({
      where: { id },
      data: input,
    });

    await this.audit.log({
      organizationId,
      userId,
      action: 'COUPON_UPDATED',
      entityType: 'Coupon',
      entityId: id,
    });

    return coupon;
  }

  async delete(id: string, organizationId: string, userId: string) {
    await this.findOne(id, organizationId);
    await this.prisma.client.coupon.update({
      where: { id },
      data: { isActive: false },
    });

    await this.audit.log({
      organizationId,
      userId,
      action: 'COUPON_DEACTIVATED',
      entityType: 'Coupon',
      entityId: id,
    });

    return { success: true };
  }

  async validate(organizationId: string, input: ValidateCouponInput) {
    const coupon = await this.prisma.client.coupon.findFirst({
      where: {
        organizationId,
        code: input.code.toUpperCase(),
        isActive: true,
      },
    });

    if (!coupon) {
      return { valid: false, reason: 'Coupon not found' };
    }

    const now = new Date();
    if (coupon.startsAt && coupon.startsAt > now) {
      return { valid: false, reason: 'Coupon not yet active' };
    }
    if (coupon.endsAt && coupon.endsAt < now) {
      return { valid: false, reason: 'Coupon expired' };
    }
    if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
      return { valid: false, reason: 'Coupon usage limit reached' };
    }
    if (input.orderAmount < coupon.minOrderAmount) {
      return {
        valid: false,
        reason: `Minimum order amount is ${coupon.minOrderAmount}`,
      };
    }

    let discountAmount = 0;
    if (coupon.type === 'PERCENTAGE') {
      discountAmount = Math.round(input.orderAmount * (coupon.value / 100));
    } else if (coupon.type === 'FIXED') {
      discountAmount = Math.min(coupon.value, input.orderAmount);
    } else {
      throw new BadRequestException('Unknown coupon type');
    }

    return {
      valid: true,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        type: coupon.type,
        value: coupon.value,
      },
      discountAmount,
      finalAmount: input.orderAmount - discountAmount,
    };
  }

  async redeem(id: string, organizationId: string, userId: string) {
    const coupon = await this.findOne(id, organizationId);

    if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
      throw new BadRequestException('Coupon usage limit reached');
    }

    const updated = await this.prisma.client.coupon.update({
      where: { id },
      data: { usedCount: { increment: 1 } },
    });

    await this.audit.log({
      organizationId,
      userId,
      action: 'COUPON_REDEEMED',
      entityType: 'Coupon',
      entityId: id,
    });

    return updated;
  }
}

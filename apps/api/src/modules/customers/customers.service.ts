import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { toInputJson } from '../../common/utils/prisma-json';
import { AuditService } from '../audit/audit.service';

export interface CreateCustomerInput {
  name?: string;
  phone?: string;
  email?: string;
  birthday?: Date;
  anniversary?: Date;
  notes?: string;
  preferences?: Record<string, unknown>;
}

export interface UpdateCustomerInput {
  name?: string;
  phone?: string;
  email?: string;
  birthday?: Date;
  anniversary?: Date;
  segment?: string;
  notes?: string;
  preferences?: Record<string, unknown>;
}

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(organizationId: string, segment?: string) {
    return this.prisma.client.customer.findMany({
      where: {
        organizationId,
        deletedAt: null,
        ...(segment ? { segment } : {}),
      },
      include: { loyaltyAccount: { include: { tier: true } } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findOne(id: string, organizationId: string) {
    const customer = await this.prisma.client.customer.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: {
        loyaltyAccount: { include: { tier: true } },
      },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  async create(
    organizationId: string,
    userId: string,
    input: CreateCustomerInput,
  ) {
    const customer = await this.prisma.client.customer.create({
      data: {
        organizationId,
        ...input,
        preferences: toInputJson(input.preferences ?? {}) ?? {},
        firstVisitAt: new Date(),
      },
    });

    await this.audit.log({
      organizationId,
      userId,
      action: 'CUSTOMER_CREATED',
      entityType: 'Customer',
      entityId: customer.id,
    });

    return customer;
  }

  async update(
    id: string,
    organizationId: string,
    userId: string,
    input: UpdateCustomerInput,
  ) {
    await this.findOne(id, organizationId);
    const customer = await this.prisma.client.customer.update({
      where: { id },
      data: {
        ...input,
        preferences: input.preferences ? toInputJson(input.preferences) : undefined,
      },
    });

    await this.audit.log({
      organizationId,
      userId,
      action: 'CUSTOMER_UPDATED',
      entityType: 'Customer',
      entityId: id,
    });

    return customer;
  }

  async delete(id: string, organizationId: string, userId: string) {
    await this.findOne(id, organizationId);
    await this.prisma.client.customer.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.audit.log({
      organizationId,
      userId,
      action: 'CUSTOMER_DELETED',
      entityType: 'Customer',
      entityId: id,
    });

    return { success: true };
  }

  async updateSegment(
    id: string,
    organizationId: string,
    userId: string,
    segment: string,
  ) {
    await this.findOne(id, organizationId);
    const customer = await this.prisma.client.customer.update({
      where: { id },
      data: { segment },
    });

    await this.audit.log({
      organizationId,
      userId,
      action: 'CUSTOMER_SEGMENT_UPDATED',
      entityType: 'Customer',
      entityId: id,
      newValue: { segment },
    });

    return customer;
  }

  async getOrderHistory(id: string, organizationId: string) {
    await this.findOne(id, organizationId);
    return this.prisma.client.order.findMany({
      where: { customerId: id, organizationId },
      include: {
        items: true,
        payments: true,
        outlet: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async getSegmentationSummary(organizationId: string) {
    const customers = await this.prisma.client.customer.groupBy({
      by: ['segment'],
      where: { organizationId, deletedAt: null },
      _count: { id: true },
      _sum: { totalSpending: true, orderCount: true },
    });

    return customers.map((c) => ({
      segment: c.segment,
      count: c._count.id,
      totalSpending: c._sum.totalSpending ?? 0,
      orderCount: c._sum.orderCount ?? 0,
    }));
  }
}

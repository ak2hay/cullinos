import { Injectable, NotFoundException } from '@nestjs/common';
import { calculateTax, TaxGroup as EngineTaxGroup } from '@cullinos/tax-engine';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

export interface CreateTaxGroupInput {
  name: string;
  isInclusive?: boolean;
  isActive?: boolean;
}

export interface UpdateTaxGroupInput {
  name?: string;
  isInclusive?: boolean;
  isActive?: boolean;
}

export interface CreateTaxRateInput {
  taxGroupId: string;
  name: string;
  rate: number;
  type?: string;
}

export interface UpdateTaxRateInput {
  name?: string;
  rate?: number;
  type?: string;
}

export interface CalculateTaxInput {
  amount: number;
  taxGroupId: string;
  isInterState?: boolean;
}

@Injectable()
export class TaxService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAllGroups(organizationId: string) {
    return this.prisma.client.taxGroup.findMany({
      where: { organizationId },
      include: { taxRates: true },
      orderBy: { name: 'asc' },
    });
  }

  async findGroup(id: string, organizationId: string) {
    const group = await this.prisma.client.taxGroup.findFirst({
      where: { id, organizationId },
      include: { taxRates: true },
    });
    if (!group) throw new NotFoundException('Tax group not found');
    return group;
  }

  async createGroup(
    organizationId: string,
    userId: string,
    input: CreateTaxGroupInput,
  ) {
    const group = await this.prisma.client.taxGroup.create({
      data: {
        organizationId,
        name: input.name,
        isInclusive: input.isInclusive ?? false,
        isActive: input.isActive ?? true,
      },
      include: { taxRates: true },
    });

    await this.audit.log({
      organizationId,
      userId,
      action: 'TAX_GROUP_CREATED',
      entityType: 'TaxGroup',
      entityId: group.id,
      newValue: { name: group.name },
    });

    return group;
  }

  async updateGroup(
    id: string,
    organizationId: string,
    userId: string,
    input: UpdateTaxGroupInput,
  ) {
    const existing = await this.findGroup(id, organizationId);
    const group = await this.prisma.client.taxGroup.update({
      where: { id },
      data: input,
      include: { taxRates: true },
    });

    await this.audit.log({
      organizationId,
      userId,
      action: 'TAX_GROUP_UPDATED',
      entityType: 'TaxGroup',
      entityId: id,
      previousValue: { name: existing.name },
      newValue: input as Record<string, unknown>,
    });

    return group;
  }

  async deleteGroup(id: string, organizationId: string, userId: string) {
    await this.findGroup(id, organizationId);
    await this.prisma.client.taxGroup.update({
      where: { id },
      data: { isActive: false },
    });

    await this.audit.log({
      organizationId,
      userId,
      action: 'TAX_GROUP_DEACTIVATED',
      entityType: 'TaxGroup',
      entityId: id,
    });

    return { success: true };
  }

  async createRate(
    organizationId: string,
    userId: string,
    input: CreateTaxRateInput,
  ) {
    await this.findGroup(input.taxGroupId, organizationId);
    const rate = await this.prisma.client.taxRate.create({
      data: {
        taxGroupId: input.taxGroupId,
        name: input.name,
        rate: input.rate,
        type: input.type ?? 'CGST',
      },
    });

    await this.audit.log({
      organizationId,
      userId,
      action: 'TAX_RATE_CREATED',
      entityType: 'TaxRate',
      entityId: rate.id,
    });

    return rate;
  }

  async updateRate(
    id: string,
    organizationId: string,
    userId: string,
    input: UpdateTaxRateInput,
  ) {
    const rate = await this.prisma.client.taxRate.findUnique({
      where: { id },
      include: { taxGroup: true },
    });
    if (!rate || rate.taxGroup.organizationId !== organizationId) {
      throw new NotFoundException('Tax rate not found');
    }

    const updated = await this.prisma.client.taxRate.update({
      where: { id },
      data: input,
    });

    await this.audit.log({
      organizationId,
      userId,
      action: 'TAX_RATE_UPDATED',
      entityType: 'TaxRate',
      entityId: id,
    });

    return updated;
  }

  async deleteRate(id: string, organizationId: string, userId: string) {
    const rate = await this.prisma.client.taxRate.findUnique({
      where: { id },
      include: { taxGroup: true },
    });
    if (!rate || rate.taxGroup.organizationId !== organizationId) {
      throw new NotFoundException('Tax rate not found');
    }

    await this.prisma.client.taxRate.delete({ where: { id } });

    await this.audit.log({
      organizationId,
      userId,
      action: 'TAX_RATE_DELETED',
      entityType: 'TaxRate',
      entityId: id,
    });

    return { success: true };
  }

  async calculateTaxForAmount(
    organizationId: string,
    input: CalculateTaxInput,
  ) {
    const group = await this.findGroup(input.taxGroupId, organizationId);
    const engineGroup: EngineTaxGroup = {
      id: group.id,
      name: group.name,
      isInclusive: group.isInclusive,
      rates: group.taxRates.map((r) => ({
        name: r.name,
        rate: r.rate,
        type: r.type as EngineTaxGroup['rates'][0]['type'],
      })),
    };

    return calculateTax({
      amount: input.amount,
      taxGroup: engineGroup,
      isInterState: input.isInterState,
    });
  }
}

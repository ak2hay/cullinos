import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

export interface CreateFranchiseeInput {
  name: string;
  code?: string;
  contactEmail?: string;
  contactPhone?: string;
}

export interface UpdateFranchiseeInput {
  name?: string;
  code?: string;
  contactEmail?: string;
  contactPhone?: string;
  isActive?: boolean;
}

export interface CreateAgreementInput {
  franchiseeId: string;
  outletId?: string;
  royaltyPct?: number;
  franchiseFee?: number;
  startsAt: Date;
  endsAt?: Date;
}

export interface UpdateAgreementInput {
  outletId?: string;
  royaltyPct?: number;
  franchiseFee?: number;
  startsAt?: Date;
  endsAt?: Date;
  status?: string;
}

@Injectable()
export class FranchiseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // --- Franchisees ---

  async findAllFranchisees(organizationId: string) {
    return this.prisma.client.franchisee.findMany({
      where: { organizationId },
      include: { agreements: true },
      orderBy: { name: 'asc' },
    });
  }

  async findFranchisee(id: string, organizationId: string) {
    const franchisee = await this.prisma.client.franchisee.findFirst({
      where: { id, organizationId },
      include: { agreements: true },
    });
    if (!franchisee) throw new NotFoundException('Franchisee not found');
    return franchisee;
  }

  async createFranchisee(
    organizationId: string,
    userId: string,
    input: CreateFranchiseeInput,
  ) {
    const franchisee = await this.prisma.client.franchisee.create({
      data: { organizationId, ...input },
    });

    await this.audit.log({
      organizationId,
      userId,
      action: 'FRANCHISEE_CREATED',
      entityType: 'Franchisee',
      entityId: franchisee.id,
    });

    return franchisee;
  }

  async updateFranchisee(
    id: string,
    organizationId: string,
    userId: string,
    input: UpdateFranchiseeInput,
  ) {
    await this.findFranchisee(id, organizationId);
    const franchisee = await this.prisma.client.franchisee.update({
      where: { id },
      data: input,
    });

    await this.audit.log({
      organizationId,
      userId,
      action: 'FRANCHISEE_UPDATED',
      entityType: 'Franchisee',
      entityId: id,
    });

    return franchisee;
  }

  async deleteFranchisee(id: string, organizationId: string, userId: string) {
    await this.findFranchisee(id, organizationId);
    await this.prisma.client.franchisee.update({
      where: { id },
      data: { isActive: false },
    });

    await this.audit.log({
      organizationId,
      userId,
      action: 'FRANCHISEE_DEACTIVATED',
      entityType: 'Franchisee',
      entityId: id,
    });

    return { success: true };
  }

  // --- Agreements ---

  async findAgreements(franchiseeId: string, organizationId: string) {
    await this.findFranchisee(franchiseeId, organizationId);
    return this.prisma.client.franchiseAgreement.findMany({
      where: { franchiseeId },
      orderBy: { startsAt: 'desc' },
    });
  }

  async createAgreement(
    organizationId: string,
    userId: string,
    input: CreateAgreementInput,
  ) {
    await this.findFranchisee(input.franchiseeId, organizationId);

    const agreement = await this.prisma.client.franchiseAgreement.create({
      data: {
        franchiseeId: input.franchiseeId,
        outletId: input.outletId,
        royaltyPct: input.royaltyPct ?? 0,
        franchiseFee: input.franchiseFee ?? 0,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        status: 'ACTIVE',
      },
    });

    await this.audit.log({
      organizationId,
      userId,
      outletId: input.outletId,
      action: 'FRANCHISE_AGREEMENT_CREATED',
      entityType: 'FranchiseAgreement',
      entityId: agreement.id,
    });

    return agreement;
  }

  async updateAgreement(
    id: string,
    organizationId: string,
    userId: string,
    input: UpdateAgreementInput,
  ) {
    const agreement = await this.prisma.client.franchiseAgreement.findUnique({
      where: { id },
      include: { franchisee: true },
    });
    if (!agreement || agreement.franchisee.organizationId !== organizationId) {
      throw new NotFoundException('Franchise agreement not found');
    }

    const updated = await this.prisma.client.franchiseAgreement.update({
      where: { id },
      data: input,
    });

    await this.audit.log({
      organizationId,
      userId,
      outletId: input.outletId ?? agreement.outletId ?? undefined,
      action: 'FRANCHISE_AGREEMENT_UPDATED',
      entityType: 'FranchiseAgreement',
      entityId: id,
    });

    return updated;
  }

  async terminateAgreement(
    id: string,
    organizationId: string,
    userId: string,
  ) {
    const agreement = await this.prisma.client.franchiseAgreement.findUnique({
      where: { id },
      include: { franchisee: true },
    });
    if (!agreement || agreement.franchisee.organizationId !== organizationId) {
      throw new NotFoundException('Franchise agreement not found');
    }

    const updated = await this.prisma.client.franchiseAgreement.update({
      where: { id },
      data: { status: 'TERMINATED', endsAt: new Date() },
    });

    await this.audit.log({
      organizationId,
      userId,
      outletId: agreement.outletId ?? undefined,
      action: 'FRANCHISE_AGREEMENT_TERMINATED',
      entityType: 'FranchiseAgreement',
      entityId: id,
    });

    return updated;
  }
}

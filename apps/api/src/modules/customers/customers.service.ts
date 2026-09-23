import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { normalizePhoneE164 } from "../../common/phone.util";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { ConsentService } from "../privacy/consent.service";
import { CustomerPrivacyService } from "../privacy/customer-privacy.service";
import { DPDP_PURPOSES } from "../privacy/privacy.constants";
import { newUnsubscribeToken } from "../privacy/privacy.crypto";

@Injectable()
export class CustomersService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private consent: ConsentService,
    private customerPrivacy: CustomerPrivacyService,
  ) {}

  list(orgId: string, q?: string) {
    return this.prisma.customer.findMany({
      where: {
        organizationId: orgId,
        anonymizedAt: null,
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
      where: { id, organizationId: orgId, anonymizedAt: null },
      include: {
        loyaltyTier: true,
        loyaltyTransactions: { orderBy: { createdAt: "desc" }, take: 50 },
      },
    });
    if (!customer) throw new NotFoundException("Customer not found");

    await this.audit.log({
      organizationId: orgId,
      action: "customer_pii_read",
      entityType: "Customer",
      entityId: id,
    });

    return customer;
  }

  async create(
    orgId: string,
    data: {
      name: string;
      phone?: string;
      email?: string;
      marketingEmailOptIn?: boolean;
      marketingSmsOptIn?: boolean;
    },
    actorUserId?: string,
  ) {
    if (!data.name?.trim()) throw new BadRequestException("name is required");

    const emailOptIn = Boolean(data.marketingEmailOptIn);
    const smsOptIn = Boolean(data.marketingSmsOptIn);

    const customer = await this.prisma.customer.create({
      data: {
        organizationId: orgId,
        name: data.name.trim(),
        phone: data.phone?.trim()
          ? normalizePhoneE164(data.phone.trim())
          : null,
        email: data.email?.trim() || null,
        unsubscribeToken: newUnsubscribeToken(),
      },
    });

    await this.consent.record({
      organizationId: orgId,
      subjectType: "customer",
      subjectId: customer.id,
      purpose: DPDP_PURPOSES.SERVICE,
      granted: true,
      source: "admin_crm",
      actorUserId,
    });

    if (emailOptIn) {
      await this.customerPrivacy.setMarketingEmailOptIn(
        orgId,
        customer.id,
        true,
        "admin_crm",
        { actorUserId },
      );
    }
    if (smsOptIn) {
      await this.customerPrivacy.setMarketingSmsOptIn(
        orgId,
        customer.id,
        true,
        "admin_crm",
        { actorUserId },
      );
    }

    return this.prisma.customer.findUniqueOrThrow({ where: { id: customer.id } });
  }

  async update(
    orgId: string,
    id: string,
    data: {
      name?: string;
      phone?: string;
      email?: string;
      marketingEmailOptIn?: boolean;
      marketingSmsOptIn?: boolean;
    },
    actorUserId?: string,
  ) {
    await this.get(orgId, id);
    const updated = await this.prisma.customer.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.phone !== undefined
          ? {
              phone: data.phone?.trim()
                ? normalizePhoneE164(data.phone.trim())
                : null,
            }
          : {}),
        ...(data.email !== undefined ? { email: data.email?.trim() || null } : {}),
      },
    });

    if (data.marketingEmailOptIn !== undefined) {
      await this.customerPrivacy.setMarketingEmailOptIn(
        orgId,
        id,
        data.marketingEmailOptIn,
        "admin_crm",
        { actorUserId },
      );
    }
    if (data.marketingSmsOptIn !== undefined) {
      await this.customerPrivacy.setMarketingSmsOptIn(
        orgId,
        id,
        data.marketingSmsOptIn,
        "admin_crm",
        { actorUserId },
      );
    }

    await this.audit.log({
      organizationId: orgId,
      userId: actorUserId,
      action: "customer_updated",
      entityType: "Customer",
      entityId: id,
    });

    return this.prisma.customer.findUniqueOrThrow({ where: { id } });
  }
}

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { ConsentService } from "./consent.service";
import { DPDP_NOTICE_VERSION, DPDP_PURPOSES } from "./privacy.constants";
import { newUnsubscribeToken } from "./privacy.crypto";

@Injectable()
export class CustomerPrivacyService {
  constructor(
    private prisma: PrismaService,
    private consent: ConsentService,
    private audit: AuditService,
  ) {}

  async ensureUnsubscribeToken(customerId: string): Promise<string> {
    const existing = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { unsubscribeToken: true },
    });
    if (existing?.unsubscribeToken) return existing.unsubscribeToken;
    const token = newUnsubscribeToken();
    await this.prisma.customer.update({
      where: { id: customerId },
      data: { unsubscribeToken: token },
    });
    return token;
  }

  async setMarketingEmailOptIn(
    organizationId: string,
    customerId: string,
    optIn: boolean,
    source: string,
    opts?: { actorUserId?: string; ipAddress?: string },
  ) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, organizationId, anonymizedAt: null },
    });
    if (!customer) throw new NotFoundException("Customer not found");

    const token =
      customer.unsubscribeToken ?? (await this.ensureUnsubscribeToken(customerId));

    const updated = await this.prisma.customer.update({
      where: { id: customerId },
      data: {
        marketingEmailOptIn: optIn,
        marketingOptInAt: optIn ? new Date() : customer.marketingOptInAt,
        marketingOptOutAt: optIn ? null : new Date(),
        unsubscribeToken: token,
      },
    });

    await this.consent.record({
      organizationId,
      subjectType: "customer",
      subjectId: customerId,
      purpose: DPDP_PURPOSES.MARKETING_EMAIL,
      granted: optIn,
      source,
      actorUserId: opts?.actorUserId,
      ipAddress: opts?.ipAddress,
    });

    return updated;
  }

  async setMarketingSmsOptIn(
    organizationId: string,
    customerId: string,
    optIn: boolean,
    source: string,
    opts?: { actorUserId?: string; ipAddress?: string },
  ) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, organizationId, anonymizedAt: null },
    });
    if (!customer) throw new NotFoundException("Customer not found");

    const updated = await this.prisma.customer.update({
      where: { id: customerId },
      data: {
        marketingSmsOptIn: optIn,
        marketingOptInAt: optIn ? new Date() : customer.marketingOptInAt,
        marketingOptOutAt: optIn ? null : new Date(),
      },
    });

    await this.consent.record({
      organizationId,
      subjectType: "customer",
      subjectId: customerId,
      purpose: DPDP_PURPOSES.MARKETING_SMS,
      granted: optIn,
      source,
      actorUserId: opts?.actorUserId,
      ipAddress: opts?.ipAddress,
    });

    return updated;
  }

  async unsubscribeByToken(token: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { unsubscribeToken: token.trim(), anonymizedAt: null },
    });
    if (!customer) throw new NotFoundException("Invalid unsubscribe link");

    await this.setMarketingEmailOptIn(
      customer.organizationId,
      customer.id,
      false,
      "unsubscribe_link",
    );

    return {
      ok: true,
      message: "You have been unsubscribed from promotional emails.",
      organizationId: customer.organizationId,
    };
  }

  async exportCustomer(organizationId: string, customerId: string, actorUserId?: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, organizationId },
      include: {
        loyaltyTier: true,
        loyaltyTransactions: { orderBy: { createdAt: "desc" }, take: 200 },
        orders: {
          orderBy: { createdAt: "desc" },
          take: 200,
          select: {
            id: true,
            orderNumber: true,
            status: true,
            total: true,
            customerName: true,
            createdAt: true,
            outletId: true,
          },
        },
        couponUsages: { take: 100 },
      },
    });
    if (!customer) throw new NotFoundException("Customer not found");

    const consents = await this.consent.listForSubject(
      organizationId,
      "customer",
      customerId,
    );

    await this.audit.log({
      organizationId,
      userId: actorUserId,
      action: "customer_data_export",
      entityType: "Customer",
      entityId: customerId,
      metadata: { recordCounts: { orders: customer.orders.length } },
    });

    const { unsubscribeToken: _t, ...safe } = customer;
    return {
      exportedAt: new Date().toISOString(),
      noticeVersion: DPDP_NOTICE_VERSION,
      customer: safe,
      consents,
    };
  }

  async eraseCustomer(
    organizationId: string,
    customerId: string,
    actorUserId?: string,
  ) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, organizationId },
    });
    if (!customer) throw new NotFoundException("Customer not found");
    if (customer.anonymizedAt) {
      throw new BadRequestException("Customer already anonymized");
    }

    const anonymizedPhone = `anon_${customerId.slice(0, 10)}_${randomBytes(3).toString("hex")}`;

    const updated = await this.prisma.customer.update({
      where: { id: customerId },
      data: {
        name: "Anonymized Customer",
        email: null,
        phone: anonymizedPhone,
        metadata: Prisma.DbNull,
        marketingEmailOptIn: false,
        marketingSmsOptIn: false,
        marketingOptOutAt: new Date(),
        unsubscribeToken: null,
        loyaltyPoints: 0,
        stampCount: 0,
        loyaltyTierId: null,
        anonymizedAt: new Date(),
      },
    });

    await this.prisma.order.updateMany({
      where: { customerId, organizationId },
      data: { customerName: "Anonymized Customer" },
    });

    await this.consent.record({
      organizationId,
      subjectType: "customer",
      subjectId: customerId,
      purpose: DPDP_PURPOSES.SERVICE,
      granted: false,
      source: "erasure_request",
      actorUserId,
    });

    await this.audit.log({
      organizationId,
      userId: actorUserId,
      action: "customer_erased",
      entityType: "Customer",
      entityId: customerId,
      metadata: { method: "anonymize" },
    });

    return {
      id: updated.id,
      anonymizedAt: updated.anonymizedAt,
      message: "Customer personal data anonymized",
    };
  }
}

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

const ANONYMIZED_NAME = "Anonymized Customer";

/** Order metadata keys that can hold a customer's contact or location. */
export const ORDER_METADATA_PII_KEYS = [
  "deliveryAddress",
  "deliveryPincode",
  "deliveryLatitude",
  "deliveryLongitude",
  "customerName",
  "customerPhone",
  "customerEmail",
  "guestName",
  "guestPhone",
  "guestEmail",
];

/**
 * Reservations are keyed by contact details, not customer id: match the last 10 phone
 * digits (bookings store the raw input) or the email.
 */
type ContactFilter = Prisma.ReservationWhereInput & Prisma.ReservationInviteWhereInput;

function reservationContactFilter(
  phone: string | null,
  email: string | null,
): ContactFilter[] | null {
  const filters: ContactFilter[] = [];
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length >= 10) filters.push({ customerPhone: { endsWith: digits.slice(-10) } });
  if (email?.trim()) {
    filters.push({ customerEmail: { equals: email.trim(), mode: "insensitive" } });
  }
  return filters.length ? filters : null;
}

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

  /** Read-only: link scanners prefetch GET URLs, so looking up a token must not opt anyone out. */
  async describeUnsubscribeToken(token: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { unsubscribeToken: token.trim(), anonymizedAt: null },
      select: { marketingEmailOptIn: true, marketingSmsOptIn: true },
    });
    if (!customer) throw new NotFoundException("Invalid unsubscribe link");
    return {
      valid: true,
      marketingEmailOptIn: customer.marketingEmailOptIn,
      marketingSmsOptIn: customer.marketingSmsOptIn,
    };
  }

  async unsubscribeByToken(token: string, channel: "email" | "sms" | "all" = "email") {
    const customer = await this.prisma.customer.findFirst({
      where: { unsubscribeToken: token.trim(), anonymizedAt: null },
    });
    if (!customer) throw new NotFoundException("Invalid unsubscribe link");

    if (channel === "email" || channel === "all") {
      await this.setMarketingEmailOptIn(
        customer.organizationId,
        customer.id,
        false,
        "unsubscribe_link",
      );
    }
    if (channel === "sms" || channel === "all") {
      await this.setMarketingSmsOptIn(
        customer.organizationId,
        customer.id,
        false,
        "unsubscribe_link",
      );
    }

    const what =
      channel === "all"
        ? "promotional emails and SMS"
        : channel === "sms"
          ? "promotional SMS"
          : "promotional emails";
    return {
      ok: true,
      message: `You have been unsubscribed from ${what}.`,
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
            type: true,
            status: true,
            total: true,
            customerName: true,
            notes: true,
            metadata: true,
            createdAt: true,
            outletId: true,
            deliveryOrder: {
              select: {
                address: true,
                pincode: true,
                latitude: true,
                longitude: true,
                status: true,
                deliveredAt: true,
              },
            },
            feedbackResponse: { select: { rating: true, comment: true, createdAt: true } },
          },
        },
        couponUsages: { take: 100 },
        guestMembership: { select: { guestUserId: true, createdAt: true } },
      },
    });
    if (!customer) throw new NotFoundException("Customer not found");

    const contactMatch = reservationContactFilter(customer.phone, customer.email);
    const [consents, reservations, reservationInvites] = await Promise.all([
      this.consent.listForSubject(organizationId, "customer", customerId),
      contactMatch
        ? this.prisma.reservation.findMany({
            where: { organizationId, OR: contactMatch },
            orderBy: { reservedAt: "desc" },
            take: 200,
            select: {
              id: true,
              outletId: true,
              customerName: true,
              customerPhone: true,
              customerEmail: true,
              partySize: true,
              reservedAt: true,
              status: true,
              notes: true,
              createdAt: true,
            },
          })
        : Promise.resolve([]),
      contactMatch
        ? this.prisma.reservationInvite.findMany({
            where: { organizationId, OR: contactMatch },
            orderBy: { createdAt: "desc" },
            take: 100,
            select: {
              id: true,
              outletId: true,
              customerName: true,
              customerPhone: true,
              customerEmail: true,
              status: true,
              createdAt: true,
            },
          })
        : Promise.resolve([]),
    ]);

    await this.audit.log({
      organizationId,
      userId: actorUserId,
      action: "customer_data_export",
      entityType: "Customer",
      entityId: customerId,
      metadata: {
        recordCounts: {
          orders: customer.orders.length,
          reservations: reservations.length,
          reservationInvites: reservationInvites.length,
        },
      },
    });

    const { unsubscribeToken: _t, ...safe } = customer;
    return {
      exportedAt: new Date().toISOString(),
      noticeVersion: DPDP_NOTICE_VERSION,
      customer: safe,
      reservations,
      reservationInvites,
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
    const contactMatch = reservationContactFilter(customer.phone, customer.email);

    const [updated, , , , feedback, reservations, invites, memberships] =
      await this.prisma.$transaction([
        this.prisma.customer.update({
          where: { id: customerId },
          data: {
            name: ANONYMIZED_NAME,
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
        }),
        this.prisma.order.updateMany({
          where: { customerId, organizationId },
          data: { customerName: ANONYMIZED_NAME },
        }),
        // Delivery address / pincode and aggregator contact copies live in order metadata.
        this.prisma.$executeRaw`
          UPDATE "orders"
          SET "metadata" = "metadata" - ${ORDER_METADATA_PII_KEYS}::text[]
          WHERE "customer_id" = ${customerId}
            AND "organization_id" = ${organizationId}
            AND "metadata" IS NOT NULL`,
        this.prisma.deliveryOrder.updateMany({
          where: { order: { customerId, organizationId } },
          data: { address: null, pincode: null, latitude: null, longitude: null },
        }),
        this.prisma.feedbackResponse.updateMany({
          where: { organizationId, order: { customerId } },
          data: { comment: null },
        }),
        this.prisma.reservation.updateMany({
          where: contactMatch ? { organizationId, OR: contactMatch } : { id: { in: [] } },
          data: {
            customerName: ANONYMIZED_NAME,
            customerPhone: anonymizedPhone,
            customerEmail: null,
            notes: null,
          },
        }),
        this.prisma.reservationInvite.updateMany({
          where: contactMatch ? { organizationId, OR: contactMatch } : { id: { in: [] } },
          data: {
            customerName: ANONYMIZED_NAME,
            customerPhone: anonymizedPhone,
            customerEmail: null,
          },
        }),
        // Unlink the Cullinos Guest app identity from this restaurant's customer record.
        this.prisma.guestOrgMembership.deleteMany({ where: { customerId, organizationId } }),
      ]);

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
      metadata: {
        method: "anonymize",
        counts: {
          feedback: feedback.count,
          reservations: reservations.count,
          reservationInvites: invites.count,
          guestMemberships: memberships.count,
        },
      },
    });

    return {
      id: updated.id,
      anonymizedAt: updated.anonymizedAt,
      message: "Customer personal data anonymized",
    };
  }
}

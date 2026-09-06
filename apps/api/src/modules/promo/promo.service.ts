import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { MailService } from "../mail/mail.service";

const SEND_DELAY_MS = 50;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Injectable()
export class PromoService {
  constructor(
    private prisma: PrismaService,
    private mail: MailService,
  ) {}

  listCustomerRecipients(organizationId: string) {
    return this.prisma.customer.findMany({
      where: {
        organizationId,
        email: { not: null },
        NOT: { email: "" },
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
      },
      take: 500,
      orderBy: { name: "asc" },
    });
  }

  async listOwnerRecipients() {
    const owners = await this.prisma.user.findMany({
      where: {
        status: "active",
        isSuperAdmin: false,
        userRoles: { some: { role: { slug: "owner" } } },
      },
      select: {
        id: true,
        email: true,
        name: true,
        organization: { select: { id: true, name: true } },
      },
      take: 1000,
      orderBy: { email: "asc" },
    });

    if (owners.length > 0) {
      return owners.map((o) => ({
        id: o.id,
        email: o.email,
        name: o.name,
        organizationId: o.organization.id,
        organizationName: o.organization.name,
      }));
    }

    const orgs = await this.prisma.organization.findMany({
      where: {
        email: { not: null },
        NOT: { email: "" },
        status: { in: ["active", "trial"] },
      },
      select: { id: true, name: true, email: true },
      take: 1000,
    });

    return orgs
      .filter((o): o is typeof o & { email: string } => !!o.email)
      .map((o) => ({
        id: `org:${o.id}`,
        email: o.email,
        name: o.name,
        organizationId: o.id,
        organizationName: o.name,
      }));
  }

  async sendCustomerCampaign(
    organizationId: string,
    createdByUserId: string,
    subject: string,
    body: string,
    customerIds?: string[],
  ) {
    const recipients = await this.prisma.customer.findMany({
      where: {
        organizationId,
        email: { not: null },
        NOT: { email: "" },
        ...(customerIds?.length ? { id: { in: customerIds } } : {}),
      },
      select: { id: true, email: true },
      take: 500,
    });

    const withEmail = recipients.filter(
      (r): r is { id: string; email: string } => !!r.email,
    );

    const campaign = await this.prisma.emailCampaign.create({
      data: {
        scope: "org_customers",
        organizationId,
        createdByUserId,
        subject,
        body,
        recipientCount: withEmail.length,
        status: "sending",
      },
    });

    let sentCount = 0;
    let failedCount = 0;

    for (const recipient of withEmail) {
      const ok = await this.mail.sendPromoEmail(recipient.email, subject, body);
      if (ok) sentCount += 1;
      else failedCount += 1;
      await sleep(SEND_DELAY_MS);
    }

    const status =
      sentCount === 0 && withEmail.length > 0
        ? "failed"
        : failedCount === withEmail.length && withEmail.length > 0
          ? "failed"
          : "sent";

    return this.prisma.emailCampaign.update({
      where: { id: campaign.id },
      data: { sentCount, failedCount, status },
    });
  }

  async sendOwnerCampaign(
    createdByUserId: string,
    subject: string,
    body: string,
    ownerUserIds?: string[],
  ) {
    const recipients = await this.listOwnerRecipients();
    const filtered = ownerUserIds?.length
      ? recipients.filter((r) => ownerUserIds.includes(r.id))
      : recipients;

    const campaign = await this.prisma.emailCampaign.create({
      data: {
        scope: "platform_owners",
        createdByUserId,
        subject,
        body,
        recipientCount: filtered.length,
        status: "sending",
      },
    });

    let sentCount = 0;
    let failedCount = 0;

    for (const recipient of filtered) {
      const ok = await this.mail.sendPromoEmail(recipient.email, subject, body);
      if (ok) sentCount += 1;
      else failedCount += 1;
      await sleep(SEND_DELAY_MS);
    }

    const status =
      sentCount === 0 && filtered.length > 0
        ? "failed"
        : failedCount === filtered.length && filtered.length > 0
          ? "failed"
          : "sent";

    return this.prisma.emailCampaign.update({
      where: { id: campaign.id },
      data: { sentCount, failedCount, status },
    });
  }

  listOwnerCampaigns(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    return this.prisma.emailCampaign.findMany({
      where: { scope: "platform_owners" },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        subject: true,
        recipientCount: true,
        sentCount: true,
        failedCount: true,
        status: true,
        createdAt: true,
      },
    });
  }
}

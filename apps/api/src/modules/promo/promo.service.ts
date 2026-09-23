import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { MailService } from "../mail/mail.service";
import { AuditService } from "../audit/audit.service";
import { CustomerPrivacyService } from "../privacy/customer-privacy.service";
import { Msg91Service } from "../sms/msg91.service";
import { WalletService } from "../wallet/wallet.service";

const SEND_DELAY_MS = 50;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function marketingSiteUrl(): string {
  return (
    process.env.MARKETING_SITE_URL?.replace(/\/$/, "") ||
    process.env.WEB_APP_URL?.replace(/\/$/, "") ||
    "https://cullinos.com"
  );
}

@Injectable()
export class PromoService {
  private readonly logger = new Logger(PromoService.name);

  constructor(
    private prisma: PrismaService,
    private mail: MailService,
    private audit: AuditService,
    private customerPrivacy: CustomerPrivacyService,
    private sms: Msg91Service,
    private wallet: WalletService,
  ) {}

  listCustomerRecipients(organizationId: string) {
    return this.prisma.customer.findMany({
      where: {
        organizationId,
        anonymizedAt: null,
        marketingEmailOptIn: true,
        email: { not: null },
        NOT: { email: "" },
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        marketingEmailOptIn: true,
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
        anonymizedAt: null,
        marketingEmailOptIn: true,
        email: { not: null },
        NOT: { email: "" },
        ...(customerIds?.length ? { id: { in: customerIds } } : {}),
      },
      select: { id: true, email: true, unsubscribeToken: true },
      take: 500,
    });

    const withEmail = recipients.filter(
      (r): r is { id: string; email: string; unsubscribeToken: string | null } =>
        !!r.email,
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
    const base = marketingSiteUrl();

    for (const recipient of withEmail) {
      const token =
        recipient.unsubscribeToken ??
        (await this.customerPrivacy.ensureUnsubscribeToken(recipient.id));
      const unsubscribeUrl = `${base}/unsubscribe?token=${encodeURIComponent(token)}`;
      const ok = await this.mail.sendPromoEmail(
        recipient.email,
        subject,
        body,
        { unsubscribeUrl },
      );
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

    await this.audit.log({
      organizationId,
      userId: createdByUserId,
      action: "promo_campaign_sent",
      entityType: "EmailCampaign",
      entityId: campaign.id,
      metadata: {
        recipientCount: withEmail.length,
        sentCount,
        failedCount,
        consentFiltered: true,
      },
    });

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

  listSmsRecipients(organizationId: string) {
    return this.prisma.customer.findMany({
      where: {
        organizationId,
        anonymizedAt: null,
        marketingSmsOptIn: true,
        phone: { not: null },
        NOT: { phone: "" },
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        marketingSmsOptIn: true,
      },
      take: 500,
      orderBy: { name: "asc" },
    });
  }

  async sendSmsCampaign(
    organizationId: string,
    createdByUserId: string,
    body: string,
    customerIds?: string[],
  ) {
    const recipients = await this.prisma.customer.findMany({
      where: {
        organizationId,
        anonymizedAt: null,
        marketingSmsOptIn: true,
        phone: { not: null },
        NOT: { phone: "" },
        ...(customerIds?.length ? { id: { in: customerIds } } : {}),
      },
      select: { id: true, phone: true },
      take: 500,
    });

    const phones = recipients
      .map((r) => r.phone)
      .filter((p): p is string => !!p);

    await this.wallet.assertCanAffordSms(organizationId, phones.length);

    const campaign = await this.prisma.smsCampaign.create({
      data: {
        organizationId,
        createdByUserId,
        body,
        recipientCount: phones.length,
        status: "sending",
      },
    });

    const result = await this.sms.sendCampaignSms(phones, body);
    const sentCount = result.sent;
    const failedCount = result.failed;
    const status =
      sentCount === 0 && phones.length > 0
        ? "failed"
        : failedCount === phones.length && phones.length > 0
          ? "failed"
          : "sent";

    let chargedPaise = 0;
    try {
      chargedPaise = await this.wallet.chargeForSmsSent(
        organizationId,
        campaign.id,
        sentCount,
      );
    } catch (err) {
      this.logger.error(
        `Failed to charge wallet for SMS campaign ${campaign.id}: ${
          err instanceof Error ? err.message : err
        }`,
      );
    }

    await this.audit.log({
      organizationId,
      userId: createdByUserId,
      action: "sms_campaign_sent",
      entityType: "SmsCampaign",
      entityId: campaign.id,
      metadata: {
        recipientCount: phones.length,
        sentCount,
        failedCount,
        chargedPaise,
        consentFiltered: true,
      },
    });

    return this.prisma.smsCampaign.update({
      where: { id: campaign.id },
      data: { sentCount, failedCount, status, chargedPaise },
    });
  }

  listSmsCampaigns(organizationId: string) {
    return this.prisma.smsCampaign.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        body: true,
        recipientCount: true,
        sentCount: true,
        failedCount: true,
        chargedPaise: true,
        status: true,
        createdAt: true,
      },
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

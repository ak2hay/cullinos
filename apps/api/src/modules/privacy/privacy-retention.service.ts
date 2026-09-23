import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CustomerPrivacyService } from "./customer-privacy.service";

const DAY_MS = 24 * 60 * 60 * 1000;
const INTERVAL_MS = 6 * 60 * 60 * 1000; // every 6 hours

@Injectable()
export class PrivacyRetentionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrivacyRetentionService.name);
  private timer?: ReturnType<typeof setInterval>;

  constructor(
    private prisma: PrismaService,
    private customerPrivacy: CustomerPrivacyService,
  ) {}

  onModuleInit() {
    // Stagger first run slightly after boot.
    setTimeout(() => {
      void this.runRetentionPass();
    }, 30_000);
    this.timer = setInterval(() => {
      void this.runRetentionPass();
    }, INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async runRetentionPass() {
    try {
      const otpDays = Number(process.env.PRIVACY_OTP_RETENTION_DAYS ?? 7);
      const handoffHours = Number(process.env.PRIVACY_HANDOFF_RETENTION_HOURS ?? 24);
      const inactiveDays = Number(
        process.env.PRIVACY_INACTIVE_CUSTOMER_DAYS ?? 1095,
      );

      const otpCutoff = new Date(Date.now() - otpDays * DAY_MS);
      const handoffCutoff = new Date(Date.now() - handoffHours * 60 * 60 * 1000);
      const inactiveCutoff = new Date(Date.now() - inactiveDays * DAY_MS);

      const [phoneOtps, emailOtps, handoffs] = await Promise.all([
        this.prisma.phoneOtp.deleteMany({
          where: {
            OR: [
              { expiresAt: { lt: otpCutoff } },
              { consumedAt: { lt: otpCutoff } },
            ],
          },
        }),
        this.prisma.emailOtp.deleteMany({
          where: {
            OR: [
              { expiresAt: { lt: otpCutoff } },
              { consumedAt: { lt: otpCutoff } },
            ],
          },
        }),
        this.prisma.impersonationHandoff.deleteMany({
          where: {
            OR: [
              { expiresAt: { lt: handoffCutoff } },
              { consumedAt: { lt: handoffCutoff } },
            ],
          },
        }),
      ]);

      let anonymizedCustomers = 0;
      if (inactiveDays > 0) {
        const stale = await this.prisma.customer.findMany({
          where: {
            anonymizedAt: null,
            createdAt: { lt: inactiveCutoff },
            orders: { none: { createdAt: { gte: inactiveCutoff } } },
          },
          select: { id: true, organizationId: true },
          take: 50,
        });

        for (const row of stale) {
          try {
            await this.customerPrivacy.eraseCustomer(
              row.organizationId,
              row.id,
              undefined,
            );
            anonymizedCustomers += 1;
          } catch (err) {
            this.logger.warn(
              `Inactive customer anonymize skipped ${row.id}: ${
                err instanceof Error ? err.message : String(err)
              }`,
            );
          }
        }
      }

      this.logger.log(
        `Privacy retention: phoneOtps=${phoneOtps.count} emailOtps=${emailOtps.count} handoffs=${handoffs.count} customersAnonymized=${anonymizedCustomers}`,
      );

      return {
        phoneOtps: phoneOtps.count,
        emailOtps: emailOtps.count,
        handoffs: handoffs.count,
        customersAnonymized: anonymizedCustomers,
      };
    } catch (err) {
      this.logger.error(
        `Privacy retention failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }
}

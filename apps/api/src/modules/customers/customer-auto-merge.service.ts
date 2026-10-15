import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { RedisService } from "../../common/redis/redis.service";
import { CustomersService } from "./customers.service";

const INTERVAL_MS = 6 * 60 * 60 * 1000;
const LOCK_KEY = "job-lock:customer-auto-merge";

/** Orgs with same-handset customers, or phones not yet stored as E.164. */
const ORGS_TO_MERGE_SQL = `
  SELECT DISTINCT organization_id AS "organizationId" FROM customers
  WHERE phone IS NOT NULL AND anonymized_at IS NULL AND phone NOT LIKE 'anon\\_%'
    AND length(regexp_replace(phone, '\\D', '', 'g')) BETWEEN 10 AND 15
    AND (phone !~ '^\\+[0-9]{11,15}$' OR phone ~ '^\\+910[0-9]{10}$' OR (organization_id, right(regexp_replace(phone, '\\D', '', 'g'), 10)) IN (
      SELECT organization_id, right(regexp_replace(phone, '\\D', '', 'g'), 10)
      FROM customers WHERE phone IS NOT NULL AND anonymized_at IS NULL AND phone NOT LIKE 'anon\\_%'
      GROUP BY 1, 2 HAVING count(*) > 1))`;

/** Merges duplicate customers (same handset, any stored format) in every org. */
@Injectable()
export class CustomerAutoMergeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CustomerAutoMergeService.name);
  private timer?: ReturnType<typeof setInterval>;

  constructor(
    private prisma: PrismaService,
    private customers: CustomersService,
    @Optional() private redis?: RedisService,
  ) {}

  onModuleInit() {
    if (process.env.NODE_ENV === "test") return;
    setTimeout(() => {
      void this.runScheduledPass();
    }, 60_000);
    this.timer = setInterval(() => {
      void this.runScheduledPass();
    }, INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async runScheduledPass() {
    const leased = await (this.redis?.acquireLock(LOCK_KEY, INTERVAL_MS - 60_000) ??
      Promise.resolve(true)).catch(() => false);
    if (!leased) return null;
    return this.runMergePass();
  }

  async runMergePass() {
    let orgs: { organizationId: string }[];
    try {
      orgs = await this.prisma.$queryRawUnsafe<{ organizationId: string }[]>(ORGS_TO_MERGE_SQL);
    } catch (err) {
      this.logger.error(`Duplicate scan failed: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
    let merged = 0;
    let normalized = 0;
    for (const { organizationId } of orgs) {
      try {
        const res = await this.customers.mergeDuplicates(organizationId, true, undefined, "auto");
        merged += res.duplicateCount;
        normalized += res.normalizedCount;
        if (res.duplicateCount || res.normalizedCount) {
          this.logger.log(
            `org ${organizationId}: merged ${res.duplicateCount} duplicate(s), normalized ${res.normalizedCount} phone(s)`,
          );
        }
      } catch (err) {
        this.logger.error(
          `Auto-merge failed for org ${organizationId}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    return { orgs: orgs.length, merged, normalized };
  }
}

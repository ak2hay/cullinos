import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import {
  type AggregatorIntegrationConfig,
  type AggregatorOutletConfig,
  type AggregatorProvider,
  defaultAggregatorRegistry,
} from "@cullinos/integrations";
import { Prisma } from "@prisma/client";
import { createHash, randomBytes } from "crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { OrdersService } from "../orders/orders.service";

const AGGREGATOR_PROVIDERS: AggregatorProvider[] = ["swiggy", "zomato"];

function emptyConfig(): AggregatorIntegrationConfig {
  return { webhookSecret: randomBytes(24).toString("hex"), outlets: {} };
}

function fingerprintSecret(secret: string | null | undefined): string | null {
  if (!secret) return null;
  const hash = createHash("sha256").update(secret).digest("hex").slice(0, 8);
  return `••••${hash}`;
}

function parseConfig(raw: unknown): AggregatorIntegrationConfig {
  const cfg = (raw ?? {}) as Record<string, unknown>;
  const outlets: Record<string, AggregatorOutletConfig> = {};
  const rawOutlets = cfg.outlets;
  if (rawOutlets && typeof rawOutlets === "object") {
    for (const [outletId, value] of Object.entries(rawOutlets as Record<string, unknown>)) {
      const row = (value ?? {}) as Record<string, unknown>;
      outlets[outletId] = {
        connected: Boolean(row.connected),
        menuSyncEnabled: Boolean(row.menuSyncEnabled),
        externalStoreId:
          typeof row.externalStoreId === "string" ? row.externalStoreId : undefined,
        itemSkuMap:
          row.itemSkuMap && typeof row.itemSkuMap === "object"
            ? (row.itemSkuMap as Record<string, string>)
            : undefined,
      };
    }
  }
  return {
    webhookSecret:
      typeof cfg.webhookSecret === "string" && cfg.webhookSecret
        ? cfg.webhookSecret
        : randomBytes(24).toString("hex"),
    outlets,
  };
}

export type SettlementImportRow = {
  provider: string;
  externalOrderId: string;
  orderDate: string;
  grossAmount: number;
  commission?: number;
  taxOnCommission?: number;
  payout: number;
  outletId?: string;
};

@Injectable()
export class AggregatorsService {
  constructor(
    private prisma: PrismaService,
    private orders: OrdersService,
  ) {}

  async list(orgId: string) {
    return Promise.all(
      AGGREGATOR_PROVIDERS.map(async (provider) => ({
        provider,
        ...(await this.describeProvider(orgId, provider)),
      })),
    );
  }

  private async getIntegration(orgId: string, provider: AggregatorProvider) {
    return this.prisma.integration.findFirst({
      where: { organizationId: orgId, provider },
    });
  }

  private describeProvider(orgId: string, provider: AggregatorProvider) {
    return this.getIntegration(orgId, provider).then((row) => {
      if (!row) {
        return {
          isActive: false,
          integrationId: null,
          webhookSecret: null as string | null,
          webhookSecretFingerprint: null as string | null,
          outlets: {} as Record<string, AggregatorOutletConfig>,
          webhookPath: `/aggregators/webhooks/${provider}/${orgId}`,
        };
      }
      const config = parseConfig(row.config);
      return {
        isActive: row.isActive,
        integrationId: row.id,
        // Never return the raw webhook secret on list/get — use regenerate to reveal once.
        webhookSecret: null as string | null,
        webhookSecretFingerprint: fingerprintSecret(config.webhookSecret),
        outlets: config.outlets,
        webhookPath: `/aggregators/webhooks/${provider}/${orgId}`,
      };
    });
  }

  async getProvider(orgId: string, provider: AggregatorProvider) {
    if (!AGGREGATOR_PROVIDERS.includes(provider)) {
      throw new BadRequestException("Unknown aggregator provider");
    }
    return this.describeProvider(orgId, provider);
  }

  async upsertProvider(
    orgId: string,
    provider: AggregatorProvider,
    input: {
      isActive?: boolean;
      webhookSecret?: string;
      outlets?: Record<string, AggregatorOutletConfig>;
    },
  ) {
    if (!AGGREGATOR_PROVIDERS.includes(provider)) {
      throw new BadRequestException("Unknown aggregator provider");
    }

    const existing = await this.getIntegration(orgId, provider);
    const config = parseConfig(existing?.config);
    if (input.webhookSecret?.trim()) config.webhookSecret = input.webhookSecret.trim();
    if (input.outlets) {
      for (const [outletId, outletCfg] of Object.entries(input.outlets)) {
        config.outlets[outletId] = {
          connected: outletCfg.connected ?? config.outlets[outletId]?.connected ?? false,
          menuSyncEnabled:
            outletCfg.menuSyncEnabled ??
            config.outlets[outletId]?.menuSyncEnabled ??
            false,
          externalStoreId:
            outletCfg.externalStoreId ?? config.outlets[outletId]?.externalStoreId,
          itemSkuMap: outletCfg.itemSkuMap ?? config.outlets[outletId]?.itemSkuMap,
        };
      }
    }

    const data = {
      config: config as unknown as Prisma.InputJsonValue,
      isActive: input.isActive ?? existing?.isActive ?? false,
    };

    const row = existing
      ? await this.prisma.integration.update({
          where: { id: existing.id },
          data,
        })
      : await this.prisma.integration.create({
          data: {
            organizationId: orgId,
            provider,
            ...data,
          },
        });

    return {
      provider,
      isActive: row.isActive,
      integrationId: row.id,
      // Return plaintext only when the caller just set/rotated the secret.
      webhookSecret: input.webhookSecret?.trim() ? config.webhookSecret : null,
      webhookSecretFingerprint: fingerprintSecret(config.webhookSecret),
      outlets: config.outlets,
      webhookPath: `/aggregators/webhooks/${provider}/${orgId}`,
    };
  }

  async regenerateWebhookSecret(orgId: string, provider: AggregatorProvider) {
    if (!AGGREGATOR_PROVIDERS.includes(provider)) {
      throw new BadRequestException("Unknown aggregator provider");
    }
    const existing = await this.getIntegration(orgId, provider);
    const config = parseConfig(existing?.config);
    config.webhookSecret = randomBytes(24).toString("hex");
    const data = {
      config: config as unknown as Prisma.InputJsonValue,
      isActive: existing?.isActive ?? false,
    };
    const row = existing
      ? await this.prisma.integration.update({ where: { id: existing.id }, data })
      : await this.prisma.integration.create({
          data: { organizationId: orgId, provider, ...data },
        });
    return {
      provider,
      isActive: row.isActive,
      integrationId: row.id,
      webhookSecret: config.webhookSecret,
      webhookSecretFingerprint: fingerprintSecret(config.webhookSecret),
      outlets: config.outlets,
      webhookPath: `/aggregators/webhooks/${provider}/${orgId}`,
    };
  }

  async updateOutletFlags(
    orgId: string,
    provider: AggregatorProvider,
    outletId: string,
    flags: Partial<Pick<AggregatorOutletConfig, "connected" | "menuSyncEnabled">>,
  ) {
    const outlet = await this.prisma.outlet.findFirst({
      where: { id: outletId, organizationId: orgId },
    });
    if (!outlet) throw new NotFoundException("Outlet not found");

    const existing = await this.getIntegration(orgId, provider);
    const config = parseConfig(existing?.config);
    const current = config.outlets[outletId] ?? {
      connected: false,
      menuSyncEnabled: false,
    };
    config.outlets[outletId] = {
      ...current,
      connected: flags.connected ?? current.connected,
      menuSyncEnabled: flags.menuSyncEnabled ?? current.menuSyncEnabled,
    };

    return this.upsertProvider(orgId, provider, {
      isActive: existing?.isActive ?? true,
      outlets: { [outletId]: config.outlets[outletId] },
    });
  }

  async syncMenu(orgId: string, provider: AggregatorProvider, outletId: string) {
    const integration = await this.getIntegration(orgId, provider);
    if (!integration?.isActive) {
      throw new BadRequestException("Aggregator integration is not active");
    }
    const config = parseConfig(integration.config);
    const outletCfg = config.outlets[outletId];
    if (!outletCfg?.connected || !outletCfg.menuSyncEnabled) {
      throw new BadRequestException("Menu sync is disabled for this outlet");
    }

    const items = await this.prisma.menuItem.findMany({
      where: { organizationId: orgId, isActive: true },
      select: { id: true, name: true, basePrice: true, description: true },
      take: 500,
    });

    const adapter = defaultAggregatorRegistry.get(provider);
    if (!adapter?.syncMenu) {
      return { synced: 0, skipped: items.length, message: "Sync stub — no external API" };
    }
    const result = await adapter.syncMenu(
      outletId,
      items.map((i) => ({
        id: i.id,
        name: i.name,
        price: Number(i.basePrice),
        description: i.description,
      })),
    );
    return { ...result, message: "Menu sync queued (stub)" };
  }

  private resolveOutletId(
    config: AggregatorIntegrationConfig,
    queryOutletId?: string,
    externalStoreId?: string,
  ): string | null {
    if (queryOutletId && config.outlets[queryOutletId]?.connected) {
      return queryOutletId;
    }
    if (externalStoreId) {
      for (const [outletId, cfg] of Object.entries(config.outlets)) {
        if (cfg.connected && cfg.externalStoreId === externalStoreId) return outletId;
      }
    }
    const connected = Object.entries(config.outlets).find(([, cfg]) => cfg.connected);
    return connected?.[0] ?? null;
  }

  async ingestWebhook(
    orgId: string,
    provider: AggregatorProvider,
    secret: string | undefined,
    payload: unknown,
    queryOutletId?: string,
  ) {
    const integration = await this.getIntegration(orgId, provider);
    if (!integration?.isActive) {
      throw new UnauthorizedException("Aggregator not connected");
    }

    const config = parseConfig(integration.config);
    if (!secret || secret !== config.webhookSecret) {
      throw new UnauthorizedException("Invalid aggregator secret");
    }

    const body = (payload ?? {}) as Record<string, unknown>;
    const externalStoreId =
      typeof body.outlet_external_id === "string"
        ? body.outlet_external_id
        : typeof body.restaurant_id === "string"
          ? body.restaurant_id
          : undefined;

    const outletId = this.resolveOutletId(config, queryOutletId, externalStoreId);
    if (!outletId) {
      throw new BadRequestException("No connected outlet matched for webhook");
    }

    const outletCfg = config.outlets[outletId];
    const adapter = defaultAggregatorRegistry.get(provider);
    if (!adapter) throw new BadRequestException("Adapter not found");

    const normalized = adapter.normalizeWebhookPayload(payload, {
      outletId,
      itemSkuMap: outletCfg?.itemSkuMap,
    });

    if (!normalized.items.length) {
      throw new BadRequestException("Webhook payload has no order items");
    }

    const order = await this.orders.create(orgId, null, {
      outletId,
      source: provider.toUpperCase(),
      type: normalized.orderType,
      customerName: normalized.customerName,
      notes: normalized.notes,
      items: normalized.items.map((item) =>
        item.menuItemId
          ? {
              menuItemId: item.menuItemId,
              quantity: item.quantity,
              notes: item.notes,
            }
          : {
              name: item.name,
              unitPrice: item.unitPrice,
              quantity: item.quantity,
              notes: item.notes,
            },
      ),
      idempotencyKey: normalized.idempotencyKey,
      autoConfirm: true,
      metadata: {
        aggregator: {
          provider,
          externalOrderId: normalized.externalOrderId,
          customerPhone: normalized.customerPhone,
          commission: normalized.commission,
          payout: normalized.payout,
          placedAt: normalized.placedAt,
        },
      },
    });

    return { ok: true, orderId: order.id, externalOrderId: normalized.externalOrderId };
  }

  async importSettlements(
    orgId: string,
    rows: SettlementImportRow[],
    format: "csv" | "json",
  ) {
    if (!rows.length) throw new BadRequestException("No settlement rows to import");

    const batchId = `batch_${Date.now()}`;
    let imported = 0;
    let skipped = 0;

    for (const row of rows) {
      const provider = row.provider.toLowerCase();
      if (!AGGREGATOR_PROVIDERS.includes(provider as AggregatorProvider)) {
        skipped++;
        continue;
      }

      const orderDate = new Date(row.orderDate);
      if (Number.isNaN(orderDate.getTime())) {
        skipped++;
        continue;
      }

      let orderId: string | null = null;
      const matchedOrder = await this.prisma.order.findFirst({
        where: {
          organizationId: orgId,
          metadata: {
            path: ["aggregator", "externalOrderId"],
            equals: row.externalOrderId,
          },
        },
        select: { id: true },
      });
      if (matchedOrder) orderId = matchedOrder.id;

      try {
        await this.prisma.aggregatorSettlement.upsert({
          where: {
            organizationId_provider_externalOrderId: {
              organizationId: orgId,
              provider,
              externalOrderId: row.externalOrderId,
            },
          },
          create: {
            organizationId: orgId,
            outletId: row.outletId,
            provider,
            externalOrderId: row.externalOrderId,
            orderId,
            orderDate,
            grossAmount: row.grossAmount,
            commission: row.commission ?? 0,
            taxOnCommission: row.taxOnCommission ?? 0,
            payout: row.payout,
            batchId,
            rawPayload: { format, row } as Prisma.InputJsonValue,
          },
          update: {
            outletId: row.outletId,
            orderId,
            orderDate,
            grossAmount: row.grossAmount,
            commission: row.commission ?? 0,
            taxOnCommission: row.taxOnCommission ?? 0,
            payout: row.payout,
            batchId,
            rawPayload: { format, row } as Prisma.InputJsonValue,
          },
        });
        imported++;
      } catch {
        skipped++;
      }
    }

    return { batchId, imported, skipped, total: rows.length };
  }

  parseSettlementCsv(text: string): SettlementImportRow[] {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 2) return [];

    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const idx = (name: string) => headers.indexOf(name);

    return lines.slice(1).map((line) => {
      const cols = line.split(",").map((c) => c.trim());
      return {
        provider: cols[idx("provider")] ?? "",
        externalOrderId: cols[idx("external_order_id")] ?? cols[idx("externalorderid")] ?? "",
        orderDate: cols[idx("order_date")] ?? cols[idx("orderdate")] ?? "",
        grossAmount: Number(cols[idx("gross_amount")] ?? cols[idx("grossamount")] ?? 0),
        commission: Number(cols[idx("commission")] ?? 0),
        taxOnCommission: Number(
          cols[idx("tax_on_commission")] ?? cols[idx("taxoncommission")] ?? 0,
        ),
        payout: Number(cols[idx("payout")] ?? 0),
        outletId: cols[idx("outlet_id")] || cols[idx("outletid")] || undefined,
      };
    });
  }

  async reconciliationReport(
    orgId: string,
    filters: { from?: string; to?: string; outletId?: string; provider?: string },
  ) {
    const from = filters.from ? new Date(filters.from) : new Date(Date.now() - 30 * 86400000);
    from.setHours(0, 0, 0, 0);
    const to = filters.to ? new Date(filters.to) : new Date();
    to.setHours(23, 59, 59, 999);

    const settlements = await this.prisma.aggregatorSettlement.findMany({
      where: {
        organizationId: orgId,
        orderDate: { gte: from, lte: to },
        ...(filters.outletId ? { outletId: filters.outletId } : {}),
        ...(filters.provider ? { provider: filters.provider.toLowerCase() } : {}),
      },
      include: {
        order: { select: { id: true, orderNumber: true, total: true, metadata: true } },
        outlet: { select: { id: true, name: true } },
      },
      orderBy: { orderDate: "desc" },
      take: 500,
    });

    const rows = settlements.map((s) => {
      const posTotal = s.order ? Number(s.order.total) : null;
      const gross = Number(s.grossAmount);
      const commission = Number(s.commission);
      const payout = Number(s.payout);
      const variance = posTotal != null ? gross - posTotal : null;
      return {
        id: s.id,
        provider: s.provider,
        externalOrderId: s.externalOrderId,
        orderDate: s.orderDate.toISOString().slice(0, 10),
        outletId: s.outletId,
        outletName: s.outlet?.name ?? null,
        orderId: s.orderId,
        orderNumber: s.order?.orderNumber ?? null,
        grossAmount: gross,
        commission,
        payout,
        posTotal,
        variance,
        matched: Boolean(s.orderId),
      };
    });

    const summary = {
      count: rows.length,
      matched: rows.filter((r) => r.matched).length,
      unmatched: rows.filter((r) => !r.matched).length,
      totalGross: rows.reduce((s, r) => s + r.grossAmount, 0),
      totalCommission: rows.reduce((s, r) => s + r.commission, 0),
      totalPayout: rows.reduce((s, r) => s + r.payout, 0),
      totalVariance: rows.reduce((s, r) => s + (r.variance ?? 0), 0),
    };

    return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10), summary, rows };
  }
}

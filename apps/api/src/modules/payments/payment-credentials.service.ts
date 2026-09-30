import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  decryptSecret,
  encryptSecret,
  encryptionKeyConfigured,
} from "../platform-config/crypto.util";
import { PrismaService } from "../../prisma/prisma.service";
import {
  emptyPaymentGatewayConfig,
  isPaymentGatewayProvider,
  maskKeyId,
  parsePaymentGatewayConfig,
  PAYMENT_GATEWAY_PROVIDERS,
  type GatewayPublicStatus,
  type PaymentGatewayIntegrationConfig,
  type PaymentGatewayMode,
  type PaymentGatewayOutletConfig,
  type PaymentGatewayProvider,
  type ResolvedPaymentCredentials,
} from "./payment-gateway.types";

@Injectable()
export class PaymentCredentialsService {
  constructor(private prisma: PrismaService) {}

  async listGateways(orgId: string): Promise<GatewayPublicStatus[]> {
    return Promise.all(
      PAYMENT_GATEWAY_PROVIDERS.map((provider: PaymentGatewayProvider) =>
        this.describeProvider(orgId, provider),
      ),
    );
  }

  async getGateway(
    orgId: string,
    provider: string,
  ): Promise<GatewayPublicStatus> {
    if (!isPaymentGatewayProvider(provider)) {
      throw new BadRequestException("Unknown payment gateway provider");
    }
    return this.describeProvider(orgId, provider);
  }

  async upsertOrgGateway(
    orgId: string,
    provider: string,
    input: {
      isActive?: boolean;
      isDefault?: boolean;
      mode?: PaymentGatewayMode;
      keyId?: string;
      secret?: string;
      webhookSecret?: string;
      clearWebhookSecret?: boolean;
    },
  ): Promise<GatewayPublicStatus> {
    if (!isPaymentGatewayProvider(provider)) {
      throw new BadRequestException("Unknown payment gateway provider");
    }
    this.requireEncryption();

    const existing = await this.getIntegration(orgId, provider);
    const config = parsePaymentGatewayConfig(existing?.config);

    if (input.keyId !== undefined) config.keyId = input.keyId.trim();
    if (input.secret?.trim()) {
      config.secretEnc = encryptSecret(input.secret.trim());
    }
    if (input.clearWebhookSecret) {
      config.webhookSecretEnc = undefined;
    } else if (input.webhookSecret?.trim()) {
      config.webhookSecretEnc = encryptSecret(input.webhookSecret.trim());
    }
    if (input.mode) config.mode = input.mode;

    const willBeActive = input.isActive ?? existing?.isActive ?? false;
    const wantDefault =
      input.isDefault === true ||
      (input.isDefault !== false &&
        (config.isDefault ||
          (!(await this.hasAnyDefault(orgId, provider)) && willBeActive)));

    if (input.isDefault === false) {
      config.isDefault = false;
    } else if (wantDefault && willBeActive) {
      config.isDefault = true;
      await this.clearDefaultFlags(orgId, provider);
    }

    if (!config.keyId || !config.secretEnc) {
      if (willBeActive) {
        throw new BadRequestException(
          "Key ID and secret are required to activate this gateway",
        );
      }
    }

    const data = {
      config: config as unknown as Prisma.InputJsonValue,
      isActive: willBeActive,
    };

    if (existing) {
      await this.prisma.integration.update({
        where: { id: existing.id },
        data,
      });
    } else {
      await this.prisma.integration.create({
        data: {
          organizationId: orgId,
          provider,
          ...data,
        },
      });
    }

    return this.describeProvider(orgId, provider);
  }

  async upsertOutletOverride(
    orgId: string,
    provider: string,
    outletId: string,
    input: {
      override: boolean;
      preferProvider?: boolean;
      mode?: PaymentGatewayMode;
      keyId?: string;
      secret?: string;
      webhookSecret?: string;
      clearWebhookSecret?: boolean;
    },
  ): Promise<GatewayPublicStatus> {
    if (!isPaymentGatewayProvider(provider)) {
      throw new BadRequestException("Unknown payment gateway provider");
    }
    this.requireEncryption();

    const outlet = await this.prisma.outlet.findFirst({
      where: { id: outletId, organizationId: orgId },
    });
    if (!outlet) throw new NotFoundException("Outlet not found");

    const existing = await this.getIntegration(orgId, provider);
    if (!existing) {
      throw new BadRequestException(
        "Configure organization gateway credentials before adding outlet overrides",
      );
    }

    const config = parsePaymentGatewayConfig(existing.config);
    const current: PaymentGatewayOutletConfig = config.outlets?.[outletId] ?? {
      override: false,
    };

    if (!input.override) {
      config.outlets = {
        ...(config.outlets ?? {}),
        [outletId]: {
          override: false,
          preferProvider: Boolean(input.preferProvider),
        },
      };
    } else {
      const next: PaymentGatewayOutletConfig = {
        override: true,
        preferProvider: input.preferProvider ?? current.preferProvider,
        keyId: input.keyId?.trim() || current.keyId,
        secretEnc: current.secretEnc,
        webhookSecretEnc: current.webhookSecretEnc,
        mode: input.mode ?? current.mode,
      };
      if (input.secret?.trim()) {
        next.secretEnc = encryptSecret(input.secret.trim());
      }
      if (input.clearWebhookSecret) {
        next.webhookSecretEnc = undefined;
      } else if (input.webhookSecret?.trim()) {
        next.webhookSecretEnc = encryptSecret(input.webhookSecret.trim());
      }
      if (!next.keyId || !next.secretEnc) {
        throw new BadRequestException(
          "Outlet override requires Key ID and secret",
        );
      }
      config.outlets = { ...(config.outlets ?? {}), [outletId]: next };
    }

    await this.prisma.integration.update({
      where: { id: existing.id },
      data: { config: config as unknown as Prisma.InputJsonValue },
    });

    return this.describeProvider(orgId, provider);
  }

  /**
   * Resolve credentials for diner payments.
   * Provider: explicit → outlet preferProvider → org isDefault → first active.
   */
  async resolve(
    orgId: string,
    outletId: string | null | undefined,
    preferredProvider?: PaymentGatewayProvider | string | null,
  ): Promise<ResolvedPaymentCredentials> {
    const rows = await this.prisma.integration.findMany({
      where: {
        organizationId: orgId,
        provider: { in: [...PAYMENT_GATEWAY_PROVIDERS] },
        isActive: true,
      },
    });

    const parsed = rows.map((row) => ({
      provider: row.provider as PaymentGatewayProvider,
      config: parsePaymentGatewayConfig(row.config),
    }));

    if (parsed.length === 0) {
      throw new BadRequestException(
        "Online payments are not configured. Add Razorpay or Cashfree credentials in Settings → Payments.",
      );
    }

    let provider: PaymentGatewayProvider | null = null;
    if (
      preferredProvider &&
      isPaymentGatewayProvider(preferredProvider) &&
      parsed.some((p) => p.provider === preferredProvider)
    ) {
      provider = preferredProvider;
    } else if (outletId) {
      const preferred = parsed.find(
        (p) => p.config.outlets?.[outletId]?.preferProvider === true,
      );
      if (preferred) provider = preferred.provider;
    }
    if (!provider) {
      const def = parsed.find((p) => p.config.isDefault);
      provider = def?.provider ?? parsed[0]!.provider;
    }

    const entry = parsed.find((p) => p.provider === provider)!;
    return this.resolveFromConfig(orgId, outletId ?? null, provider, entry.config);
  }

  /** Whether online (UPI/card) checkout can run for this org/outlet, without exposing secrets. */
  async onlineStatus(
    orgId: string,
    outletId?: string | null,
  ): Promise<{ onlineEnabled: boolean; provider: PaymentGatewayProvider | null }> {
    if (outletId) {
      const outlet = await this.prisma.outlet.findFirst({
        where: { id: outletId, organizationId: orgId },
        select: { id: true },
      });
      if (!outlet) throw new NotFoundException("Outlet not found");
    }
    try {
      const resolved = await this.resolve(orgId, outletId ?? null);
      return { onlineEnabled: true, provider: resolved.provider };
    } catch (err) {
      if (err instanceof BadRequestException) {
        return { onlineEnabled: false, provider: null };
      }
      throw err;
    }
  }

  /** Resolve credentials for a known provider (e.g. webhook verification). */
  async resolveForProvider(
    orgId: string,
    provider: PaymentGatewayProvider,
    outletId?: string | null,
  ): Promise<ResolvedPaymentCredentials | null> {
    const row = await this.getIntegration(orgId, provider);
    if (!row?.isActive) return null;
    const config = parsePaymentGatewayConfig(row.config);
    try {
      return this.resolveFromConfig(orgId, outletId ?? null, provider, config);
    } catch {
      return null;
    }
  }

  private resolveFromConfig(
    orgId: string,
    outletId: string | null,
    provider: PaymentGatewayProvider,
    config: PaymentGatewayIntegrationConfig,
  ): ResolvedPaymentCredentials {
    const outletCfg =
      outletId && config.outlets?.[outletId]?.override
        ? config.outlets[outletId]
        : null;

    const keyId = (outletCfg?.keyId || config.keyId || "").trim();
    const secretEnc = outletCfg?.secretEnc || config.secretEnc;
    const webhookSecretEnc =
      outletCfg?.webhookSecretEnc || config.webhookSecretEnc;
    const mode: PaymentGatewayMode =
      outletCfg?.mode ||
      config.mode ||
      (provider === "cashfree" ? "sandbox" : "production");

    if (!keyId || !secretEnc) {
      throw new BadRequestException(
        `${provider} credentials are incomplete for this outlet. Configure them in Settings → Payments.`,
      );
    }

    let secret: string;
    let webhookSecret: string | undefined;
    try {
      secret = decryptSecret(secretEnc);
      if (webhookSecretEnc) webhookSecret = decryptSecret(webhookSecretEnc);
    } catch {
      throw new BadRequestException(
        "Could not decrypt payment gateway secrets. Check ENCRYPTION_KEY.",
      );
    }

    return {
      provider,
      organizationId: orgId,
      outletId,
      keyId,
      secret,
      webhookSecret,
      mode,
      usedOutletOverride: Boolean(outletCfg),
    };
  }

  private async describeProvider(
    orgId: string,
    provider: PaymentGatewayProvider,
  ): Promise<GatewayPublicStatus> {
    const row = await this.getIntegration(orgId, provider);
    if (!row) {
      return {
        provider,
        isActive: false,
        isDefault: false,
        configured: false,
        keyIdMasked: null,
        hasWebhookSecret: false,
        mode: provider === "cashfree" ? "sandbox" : null,
        webhookPath: `/payments/webhooks/${provider}`,
        outlets: {},
      };
    }
    const config = parsePaymentGatewayConfig(row.config);
    const outlets: GatewayPublicStatus["outlets"] = {};
    for (const [outletId, cfg] of Object.entries(config.outlets ?? {}) as Array<
      [string, PaymentGatewayOutletConfig]
    >) {
      outlets[outletId] = {
        override: cfg.override,
        configured: Boolean(cfg.override && cfg.keyId && cfg.secretEnc),
        keyIdMasked: maskKeyId(cfg.keyId),
        preferProvider: Boolean(cfg.preferProvider),
        mode: cfg.mode ?? null,
      };
    }
    return {
      provider,
      isActive: row.isActive,
      isDefault: config.isDefault,
      configured: Boolean(config.keyId && config.secretEnc),
      keyIdMasked: maskKeyId(config.keyId),
      hasWebhookSecret: Boolean(config.webhookSecretEnc),
      mode: config.mode ?? (provider === "cashfree" ? "sandbox" : null),
      webhookPath: `/payments/webhooks/${provider}`,
      outlets,
    };
  }

  private getIntegration(orgId: string, provider: PaymentGatewayProvider) {
    return this.prisma.integration.findFirst({
      where: { organizationId: orgId, provider },
    });
  }

  private async hasAnyDefault(
    orgId: string,
    exceptProvider: PaymentGatewayProvider,
  ): Promise<boolean> {
    const rows = await this.prisma.integration.findMany({
      where: {
        organizationId: orgId,
        provider: { in: [...PAYMENT_GATEWAY_PROVIDERS] },
        isActive: true,
      },
    });
    return rows.some((row) => {
      if (row.provider === exceptProvider) return false;
      return parsePaymentGatewayConfig(row.config).isDefault;
    });
  }

  private async clearDefaultFlags(
    orgId: string,
    exceptProvider: PaymentGatewayProvider,
  ) {
    const rows = await this.prisma.integration.findMany({
      where: {
        organizationId: orgId,
        provider: { in: [...PAYMENT_GATEWAY_PROVIDERS] },
      },
    });
    for (const row of rows) {
      if (row.provider === exceptProvider) continue;
      const config = parsePaymentGatewayConfig(row.config);
      if (!config.isDefault) continue;
      config.isDefault = false;
      await this.prisma.integration.update({
        where: { id: row.id },
        data: { config: config as unknown as Prisma.InputJsonValue },
      });
    }
  }

  private requireEncryption() {
    if (!encryptionKeyConfigured()) {
      throw new BadRequestException(
        "ENCRYPTION_KEY is required to store payment gateway secrets",
      );
    }
  }
}

/** Exported for unit tests without Nest DI. */
export function resolveCredentialsFromConfigs(
  orgId: string,
  outletId: string | null,
  preferredProvider: PaymentGatewayProvider | null,
  entries: Array<{
    provider: PaymentGatewayProvider;
    isActive: boolean;
    config: PaymentGatewayIntegrationConfig;
  }>,
  decrypt: (enc: string) => string = decryptSecret,
): ResolvedPaymentCredentials {
  const parsed = entries.filter((e) => e.isActive);
  if (parsed.length === 0) {
    throw new BadRequestException("Online payments are not configured");
  }

  let provider: PaymentGatewayProvider | null = null;
  if (
    preferredProvider &&
    parsed.some((p) => p.provider === preferredProvider)
  ) {
    provider = preferredProvider;
  } else if (outletId) {
    const preferred = parsed.find(
      (p) => p.config.outlets?.[outletId]?.preferProvider === true,
    );
    if (preferred) provider = preferred.provider;
  }
  if (!provider) {
    const def = parsed.find((p) => p.config.isDefault);
    provider = def?.provider ?? parsed[0]!.provider;
  }

  const entry = parsed.find((p) => p.provider === provider)!;
  const config = entry.config;
  const outletCfg =
    outletId && config.outlets?.[outletId]?.override
      ? config.outlets[outletId]
      : null;

  const keyId = (outletCfg?.keyId || config.keyId || "").trim();
  const secretEnc = outletCfg?.secretEnc || config.secretEnc;
  if (!keyId || !secretEnc) {
    throw new BadRequestException("Credentials incomplete");
  }

  return {
    provider,
    organizationId: orgId,
    outletId,
    keyId,
    secret: decrypt(secretEnc),
    webhookSecret: outletCfg?.webhookSecretEnc
      ? decrypt(outletCfg.webhookSecretEnc)
      : config.webhookSecretEnc
        ? decrypt(config.webhookSecretEnc)
        : undefined,
    mode:
      outletCfg?.mode ||
      config.mode ||
      (provider === "cashfree" ? "sandbox" : "production"),
    usedOutletOverride: Boolean(outletCfg),
  };
}

export { emptyPaymentGatewayConfig, parsePaymentGatewayConfig };

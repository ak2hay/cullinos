import type {
  PaymentGatewayIntegrationConfig,
  PaymentGatewayMode,
  PaymentGatewayOutletConfig,
  PaymentGatewayProvider,
} from "@cullinos/integrations";
import { PAYMENT_GATEWAY_PROVIDERS } from "@cullinos/integrations";

export {
  PAYMENT_GATEWAY_PROVIDERS,
  type PaymentGatewayIntegrationConfig,
  type PaymentGatewayMode,
  type PaymentGatewayOutletConfig,
  type PaymentGatewayProvider,
};

export type ResolvedPaymentCredentials = {
  provider: PaymentGatewayProvider;
  organizationId: string;
  outletId: string | null;
  keyId: string;
  secret: string;
  webhookSecret?: string;
  mode: PaymentGatewayMode;
  /** True when outlet-level override credentials were used */
  usedOutletOverride: boolean;
};

export type GatewayPublicStatus = {
  provider: PaymentGatewayProvider;
  isActive: boolean;
  isDefault: boolean;
  configured: boolean;
  keyIdMasked: string | null;
  hasWebhookSecret: boolean;
  mode: PaymentGatewayMode | null;
  webhookPath: string;
  outlets: Record<
    string,
    {
      override: boolean;
      configured: boolean;
      keyIdMasked: string | null;
      preferProvider: boolean;
      mode: PaymentGatewayMode | null;
    }
  >;
};

export function isPaymentGatewayProvider(
  value: string,
): value is PaymentGatewayProvider {
  return (PAYMENT_GATEWAY_PROVIDERS as string[]).includes(value);
}

export function emptyPaymentGatewayConfig(
  isDefault = false,
): PaymentGatewayIntegrationConfig {
  return {
    isDefault,
    keyId: "",
    secretEnc: "",
    outlets: {},
  };
}

export function parsePaymentGatewayConfig(
  raw: unknown,
): PaymentGatewayIntegrationConfig {
  const cfg = (raw ?? {}) as Record<string, unknown>;
  const outlets: Record<string, PaymentGatewayOutletConfig> = {};
  const rawOutlets = cfg.outlets;
  if (rawOutlets && typeof rawOutlets === "object") {
    for (const [outletId, value] of Object.entries(
      rawOutlets as Record<string, unknown>,
    )) {
      const row = (value ?? {}) as Record<string, unknown>;
      outlets[outletId] = {
        override: Boolean(row.override),
        keyId: typeof row.keyId === "string" ? row.keyId : undefined,
        secretEnc: typeof row.secretEnc === "string" ? row.secretEnc : undefined,
        webhookSecretEnc:
          typeof row.webhookSecretEnc === "string"
            ? row.webhookSecretEnc
            : undefined,
        mode:
          row.mode === "sandbox" || row.mode === "production"
            ? row.mode
            : undefined,
        preferProvider: Boolean(row.preferProvider),
      };
    }
  }
  return {
    isDefault: Boolean(cfg.isDefault),
    mode:
      cfg.mode === "sandbox" || cfg.mode === "production" ? cfg.mode : undefined,
    keyId: typeof cfg.keyId === "string" ? cfg.keyId : "",
    secretEnc: typeof cfg.secretEnc === "string" ? cfg.secretEnc : "",
    webhookSecretEnc:
      typeof cfg.webhookSecretEnc === "string"
        ? cfg.webhookSecretEnc
        : undefined,
    outlets,
  };
}

export function maskKeyId(keyId: string | undefined | null): string | null {
  if (!keyId?.trim()) return null;
  const v = keyId.trim();
  if (v.length <= 8) return "••••";
  return `${v.slice(0, 4)}••••${v.slice(-4)}`;
}

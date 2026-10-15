import { BadRequestException, ServiceUnavailableException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { createHash } from "crypto";
import {
  URBANPIPER_PLATFORMS,
  type UrbanPiperIntegrationConfig,
  type UrbanPiperMode,
  type UrbanPiperOutletConfig,
  type UrbanPiperPlatform,
  type UrbanPiperUnmappedItem,
} from "@cullinos/integrations";
import {
  decryptSecret,
  encryptSecret,
  encryptionKeyConfigured,
} from "../platform-config/crypto.util";

export const URBANPIPER_PROVIDER = "urbanpiper";
export const DEFAULT_ACCEPT_TIMEOUT_MINUTES = 5;
export const MAX_ACCEPT_TIMEOUT_MINUTES = 30;
export const DEFAULT_PREP_TIME_MINUTES = 20;
export const MIN_PREP_TIME_MINUTES = 5;
export const MAX_PREP_TIME_MINUTES = 120;
export const MAX_UNMAPPED_ITEMS = 100;

function rec(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function intInRange(v: unknown, min: number, max: number, fallback: number): number {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
}

function parsePlatforms(v: unknown): Record<UrbanPiperPlatform, boolean> {
  const raw = rec(v);
  return {
    swiggy: raw.swiggy === undefined ? true : Boolean(raw.swiggy),
    zomato: raw.zomato === undefined ? true : Boolean(raw.zomato),
  };
}

function parseOutlet(v: unknown): UrbanPiperOutletConfig {
  const row = rec(v);
  const skuMap = rec(row.itemSkuMap);
  return {
    connected: Boolean(row.connected),
    storeRefId: typeof row.storeRefId === "string" && row.storeRefId.trim() ? row.storeRefId.trim() : undefined,
    platforms: parsePlatforms(row.platforms),
    disabledItemIds: Array.isArray(row.disabledItemIds)
      ? row.disabledItemIds.filter((x): x is string => typeof x === "string")
      : [],
    storeOnline: row.storeOnline === undefined ? true : Boolean(row.storeOnline),
    lastMenuPushAt: typeof row.lastMenuPushAt === "string" ? row.lastMenuPushAt : undefined,
    lastMenuPushError: typeof row.lastMenuPushError === "string" ? row.lastMenuPushError : null,
    itemSkuMap: Object.fromEntries(
      Object.entries(skuMap).filter((e): e is [string, string] => typeof e[1] === "string"),
    ),
  };
}

function readSecret(cfg: Record<string, unknown>, encKey: string, plainKey: string): string | null {
  const enc = cfg[encKey];
  if (typeof enc === "string" && enc) {
    try {
      return decryptSecret(enc);
    } catch {
      return null;
    }
  }
  const plain = cfg[plainKey];
  return typeof plain === "string" && plain ? plain : null;
}

export type ParsedUrbanPiperConfig = Omit<UrbanPiperIntegrationConfig, "apiKeyEnc" | "webhookSecretEnc"> & {
  apiKey: string | null;
  webhookSecret: string | null;
};

export function parseUrbanPiperConfig(raw: unknown): ParsedUrbanPiperConfig {
  const cfg = rec(raw);
  const outlets: Record<string, UrbanPiperOutletConfig> = {};
  for (const [outletId, value] of Object.entries(rec(cfg.outlets))) {
    outlets[outletId] = parseOutlet(value);
  }
  const unmapped = Array.isArray(cfg.unmappedItems)
    ? (cfg.unmappedItems as unknown[])
        .map((u) => rec(u))
        .filter((u) => typeof u.externalItemId === "string" && typeof u.outletId === "string")
        .map(
          (u): UrbanPiperUnmappedItem => ({
            externalItemId: String(u.externalItemId),
            name: typeof u.name === "string" ? u.name : "Item",
            platform: typeof u.platform === "string" ? u.platform : undefined,
            outletId: String(u.outletId),
            lastSeenAt: typeof u.lastSeenAt === "string" ? u.lastSeenAt : new Date(0).toISOString(),
            count: Number.isFinite(Number(u.count)) ? Number(u.count) : 1,
          }),
        )
    : [];
  return {
    username: typeof cfg.username === "string" ? cfg.username : "",
    apiKey: readSecret(cfg, "apiKeyEnc", "apiKey"),
    webhookSecret: readSecret(cfg, "webhookSecretEnc", "webhookSecret"),
    mode: cfg.mode === "production" ? "production" : "sandbox",
    acceptTimeoutMinutes: intInRange(
      cfg.acceptTimeoutMinutes,
      0,
      MAX_ACCEPT_TIMEOUT_MINUTES,
      DEFAULT_ACCEPT_TIMEOUT_MINUTES,
    ),
    autoRejectOnTimeout: Boolean(cfg.autoRejectOnTimeout),
    defaultPrepTimeMinutes: intInRange(
      cfg.defaultPrepTimeMinutes,
      MIN_PREP_TIME_MINUTES,
      MAX_PREP_TIME_MINUTES,
      DEFAULT_PREP_TIME_MINUTES,
    ),
    autoPushMenu: cfg.autoPushMenu === undefined ? true : Boolean(cfg.autoPushMenu),
    outlets,
    unmappedItems: unmapped,
  };
}

/** Persisted shape: API key and webhook secret encrypted whenever ENCRYPTION_KEY is set. */
export function serializeUrbanPiperConfig(config: ParsedUrbanPiperConfig): Prisma.InputJsonValue {
  const { apiKey, webhookSecret, ...rest } = config;
  if (encryptionKeyConfigured()) {
    return {
      ...rest,
      ...(apiKey ? { apiKeyEnc: encryptSecret(apiKey) } : {}),
      ...(webhookSecret ? { webhookSecretEnc: encryptSecret(webhookSecret) } : {}),
    } as unknown as Prisma.InputJsonValue;
  }
  if (process.env.NODE_ENV === "production") {
    throw new ServiceUnavailableException("ENCRYPTION_KEY is required to store UrbanPiper credentials");
  }
  return {
    ...rest,
    ...(apiKey ? { apiKey } : {}),
    ...(webhookSecret ? { webhookSecret } : {}),
  } as unknown as Prisma.InputJsonValue;
}

export function fingerprint(secret: string | null | undefined): string | null {
  if (!secret) return null;
  return `••••${createHash("sha256").update(secret).digest("hex").slice(0, 8)}`;
}

export function urbanPiperWebhookPaths(orgId: string) {
  const base = `/aggregators/webhooks/urbanpiper/${orgId}`;
  return { orders: `${base}/orders`, status: `${base}/status`, rider: `${base}/rider` };
}

/** Safe view for admin UI: never includes the API key or webhook secret. */
export function redactUrbanPiperConfig(
  orgId: string,
  isActive: boolean,
  config: ParsedUrbanPiperConfig,
  reveal: { webhookSecret?: string } = {},
) {
  return {
    provider: URBANPIPER_PROVIDER,
    isActive,
    username: config.username,
    mode: config.mode,
    apiKeyConfigured: Boolean(config.apiKey),
    apiKeyFingerprint: fingerprint(config.apiKey),
    webhookSecretFingerprint: fingerprint(config.webhookSecret),
    webhookSecret: reveal.webhookSecret ?? null,
    webhookPaths: urbanPiperWebhookPaths(orgId),
    acceptTimeoutMinutes: config.acceptTimeoutMinutes,
    autoRejectOnTimeout: config.autoRejectOnTimeout,
    defaultPrepTimeMinutes: config.defaultPrepTimeMinutes,
    autoPushMenu: config.autoPushMenu,
    outlets: config.outlets,
    unmappedItems: config.unmappedItems ?? [],
  };
}

export function parseMode(v: unknown): UrbanPiperMode {
  if (v !== "sandbox" && v !== "production") {
    throw new BadRequestException("mode must be sandbox or production");
  }
  return v;
}

export function parsePrepTime(v: unknown, fallback: number): number {
  if (v === undefined || v === null || v === "") return fallback;
  const n = Number(v);
  if (!Number.isInteger(n) || n < MIN_PREP_TIME_MINUTES || n > MAX_PREP_TIME_MINUTES) {
    throw new BadRequestException(
      `prepTimeMinutes must be a whole number between ${MIN_PREP_TIME_MINUTES} and ${MAX_PREP_TIME_MINUTES}`,
    );
  }
  return n;
}

export function enabledPlatforms(outlet: UrbanPiperOutletConfig): UrbanPiperPlatform[] {
  return URBANPIPER_PLATFORMS.filter((p) => outlet.platforms[p]);
}

/** Record (or bump) an aggregator item we could not map to a menu item. */
export function recordUnmappedItems(
  existing: UrbanPiperUnmappedItem[],
  seen: Array<{ externalItemId: string; name: string; platform?: string; outletId: string }>,
  now = new Date(),
): UrbanPiperUnmappedItem[] {
  const next = [...existing];
  for (const item of seen) {
    const found = next.find(
      (u) => u.externalItemId === item.externalItemId && u.outletId === item.outletId,
    );
    if (found) {
      found.count += 1;
      found.lastSeenAt = now.toISOString();
      found.name = item.name;
    } else {
      next.push({ ...item, lastSeenAt: now.toISOString(), count: 1 });
    }
  }
  return next
    .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt))
    .slice(0, MAX_UNMAPPED_ITEMS);
}

/** Per-order aggregator state kept in Order.metadata.aggregator. */
export type UrbanPiperOrderMeta = {
  provider: string;
  via: "urbanpiper";
  externalOrderId: string;
  channelOrderId?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  orderType?: string;
  placedAt?: string;
  acceptBy?: string | null;
  prepTimeMinutes?: number;
  acceptedAt?: string;
  rejectReason?: string;
  /** Set when UrbanPiper itself drove the change, so we do not echo it back. */
  platformCancelled?: boolean;
  timeoutAlertedAt?: string;
  rider?: { state: string; name?: string; phone?: string; updatedAt: string };
  lastPushedStatus?: string;
  statusSync?: { status: string; ok: boolean; error?: string; at: string };
  unmappedItems?: string[];
  aggregatorTotal?: number;
};

export function readUrbanPiperMeta(metadata: unknown): UrbanPiperOrderMeta | null {
  const agg = rec(rec(metadata).aggregator);
  if (agg.via !== "urbanpiper" || typeof agg.externalOrderId !== "string") return null;
  return agg as unknown as UrbanPiperOrderMeta;
}

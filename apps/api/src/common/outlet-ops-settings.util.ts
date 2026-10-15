import { BadRequestException } from "@nestjs/common";

export const KDS_SERVED_COMPLETES_ORDER = ["always", "paid_only", "off"] as const;
export type KdsServedCompletesOrder = (typeof KDS_SERVED_COMPLETES_ORDER)[number];

export type PosQuickKey = { slot: number; menuItemId: string };

export const DEFAULT_QR_SESSION_TIMEOUT_MINUTES = 60;
export const MAX_QR_SESSION_TIMEOUT_MINUTES = 24 * 60;
export const POS_QUICK_KEY_SLOTS = 12;

export type OutletOpsSettings = {
  /** Idle minutes before a QR table session expires; 0 disables expiry. */
  qrSessionTimeoutMinutes: number;
  kdsServedCompletesOrder: KdsServedCompletesOrder;
  posQuickKeys: PosQuickKey[];
  /** Outlet table-system override; null follows the business-type default. */
  tablesEnabled: boolean | null;
};

function record(settings: unknown): Record<string, unknown> {
  return settings && typeof settings === "object" && !Array.isArray(settings)
    ? (settings as Record<string, unknown>)
    : {};
}

/** Lenient read of stored outlet settings JSON; falls back to defaults on bad data. */
export function outletOpsSettings(settings: unknown): OutletOpsSettings {
  const s = record(settings);
  const timeout = Number(s.qrSessionTimeoutMinutes);
  const kds = s.kdsServedCompletesOrder;
  let quickKeys: PosQuickKey[] = [];
  try {
    quickKeys = parsePosQuickKeys(s.posQuickKeys ?? []);
  } catch {
    quickKeys = [];
  }
  return {
    qrSessionTimeoutMinutes:
      s.qrSessionTimeoutMinutes != null &&
      Number.isInteger(timeout) &&
      timeout >= 0 &&
      timeout <= MAX_QR_SESSION_TIMEOUT_MINUTES
        ? timeout
        : DEFAULT_QR_SESSION_TIMEOUT_MINUTES,
    kdsServedCompletesOrder: KDS_SERVED_COMPLETES_ORDER.includes(kds as KdsServedCompletesOrder)
      ? (kds as KdsServedCompletesOrder)
      : "always",
    posQuickKeys: quickKeys,
    tablesEnabled: typeof s.tablesEnabled === "boolean" ? s.tablesEnabled : null,
  };
}

export function parseTablesEnabled(value: unknown): boolean | null {
  if (value === null || typeof value === "boolean") return value;
  throw new BadRequestException("tablesEnabled must be true, false or null");
}

export function parseQrSessionTimeoutMinutes(value: unknown): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > MAX_QR_SESSION_TIMEOUT_MINUTES) {
    throw new BadRequestException(
      `qrSessionTimeoutMinutes must be a whole number between 0 and ${MAX_QR_SESSION_TIMEOUT_MINUTES}`,
    );
  }
  return n;
}

export function parseKdsServedCompletesOrder(value: unknown): KdsServedCompletesOrder {
  if (!KDS_SERVED_COMPLETES_ORDER.includes(value as KdsServedCompletesOrder)) {
    throw new BadRequestException(
      `kdsServedCompletesOrder must be one of: ${KDS_SERVED_COMPLETES_ORDER.join(", ")}`,
    );
  }
  return value as KdsServedCompletesOrder;
}

export function parsePosQuickKeys(value: unknown): PosQuickKey[] {
  if (!Array.isArray(value)) throw new BadRequestException("posQuickKeys must be an array");
  const seen = new Set<number>();
  const keys: PosQuickKey[] = [];
  for (const raw of value) {
    const entry = record(raw);
    const slot = Number(entry.slot);
    const menuItemId = typeof entry.menuItemId === "string" ? entry.menuItemId.trim() : "";
    if (!Number.isInteger(slot) || slot < 1 || slot > POS_QUICK_KEY_SLOTS) {
      throw new BadRequestException(`Quick key slot must be between 1 and ${POS_QUICK_KEY_SLOTS}`);
    }
    if (!menuItemId) throw new BadRequestException("Quick key menuItemId is required");
    if (seen.has(slot)) throw new BadRequestException(`Quick key slot ${slot} is used twice`);
    seen.add(slot);
    keys.push({ slot, menuItemId });
  }
  return keys.sort((a, b) => a.slot - b.slot);
}

export type ExpiryAction = "close" | "cancel_drafts" | "alert" | "none";

/**
 * What to do with an idle QR session: free it when empty, drop never-submitted guest
 * drafts, and only alert staff (once) when the kitchen or a staff member has an order.
 */
export function qrSessionExpiryAction(
  openOrders: Array<{ status: string; source: string }>,
  alreadyAlerted: boolean,
): ExpiryAction {
  if (openOrders.length === 0) return "close";
  if (openOrders.every((o) => o.status === "draft" && o.source === "customer")) {
    return "cancel_drafts";
  }
  return alreadyAlerted ? "none" : "alert";
}

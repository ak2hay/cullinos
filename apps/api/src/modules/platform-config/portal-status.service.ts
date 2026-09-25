import { Injectable } from "@nestjs/common";
import { SWITCHABLE_PORTALS, type SwitchablePortal } from "../../common/portal-context";
import { PlatformConfigService } from "./platform-config.service";

const PORTAL_KEYS: Record<SwitchablePortal, string> = {
  management: "PORTAL_MANAGEMENT_ENABLED",
  admin: "PORTAL_ADMIN_ENABLED",
  pos: "PORTAL_POS_ENABLED",
  kds: "PORTAL_KDS_ENABLED",
  app_ops: "PORTAL_APP_OPS_ENABLED",
  waiter: "PORTAL_WAITER_ENABLED",
  waiter_landing: "PORTAL_WAITER_LANDING_ENABLED",
};

const MAINTENANCE_KEYS: Record<SwitchablePortal, string> = {
  management: "PORTAL_MANAGEMENT_MAINTENANCE",
  admin: "PORTAL_ADMIN_MAINTENANCE",
  pos: "PORTAL_POS_MAINTENANCE",
  kds: "PORTAL_KDS_MAINTENANCE",
  app_ops: "PORTAL_APP_OPS_MAINTENANCE",
  waiter: "PORTAL_WAITER_MAINTENANCE",
  waiter_landing: "PORTAL_WAITER_LANDING_MAINTENANCE",
};

const MESSAGE_KEY = "PORTAL_DISABLED_MESSAGE";
const ALL_KEYS = [
  ...Object.values(PORTAL_KEYS),
  ...Object.values(MAINTENANCE_KEYS),
  MESSAGE_KEY,
];

/** Re-read from the database at least this often so every API replica converges. */
const CACHE_TTL_MS = 15_000;

export const DEFAULT_PORTAL_DISABLED_MESSAGE =
  "This portal has been temporarily turned off by Cullinos. Please use the admin portal or contact support.";

export type PortalEntryStatus = {
  enabled: boolean;
  /** Non-empty string means maintenance mode is on. */
  maintenanceMessage: string | null;
};

export type PortalStatus = {
  portals: Record<SwitchablePortal, PortalEntryStatus>;
  message: string;
};

@Injectable()
export class PortalStatusService {
  private cached: { value: PortalStatus; at: number } | null = null;

  constructor(private readonly config: PlatformConfigService) {
    config.onChange((keys) => {
      if (keys.some((k) => ALL_KEYS.includes(k))) this.cached = null;
    });
  }

  async getStatus(): Promise<PortalStatus> {
    if (this.cached && Date.now() - this.cached.at < CACHE_TTL_MS) {
      return this.cached.value;
    }
    this.config.invalidate(ALL_KEYS);
    const portals = {} as PortalStatus["portals"];
    for (const portal of SWITCHABLE_PORTALS) {
      const raw = await this.config.getAsync(PORTAL_KEYS[portal]);
      const maintenanceRaw = (await this.config.getAsync(MAINTENANCE_KEYS[portal]))?.trim() || "";
      portals[portal] = {
        enabled: raw?.trim().toLowerCase() !== "false",
        maintenanceMessage: maintenanceRaw.length > 0 ? maintenanceRaw : null,
      };
    }
    const message =
      (await this.config.getAsync(MESSAGE_KEY))?.trim() || DEFAULT_PORTAL_DISABLED_MESSAGE;
    const value = { portals, message };
    this.cached = { value, at: Date.now() };
    return value;
  }

  async isEnabled(portal: SwitchablePortal): Promise<boolean> {
    return (await this.getStatus()).portals[portal].enabled;
  }

  async maintenanceMessage(portal: SwitchablePortal): Promise<string | null> {
    return (await this.getStatus()).portals[portal].maintenanceMessage;
  }
}

import { Injectable } from "@nestjs/common";
import { SWITCHABLE_PORTALS, type SwitchablePortal } from "../../common/portal-context";
import { PlatformConfigService } from "./platform-config.service";

const PORTAL_KEYS: Record<SwitchablePortal, string> = {
  management: "PORTAL_MANAGEMENT_ENABLED",
  waiter: "PORTAL_WAITER_ENABLED",
};
const MESSAGE_KEY = "PORTAL_DISABLED_MESSAGE";
const ALL_KEYS = [...Object.values(PORTAL_KEYS), MESSAGE_KEY];

/** Re-read from the database at least this often so every API replica converges. */
const CACHE_TTL_MS = 15_000;

export const DEFAULT_PORTAL_DISABLED_MESSAGE =
  "This portal has been temporarily turned off by Cullinos. Please use the admin portal or contact support.";

export type PortalStatus = {
  portals: Record<SwitchablePortal, { enabled: boolean }>;
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
      portals[portal] = { enabled: raw?.trim().toLowerCase() !== "false" };
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
}

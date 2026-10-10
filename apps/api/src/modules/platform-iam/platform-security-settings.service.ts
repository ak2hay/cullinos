import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

const CACHE_TTL_MS = 30_000;

export const SECURITY_SETTING_KEYS = {
  stepUpCritical: "security.step_up_critical",
  globalIpAllowlist: "security.global_ip_allowlist",
  sessionMaxHours: "security.session_max_hours",
} as const;

export type PlatformSecuritySettings = {
  /** Writes that need a critical permission demand a fresh emailed code. */
  stepUpCritical: boolean;
  /** Applies to every staff member; empty = unrestricted. */
  globalIpAllowlist: string[];
};

/** Platform-wide staff security policy stored in platform_settings (non-secret). */
@Injectable()
export class PlatformSecuritySettingsService {
  private cached: { value: PlatformSecuritySettings; expiresAt: number } | null = null;

  constructor(private prisma: PrismaService) {}

  async get(): Promise<PlatformSecuritySettings> {
    if (this.cached && this.cached.expiresAt > Date.now()) return this.cached.value;
    const rows = await this.prisma.platformSetting.findMany({
      where: { key: { in: Object.values(SECURITY_SETTING_KEYS) } },
      select: { key: true, value: true },
    });
    const map = new Map(rows.map((r) => [r.key, r.value ?? ""]));
    const value: PlatformSecuritySettings = {
      stepUpCritical: map.get(SECURITY_SETTING_KEYS.stepUpCritical) === "true",
      globalIpAllowlist: (map.get(SECURITY_SETTING_KEYS.globalIpAllowlist) ?? "")
        .split(/[\s,]+/)
        .map((s) => s.trim())
        .filter(Boolean),
    };
    this.cached = { value, expiresAt: Date.now() + CACHE_TTL_MS };
    return value;
  }

  async update(patch: Partial<PlatformSecuritySettings>, updatedBy: string) {
    const writes: { key: string; value: string }[] = [];
    if (patch.stepUpCritical !== undefined) {
      writes.push({ key: SECURITY_SETTING_KEYS.stepUpCritical, value: String(patch.stepUpCritical) });
    }
    if (patch.globalIpAllowlist !== undefined) {
      writes.push({
        key: SECURITY_SETTING_KEYS.globalIpAllowlist,
        value: patch.globalIpAllowlist.map((s) => s.trim()).filter(Boolean).join(","),
      });
    }
    for (const w of writes) {
      await this.prisma.platformSetting.upsert({
        where: { key: w.key },
        create: { key: w.key, value: w.value, isSecret: false, updatedBy },
        update: { value: w.value, updatedBy },
      });
    }
    this.cached = null;
    return this.get();
  }
}

import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import {
  decryptSecret,
  encryptSecret,
  encryptionKeyConfigured,
  maskSecret,
} from "./crypto.util";
import {
  ALL_CONFIG_KEYS,
  CONFIG_GROUPS,
  type ConfigGroupId,
  isConfigGroupId,
} from "./platform-config.registry";

export type ConfigSource = "database" | "environment" | "default" | "missing";

export type FieldStatus = {
  key: string;
  label: string;
  isSecret: boolean;
  type?: "boolean";
  configured: boolean;
  source: ConfigSource;
  /** Non-secret effective value (never for secrets). */
  value?: string | null;
  /** Masked secret preview when configured. */
  masked?: string | null;
};

export type GroupStatus = {
  id: ConfigGroupId;
  label: string;
  description: string;
  fields: FieldStatus[];
};

type CacheEntry = { value: string | undefined; loaded: boolean };

@Injectable()
export class PlatformConfigService implements OnModuleInit {
  private readonly logger = new Logger(PlatformConfigService.name);
  private readonly cache = new Map<string, CacheEntry>();
  private readonly listeners = new Set<(keys: string[]) => void>();

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    try {
      await this.warmCache();
    } catch (err) {
      this.logger.warn(
        `Failed to warm platform settings cache: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  /** Subscribe to config changes (e.g. rebuild SMTP/R2 clients). */
  onChange(listener: (keys: string[]) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(keys: string[]) {
    for (const listener of this.listeners) {
      try {
        listener(keys);
      } catch (err) {
        this.logger.error(
          `Config change listener failed: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }
  }

  private async warmCache() {
    const rows = await this.prisma.platformSetting.findMany();
    for (const row of rows) {
      const def = ALL_CONFIG_KEYS.get(row.key);
      if (!def) continue;
      try {
        const value = def.isSecret
          ? row.valueEnc
            ? decryptSecret(row.valueEnc)
            : undefined
          : row.value ?? undefined;
        this.cache.set(row.key, { value, loaded: true });
      } catch {
        this.logger.error(`Failed to decrypt platform setting ${row.key}`);
        this.cache.set(row.key, { value: undefined, loaded: true });
      }
    }
  }

  /**
   * Effective value: DB override when a row exists with a non-null value,
   * otherwise environment.
   */
  get(key: string): string | undefined {
    const def = ALL_CONFIG_KEYS.get(key);
    const envVal = process.env[key]?.trim() || undefined;

    const cached = this.cache.get(key);
    if (cached?.loaded) {
      if (cached.value !== undefined && cached.value !== "") {
        return cached.value;
      }
      // Empty DB cache entry means "cleared" — still fall back to env.
      // Presence of a DB row with null/empty after clear deletes the row,
      // so if loaded with undefined and no row semantics: check hasDb separately.
    }

    // Synchronous path: if cache miss, fall back to env immediately.
    // Async hydrate happens via warmCache / upsert.
    if (!cached) {
      return envVal;
    }

    return cached.value !== undefined && cached.value !== ""
      ? cached.value
      : envVal;
  }

  /** Async get that ensures DB is consulted once for this key. */
  async getAsync(key: string): Promise<string | undefined> {
    await this.ensureKeyLoaded(key);
    return this.get(key);
  }

  private async ensureKeyLoaded(key: string) {
    if (this.cache.get(key)?.loaded) return;
    const def = ALL_CONFIG_KEYS.get(key);
    if (!def) {
      this.cache.set(key, { value: undefined, loaded: true });
      return;
    }
    const row = await this.prisma.platformSetting.findUnique({
      where: { key },
    });
    if (!row) {
      this.cache.set(key, { value: undefined, loaded: true });
      return;
    }
    try {
      const value = def.isSecret
        ? row.valueEnc
          ? decryptSecret(row.valueEnc)
          : undefined
        : row.value ?? undefined;
      this.cache.set(key, { value, loaded: true });
    } catch {
      this.logger.error(`Failed to decrypt platform setting ${key}`);
      this.cache.set(key, { value: undefined, loaded: true });
    }
  }

  invalidate(keys?: string[]) {
    if (!keys) {
      this.cache.clear();
      return;
    }
    for (const key of keys) {
      this.cache.delete(key);
    }
  }

  async getStatus(): Promise<{
    encryptionConfigured: boolean;
    groups: GroupStatus[];
  }> {
    const rows = await this.prisma.platformSetting.findMany();
    const rowKeys = new Set(rows.map((r) => r.key));
    // Refresh cache from DB
    this.cache.clear();
    for (const row of rows) {
      const def = ALL_CONFIG_KEYS.get(row.key);
      if (!def) continue;
      try {
        const value = def.isSecret
          ? row.valueEnc
            ? decryptSecret(row.valueEnc)
            : undefined
          : row.value ?? undefined;
        this.cache.set(row.key, { value, loaded: true });
      } catch {
        this.logger.error(`Failed to decrypt platform setting ${row.key}`);
        this.cache.set(row.key, { value: undefined, loaded: true });
      }
    }

    const groups: GroupStatus[] = [];

    for (const group of CONFIG_GROUPS) {
      const fields: FieldStatus[] = [];
      for (const keyDef of group.keys) {
        const dbCached = this.cache.get(keyDef.key);
        const dbValue =
          dbCached?.value !== undefined && dbCached.value !== ""
            ? dbCached.value
            : undefined;
        const envValue = process.env[keyDef.key]?.trim() || undefined;

        let source: ConfigSource = "missing";
        let effective: string | undefined;
        if (dbValue && rowKeys.has(keyDef.key)) {
          source = "database";
          effective = dbValue;
        } else if (envValue) {
          source = "environment";
          effective = envValue;
        } else if (keyDef.defaultValue !== undefined) {
          source = "default";
          effective = keyDef.defaultValue;
        }

        fields.push({
          key: keyDef.key,
          label: keyDef.label,
          isSecret: keyDef.isSecret,
          ...(keyDef.type ? { type: keyDef.type } : {}),
          configured: Boolean(effective),
          source: effective ? source : "missing",
          value: keyDef.isSecret ? null : (effective ?? null),
          masked:
            keyDef.isSecret && effective ? maskSecret(effective) : null,
        });
      }
      groups.push({
        id: group.id,
        label: group.label,
        description: group.description,
        fields,
      });
    }

    return {
      encryptionConfigured: encryptionKeyConfigured(),
      groups,
    };
  }

  async upsertGroup(
    groupId: string,
    partial: Record<string, string | null | undefined>,
    updatedBy?: string,
  ): Promise<GroupStatus> {
    if (!isConfigGroupId(groupId)) {
      throw new BadRequestException(`Unknown settings group: ${groupId}`);
    }
    const group = CONFIG_GROUPS.find((g) => g.id === groupId)!;
    const changedKeys: string[] = [];

    for (const keyDef of group.keys) {
      if (!(keyDef.key in partial)) continue;
      const raw = partial[keyDef.key];

      // null/undefined after presence check shouldn't happen; treat as skip
      if (raw === undefined || raw === null) continue;

      // Empty string = clear DB override
      if (raw === "") {
        await this.prisma.platformSetting.deleteMany({
          where: { key: keyDef.key },
        });
        this.cache.set(keyDef.key, { value: undefined, loaded: true });
        changedKeys.push(keyDef.key);
        continue;
      }

      if (keyDef.type === "boolean" && raw !== "true" && raw !== "false") {
        throw new BadRequestException(`${keyDef.key} must be "true" or "false"`);
      }

      if (keyDef.isSecret && !encryptionKeyConfigured()) {
        throw new ServiceUnavailableException(
          "ENCRYPTION_KEY is required to store platform secrets",
        );
      }

      const data = keyDef.isSecret
        ? {
            key: keyDef.key,
            isSecret: true,
            valueEnc: encryptSecret(raw),
            value: null,
            updatedBy: updatedBy ?? null,
          }
        : {
            key: keyDef.key,
            isSecret: false,
            value: raw,
            valueEnc: null,
            updatedBy: updatedBy ?? null,
          };

      await this.prisma.platformSetting.upsert({
        where: { key: keyDef.key },
        create: data,
        update: {
          isSecret: data.isSecret,
          value: data.value,
          valueEnc: data.valueEnc,
          updatedBy: data.updatedBy,
        },
      });

      this.cache.set(keyDef.key, { value: raw, loaded: true });
      changedKeys.push(keyDef.key);
    }

    if (changedKeys.length) {
      this.notify(changedKeys);
    }

    const status = await this.getStatus();
    return status.groups.find((g) => g.id === groupId)!;
  }
}

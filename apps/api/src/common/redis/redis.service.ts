import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import Redis from "ioredis";

/**
 * Shared Redis connection for state that must be consistent across API replicas
 * (rate limits, device pairing, login backoff, job leases). When REDIS_URL is unset
 * (local dev, tests) `client` is null and callers fall back to in-process state.
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  readonly client: Redis | null;

  constructor() {
    this.client = createRedisClient("cullinos-api", this.logger);
  }

  get enabled(): boolean {
    return this.client !== null;
  }

  async getJson<T>(key: string): Promise<T | null> {
    if (!this.client) return null;
    const raw = await this.client.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async setJson(key: string, value: unknown, ttlMs: number): Promise<void> {
    if (!this.client) return;
    await this.client.set(key, JSON.stringify(value), "PX", Math.max(1, Math.round(ttlMs)));
  }

  async del(key: string): Promise<void> {
    if (!this.client) return;
    await this.client.del(key);
  }

  /** Acquires a lease; returns false when another replica holds it. Always true without Redis. */
  async acquireLock(key: string, ttlMs: number): Promise<boolean> {
    if (!this.client) return true;
    const ok = await this.client.set(key, String(process.pid), "PX", ttlMs, "NX");
    return ok === "OK";
  }

  async onModuleDestroy() {
    await this.client?.quit().catch(() => undefined);
  }
}

export function createRedisClient(name: string, logger?: Logger): Redis | null {
  const url = process.env.REDIS_URL?.trim();
  if (!url) return null;
  const client = new Redis(url, {
    connectionName: name,
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false,
  });
  client.on("error", (err) => {
    logger?.warn(`Redis error: ${err.message}`);
  });
  return client;
}

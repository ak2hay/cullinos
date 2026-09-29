import { INestApplicationContext, Logger } from "@nestjs/common";
import { IoAdapter } from "@nestjs/platform-socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import type { ServerOptions } from "socket.io";
import { createRedisClient } from "../common/redis/redis.service";

/** Fans Socket.IO room broadcasts out across API replicas via Redis pub/sub. */
export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter> | null = null;
  private readonly logger = new Logger(RedisIoAdapter.name);

  constructor(app: INestApplicationContext) {
    super(app);
  }

  connectToRedis(): boolean {
    const pub = createRedisClient("cullinos-ws-pub", this.logger);
    const sub = createRedisClient("cullinos-ws-sub", this.logger);
    if (!pub || !sub) return false;
    this.adapterConstructor = createAdapter(pub, sub);
    return true;
  }

  createIOServer(port: number, options?: ServerOptions) {
    const server = super.createIOServer(port, options);
    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }
    return server;
  }
}

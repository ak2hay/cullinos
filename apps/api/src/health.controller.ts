import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { Public } from "./common/decorators";
import { PrismaService } from "./prisma/prisma.service";

@Controller("health")
@SkipThrottle()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  health() {
    return {
      status: "ok",
      service: "cullinos-api",
      version: "0.1.1",
      commit:
        process.env.GIT_COMMIT ??
        process.env.DEPLOY_COMMIT ??
        "unknown",
      timestamp: new Date().toISOString(),
      features: {
        superAdminOnboard: true,
      },
    };
  }

  @Public()
  @Get("db")
  async healthDb() {
    const start = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: "ok",
        database: "connected",
        latencyMs: Date.now() - start,
        timestamp: new Date().toISOString(),
      };
    } catch {
      throw new ServiceUnavailableException({
        error: {
          code: "DB_UNAVAILABLE",
          message: "Database connection failed",
        },
      });
    }
  }
}

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { Public } from "./common/decorators";
import { PrismaService } from "./prisma/prisma.service";

function readApiVersion(): string {
  try {
    // Resolves to apps/api/package.json from both src/ (dev) and dist/ (build).
    const pkg = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf8")) as {
      version?: string;
    };
    return pkg.version ?? "unknown";
  } catch {
    return "unknown";
  }
}

const API_VERSION = readApiVersion();

function resolveCommit(): string {
  const raw = (process.env.GIT_COMMIT || process.env.DEPLOY_COMMIT || "").trim();
  return raw && raw !== "unknown" ? raw : "unknown";
}

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
      version: API_VERSION,
      commit: resolveCommit(),
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

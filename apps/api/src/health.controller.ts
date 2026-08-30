import { Controller, Get } from "@nestjs/common";

@Controller("health")
export class HealthController {
  @Get()
  health() {
    return {
      status: "ok",
      service: "cullinos-api",
      version: "0.1.1",
      commit:
        process.env.RENDER_GIT_COMMIT ??
        process.env.RAILWAY_GIT_COMMIT_SHA ??
        process.env.VERCEL_GIT_COMMIT_SHA ??
        "unknown",
      timestamp: new Date().toISOString(),
      features: {
        superAdminOnboard: true,
      },
    };
  }
}

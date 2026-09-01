import { Controller, Get } from "@nestjs/common";
import { Public } from "./common/decorators";

@Controller("health")
export class HealthController {
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
}

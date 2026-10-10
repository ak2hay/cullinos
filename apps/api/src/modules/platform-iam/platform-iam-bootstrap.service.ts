import { Injectable, Logger, type OnApplicationBootstrap } from "@nestjs/common";
import { PlatformIamService } from "./platform-iam.service";

/** Syncs built-in role rows and backfills employee records on startup. */
@Injectable()
export class PlatformIamBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PlatformIamBootstrapService.name);

  constructor(private iam: PlatformIamService) {}

  async onApplicationBootstrap() {
    if (process.env.NODE_ENV === "test") return;
    try {
      await this.iam.syncSystemRoles();
      await this.iam.ensureEmployees();
    } catch (err) {
      this.logger.warn(`Platform IAM bootstrap skipped: ${(err as Error).message}`);
    }
  }
}

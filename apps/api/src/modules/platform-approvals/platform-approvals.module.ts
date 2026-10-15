import { Global, Injectable, Logger, Module, type OnApplicationBootstrap } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { PlatformIamService } from "../platform-iam/platform-iam.service";
import { PlatformApprovalInterceptor } from "./platform-approval.interceptor";
import { MailModule } from "../mail/mail.module";
import { ApprovalEmailActionController, PlatformApprovalsController } from "./platform-approvals.controller";
import { PlatformApprovalsService } from "./platform-approvals.service";

@Injectable()
class PlatformApprovalsBootstrap implements OnApplicationBootstrap {
  private readonly logger = new Logger("PlatformApprovalsBootstrap");

  constructor(
    private approvals: PlatformApprovalsService,
    private iam: PlatformIamService,
  ) {}

  async onApplicationBootstrap() {
    this.approvals.registerFacts("iam.assign", async ({ body }) => {
      const roleId = (body as { roleId?: string } | null)?.roleId;
      return roleId ? this.iam.assignmentFacts(roleId) : {};
    });
    if (process.env.NODE_ENV === "test") return;
    try {
      await this.approvals.seedDefaults();
    } catch (err) {
      this.logger.warn(`Approval policy seed skipped: ${(err as Error).message}`);
    }
  }
}

/** Maker-checker approvals for sensitive platform actions. */
@Global()
@Module({
  imports: [MailModule],
  controllers: [PlatformApprovalsController, ApprovalEmailActionController],
  providers: [
    PlatformApprovalsService,
    PlatformApprovalsBootstrap,
    { provide: APP_INTERCEPTOR, useClass: PlatformApprovalInterceptor },
  ],
  exports: [PlatformApprovalsService],
})
export class PlatformApprovalsModule {}

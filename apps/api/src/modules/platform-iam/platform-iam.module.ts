import { Global, Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { AuthModule } from "../auth/auth.module";
import { MailModule } from "../mail/mail.module";
import { PlatformAccessService } from "./platform-access.service";
import { PlatformActivityInterceptor } from "./platform-activity.interceptor";
import { PlatformActivityService } from "./platform-activity.service";
import { PlatformAuthorizationService } from "./platform-authorization.service";
import { PlatformIamBootstrapService } from "./platform-iam-bootstrap.service";
import { PlatformIamController } from "./platform-iam.controller";
import { PlatformIamService } from "./platform-iam.service";
import { PlatformNotificationsService } from "./platform-notifications.service";
import { PlatformSecuritySettingsService } from "./platform-security-settings.service";

/**
 * Platform staff identity and access: permission resolution used by every super-admin
 * guard, the append-only activity log, notifications and the IAM admin API.
 */
@Global()
@Module({
  imports: [MailModule, AuthModule],
  controllers: [PlatformIamController],
  providers: [
    PlatformAccessService,
    PlatformAuthorizationService,
    PlatformSecuritySettingsService,
    PlatformActivityService,
    PlatformNotificationsService,
    PlatformIamService,
    PlatformIamBootstrapService,
    { provide: APP_INTERCEPTOR, useClass: PlatformActivityInterceptor },
  ],
  exports: [
    PlatformAccessService,
    PlatformAuthorizationService,
    PlatformSecuritySettingsService,
    PlatformActivityService,
    PlatformNotificationsService,
    PlatformIamService,
  ],
})
export class PlatformIamModule {}

import { Module, type DynamicModule } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { APP_GUARD } from "@nestjs/core";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { SessionTokensService } from "./session-tokens.service";
import { JwtAuthGuard } from "../../common/jwt-auth.guard";
import { AccountStatusGuard } from "../../common/account-status.guard";
import { SuperAdminGuard } from "../../common/super-admin.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { EntitlementGuard } from "../../common/entitlement.guard";
import { PortalGuard } from "../../common/guards/portal.guard";
import { MailModule } from "../mail/mail.module";
import { AuditModule } from "../audit/audit.module";
import { SmsModule } from "../sms/sms.module";
import { OrganizationsModule } from "../organizations/organizations.module";
import { MarketingModule } from "../marketing/marketing.module";
import { ProfileController } from "./profile.controller";
import { ProfileService } from "./profile.service";
import { getJwtSecret } from "../../common/jwt-secret.util";

const jwtModule = JwtModule.register({
  global: true,
  secret: getJwtSecret(),
  signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN || "7d") as "7d" },
}) as DynamicModule;

@Module({
  imports: [jwtModule, MailModule, AuditModule, SmsModule, OrganizationsModule, MarketingModule],
  controllers: [AuthController, ProfileController],
  providers: [
    AuthService,
    ProfileService,
    SessionTokensService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: AccountStatusGuard },
    { provide: APP_GUARD, useClass: PortalGuard },
    { provide: APP_GUARD, useClass: SuperAdminGuard },
    { provide: APP_GUARD, useClass: EntitlementGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
  exports: [AuthService, SessionTokensService],
})
export class AuthModule {}

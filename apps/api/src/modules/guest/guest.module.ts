import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { LoyaltyModule } from "../loyalty/loyalty.module";
import { PaymentsModule } from "../payments/payments.module";
import { CouponsModule } from "../coupons/coupons.module";
import { SmsModule } from "../sms/sms.module";
import { PlatformConfigModule } from "../platform-config/platform-config.module";
import { AuditModule } from "../audit/audit.module";
import { MarketingModule } from "../marketing/marketing.module";
import { GuestService } from "./guest.service";
import { GuestController } from "./guest.controller";
import { GuestOrdersController } from "./guest-orders.controller";
import { GuestAuthGuard } from "./guest-auth.util";
import { GuestPushService } from "./guest-push.service";
import { GuestEngagementService } from "./guest-engagement.service";
import { MarketplaceService } from "./marketplace.service";
import { MarketplaceController } from "./marketplace.controller";
import { GuestMarketingService } from "./guest-marketing.service";
import { GuestMarketingAdminController } from "./guest-marketing-admin.controller";
import { GuestMarketingSuperAdminController } from "./guest-marketing-super-admin.controller";
import { FirebaseAdminService } from "./firebase-admin.service";
import { GuestOpsService } from "./guest-ops.service";
import { GuestAppPrivacyService } from "./guest-app-privacy.service";
import { GuestOpsController } from "./guest-ops.controller";

@Module({
  imports: [
    JwtModule.register({}),
    LoyaltyModule,
    PaymentsModule,
    CouponsModule,
    SmsModule,
    PlatformConfigModule,
    AuditModule,
    MarketingModule,
  ],
  controllers: [
    GuestController,
    GuestOrdersController,
    MarketplaceController,
    GuestMarketingAdminController,
    GuestMarketingSuperAdminController,
    GuestOpsController,
  ],
  providers: [
    GuestService,
    GuestAuthGuard,
    GuestPushService,
    GuestEngagementService,
    MarketplaceService,
    GuestMarketingService,
    FirebaseAdminService,
    GuestOpsService,
    GuestAppPrivacyService,
  ],
  exports: [
    GuestService,
    GuestPushService,
    MarketplaceService,
    GuestEngagementService,
    GuestMarketingService,
    GuestOpsService,
  ],
})
export class GuestModule {}

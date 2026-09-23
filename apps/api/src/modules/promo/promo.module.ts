import { Module, forwardRef } from "@nestjs/common";
import { MailModule } from "../mail/mail.module";
import { PrivacyModule } from "../privacy/privacy.module";
import { SmsModule } from "../sms/sms.module";
import { WalletModule } from "../wallet/wallet.module";
import { PromoController } from "./promo.controller";
import { PromoService } from "./promo.service";
import { SuperAdminPromoController } from "./super-admin-promo.controller";

@Module({
  imports: [MailModule, SmsModule, WalletModule, forwardRef(() => PrivacyModule)],
  controllers: [PromoController, SuperAdminPromoController],
  providers: [PromoService],
  exports: [PromoService],
})
export class PromoModule {}

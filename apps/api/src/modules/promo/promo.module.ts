import { Module } from "@nestjs/common";
import { MailModule } from "../mail/mail.module";
import { PromoController } from "./promo.controller";
import { PromoService } from "./promo.service";
import { SuperAdminPromoController } from "./super-admin-promo.controller";

@Module({
  imports: [MailModule],
  controllers: [PromoController, SuperAdminPromoController],
  providers: [PromoService],
  exports: [PromoService],
})
export class PromoModule {}

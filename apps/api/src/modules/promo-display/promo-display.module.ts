import { Module } from "@nestjs/common";
import { MarketingModule } from "../marketing/marketing.module";
import { StorefrontModule } from "../storefront/storefront.module";
import {
  PromoDisplayController,
  PublicPromoDisplayController,
} from "./promo-display.controller";
import { PromoDisplayService } from "./promo-display.service";

@Module({
  imports: [StorefrontModule, MarketingModule],
  controllers: [PromoDisplayController, PublicPromoDisplayController],
  providers: [PromoDisplayService],
  exports: [PromoDisplayService],
})
export class PromoDisplayModule {}

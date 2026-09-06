import { Module } from "@nestjs/common";
import { LoyaltyController, PublicLoyaltyController } from "./loyalty.controller";
import { LoyaltyService } from "./loyalty.service";

@Module({
  controllers: [LoyaltyController, PublicLoyaltyController],
  providers: [LoyaltyService],
  exports: [LoyaltyService],
})
export class LoyaltyModule {}

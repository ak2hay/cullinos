import { Module } from "@nestjs/common";
import { RazorpayModule } from "../payments/razorpay.module";
import { SaasBillingService } from "./saas-billing.service";
import { SubscriptionsController } from "./subscriptions.controller";
import { SubscriptionsService } from "./subscriptions.service";

@Module({
  imports: [RazorpayModule],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService, SaasBillingService],
  exports: [SubscriptionsService, SaasBillingService],
})
export class SubscriptionsModule {}

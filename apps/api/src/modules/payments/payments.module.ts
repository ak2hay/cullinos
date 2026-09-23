import { Module } from "@nestjs/common";
import { SubscriptionsModule } from "../subscriptions/subscriptions.module";
import { CashfreeClient } from "./cashfree.client";
import { PaymentCredentialsService } from "./payment-credentials.service";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";
import { RazorpayModule } from "./razorpay.module";

@Module({
  imports: [RazorpayModule, SubscriptionsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymentCredentialsService, CashfreeClient],
  exports: [PaymentsService, PaymentCredentialsService, RazorpayModule],
})
export class PaymentsModule {}

import { Module, forwardRef } from "@nestjs/common";
import { OrdersController, PublicOrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";
import { OrderStatusNotifier } from "./order-status.notifier";
import { WebsocketModule } from "../../websocket/websocket.module";
import { LoyaltyModule } from "../loyalty/loyalty.module";
import { StorefrontModule } from "../storefront/storefront.module";
import { GuestModule } from "../guest/guest.module";
import { RecipesModule } from "../recipes/recipes.module";
import { MailModule } from "../mail/mail.module";
import { SmsModule } from "../sms/sms.module";
import { FeedbackModule } from "../feedback/feedback.module";
import { WalletModule } from "../wallet/wallet.module";
import { PaymentsModule } from "../payments/payments.module";
import { RefundPinModule } from "../refund-pin/refund-pin.module";

@Module({
  imports: [
    WebsocketModule,
    StorefrontModule,
    forwardRef(() => LoyaltyModule),
    forwardRef(() => GuestModule),
    RecipesModule,
    MailModule,
    SmsModule,
    FeedbackModule,
    WalletModule,
    PaymentsModule,
    RefundPinModule,
  ],
  controllers: [OrdersController, PublicOrdersController],
  providers: [OrdersService, OrderStatusNotifier],
  exports: [OrdersService, OrderStatusNotifier],
})
export class OrdersModule {}

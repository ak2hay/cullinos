import { Module } from "@nestjs/common";
import { OrdersModule } from "../orders/orders.module";
import { AggregatorsController } from "./aggregators.controller";
import { AggregatorsWebhookController } from "./aggregators-webhook.controller";
import { AggregatorsService } from "./aggregators.service";

@Module({
  imports: [OrdersModule],
  controllers: [AggregatorsController, AggregatorsWebhookController],
  providers: [AggregatorsService],
  exports: [AggregatorsService],
})
export class AggregatorsModule {}

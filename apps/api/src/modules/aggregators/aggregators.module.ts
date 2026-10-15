import { Module } from "@nestjs/common";
import { MenuModule } from "../menu/menu.module";
import { OrdersModule } from "../orders/orders.module";
import { WebsocketModule } from "../../websocket/websocket.module";
import { AggregatorsController } from "./aggregators.controller";
import { AggregatorsWebhookController } from "./aggregators-webhook.controller";
import { AggregatorsService } from "./aggregators.service";
import { UrbanPiperController } from "./urbanpiper.controller";
import { UrbanPiperWebhookController } from "./urbanpiper-webhook.controller";
import { UrbanPiperService } from "./urbanpiper.service";

@Module({
  imports: [OrdersModule, MenuModule, WebsocketModule],
  controllers: [
    AggregatorsController,
    UrbanPiperWebhookController,
    AggregatorsWebhookController,
    UrbanPiperController,
  ],
  providers: [AggregatorsService, UrbanPiperService],
  exports: [AggregatorsService, UrbanPiperService],
})
export class AggregatorsModule {}

import { Module, forwardRef } from "@nestjs/common";
import { OrdersController, PublicOrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";
import { WebsocketModule } from "../../websocket/websocket.module";
import { LoyaltyModule } from "../loyalty/loyalty.module";

@Module({
  imports: [WebsocketModule, forwardRef(() => LoyaltyModule)],
  controllers: [OrdersController, PublicOrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}

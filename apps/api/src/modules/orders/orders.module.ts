import { Module } from "@nestjs/common";
import { OrdersController, PublicOrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";
import { WebsocketModule } from "../../websocket/websocket.module";

@Module({
  imports: [WebsocketModule],
  controllers: [OrdersController, PublicOrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}

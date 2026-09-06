import { Module } from "@nestjs/common";
import { WebsocketModule } from "../../websocket/websocket.module";
import { KitchenController } from "./kitchen.controller";
import { KitchenService } from "./kitchen.service";

@Module({
  imports: [WebsocketModule],
  controllers: [KitchenController],
  providers: [KitchenService],
  exports: [KitchenService],
})
export class KitchenModule {}

import { Module } from "@nestjs/common";
import { WebsocketModule } from "../../websocket/websocket.module";
import { KitchenController } from "./kitchen.controller";
import { KitchenService } from "./kitchen.service";
import { RecipesModule } from "../recipes/recipes.module";

@Module({
  imports: [WebsocketModule, RecipesModule],
  controllers: [KitchenController],
  providers: [KitchenService],
  exports: [KitchenService],
})
export class KitchenModule {}

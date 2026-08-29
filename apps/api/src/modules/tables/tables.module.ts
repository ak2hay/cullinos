import { Module } from "@nestjs/common";
import { WebsocketModule } from "../../websocket/websocket.module";
import { PublicTablesController, TablesController } from "./tables.controller";
import { TablesService } from "./tables.service";

@Module({
  imports: [WebsocketModule],
  controllers: [TablesController, PublicTablesController],
  providers: [TablesService],
  exports: [TablesService],
})
export class TablesModule {}

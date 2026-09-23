import { Module, forwardRef } from "@nestjs/common";
import { WebsocketModule } from "../../websocket/websocket.module";
import { OrdersModule } from "../orders/orders.module";
import {
  PublicSessionsController,
  PublicTablesController,
  TablesController,
} from "./tables.controller";
import { ServiceRequestsService } from "./service-requests.service";
import { TableSessionsService } from "./table-sessions.service";
import { TablesService } from "./tables.service";

@Module({
  imports: [WebsocketModule, forwardRef(() => OrdersModule)],
  controllers: [TablesController, PublicTablesController, PublicSessionsController],
  providers: [TablesService, TableSessionsService, ServiceRequestsService],
  exports: [TablesService, TableSessionsService, ServiceRequestsService],
})
export class TablesModule {}

import { Module } from "@nestjs/common";
import { PosController } from "./pos.controller";
import { OrdersModule } from "../orders/orders.module";

@Module({
  imports: [OrdersModule],
  controllers: [PosController],
})
export class PosModule {}

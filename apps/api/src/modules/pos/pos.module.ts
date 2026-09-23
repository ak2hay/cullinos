import { Module } from "@nestjs/common";
import { PosController } from "./pos.controller";
import { PosShiftsService } from "./pos-shifts.service";
import { OrdersModule } from "../orders/orders.module";

@Module({
  imports: [OrdersModule],
  controllers: [PosController],
  providers: [PosShiftsService],
  exports: [PosShiftsService],
})
export class PosModule {}

import { Module } from "@nestjs/common";
import { RefundPinController } from "./refund-pin.controller";
import { RefundPinService } from "./refund-pin.service";

@Module({
  controllers: [RefundPinController],
  providers: [RefundPinService],
  exports: [RefundPinService],
})
export class RefundPinModule {}

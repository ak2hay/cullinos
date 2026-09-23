import { Module, forwardRef } from "@nestjs/common";
import {
  DeliveryController,
  PublicDeliveryController,
} from "./delivery.controller";
import { DeliveryService } from "./delivery.service";
import { GuestModule } from "../guest/guest.module";

@Module({
  imports: [forwardRef(() => GuestModule)],
  controllers: [DeliveryController, PublicDeliveryController],
  providers: [DeliveryService],
  exports: [DeliveryService],
})
export class DeliveryModule {}

import { Module } from "@nestjs/common";
import { InventoryModule } from "../inventory/inventory.module";
import { CentralKitchenController } from "./central-kitchen.controller";
import { CentralKitchenService } from "./central-kitchen.service";

@Module({
  imports: [InventoryModule],
  controllers: [CentralKitchenController],
  providers: [CentralKitchenService],
  exports: [CentralKitchenService],
})
export class CentralKitchenModule {}

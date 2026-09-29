import { Module } from "@nestjs/common";
import { HappyHoursController } from "./happy-hours.controller";
import { HappyHoursService } from "./happy-hours.service";

@Module({
  controllers: [HappyHoursController],
  providers: [HappyHoursService],
})
export class HappyHoursModule {}

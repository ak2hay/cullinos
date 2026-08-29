import { Module } from "@nestjs/common";
import { BanquetsController } from "./banquets.controller";
import { BanquetsService } from "./banquets.service";

@Module({
  controllers: [BanquetsController],
  providers: [BanquetsService],
  exports: [BanquetsService],
})
export class BanquetsModule {}

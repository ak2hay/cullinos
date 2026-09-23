import { Module } from "@nestjs/common";
import { MarketingModule } from "../marketing/marketing.module";
import { MenuController, PublicMenuController } from "./menu.controller";
import { MenuService } from "./menu.service";

@Module({
  imports: [MarketingModule],
  controllers: [MenuController, PublicMenuController],
  providers: [MenuService],
  exports: [MenuService],
})
export class MenuModule {}

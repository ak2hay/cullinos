import { Module } from "@nestjs/common";
import { MarketingModule } from "../marketing/marketing.module";
import { MenuCatalogController } from "./menu-catalog.controller";
import { MenuCatalogService } from "./menu-catalog.service";
import { MenuController, PublicMenuController } from "./menu.controller";
import { MenuService } from "./menu.service";

@Module({
  imports: [MarketingModule],
  controllers: [MenuCatalogController, MenuController, PublicMenuController],
  providers: [MenuService, MenuCatalogService],
  exports: [MenuService],
})
export class MenuModule {}

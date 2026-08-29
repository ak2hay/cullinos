import { Module } from "@nestjs/common";
import { MenuController, PublicMenuController } from "./menu.controller";
import { MenuService } from "./menu.service";

@Module({
  controllers: [MenuController, PublicMenuController],
  providers: [MenuService],
  exports: [MenuService],
})
export class MenuModule {}

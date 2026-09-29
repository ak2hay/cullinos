import { Body, Controller, Get, Post } from "@nestjs/common";
import { OrgId, RequireModule } from "../../common/decorators";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { MenuCatalogService } from "./menu-catalog.service";

@Controller("menu/catalog")
export class MenuCatalogController {
  constructor(private service: MenuCatalogService) {}

  @Get()
  @RequireModule("menu")
  @RequirePermissions("menu:read")
  getCatalog(@OrgId() orgId: string) {
    return this.service.getCatalog(orgId);
  }

  @Post("import")
  @RequireModule("menu")
  @RequirePermissions("menu:create")
  importItems(@OrgId() orgId: string, @Body() body: Record<string, unknown>) {
    return this.service.importItems(orgId, body);
  }
}

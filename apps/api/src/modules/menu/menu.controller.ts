import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { OrgId, Public, RequireModule } from "../../common/decorators";
import { MenuService } from "./menu.service";

@Controller("menu")
export class MenuController {
  constructor(private service: MenuService) {}

  @Get()
  list(@OrgId() orgId: string) {
    return this.service.list(orgId);
  }

  @Get("categories")
  @RequireModule("menu")
  listCategories(@OrgId() orgId: string) {
    return this.service.listCategories(orgId);
  }

  @Post("categories")
  @RequireModule("menu")
  createCategory(@OrgId() orgId: string, @Body() body: Record<string, unknown>) {
    return this.service.createCategory(orgId, body as never);
  }

  @Patch("categories/:id")
  @RequireModule("menu")
  updateCategory(
    @OrgId() orgId: string,
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.service.updateCategory(orgId, id, body as never);
  }

  @Delete("categories/:id")
  @RequireModule("menu")
  deleteCategory(@OrgId() orgId: string, @Param("id") id: string) {
    return this.service.deleteCategory(orgId, id);
  }

  @Get("items")
  @RequireModule("menu")
  listItems(@OrgId() orgId: string) {
    return this.service.listItems(orgId);
  }

  @Post("items")
  @RequireModule("menu")
  createItem(@OrgId() orgId: string, @Body() body: Record<string, unknown>) {
    return this.service.createItem(orgId, body as never);
  }

  @Patch("items/:id")
  @RequireModule("menu")
  updateItem(
    @OrgId() orgId: string,
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.service.updateItem(orgId, id, body as never);
  }

  @Delete("items/:id")
  @RequireModule("menu")
  deleteItem(@OrgId() orgId: string, @Param("id") id: string) {
    return this.service.deleteItem(orgId, id);
  }

  @Get("schedules")
  @RequireModule("menu")
  listSchedules(@OrgId() orgId: string) {
    return this.service.listSchedules(orgId);
  }

  @Post("schedules")
  @RequireModule("menu")
  createSchedule(@OrgId() orgId: string, @Body() body: Record<string, unknown>) {
    return this.service.createSchedule(orgId, body as never);
  }

  @Patch("schedules/:id")
  @RequireModule("menu")
  updateSchedule(
    @OrgId() orgId: string,
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.service.updateSchedule(orgId, id, body as never);
  }

  @Delete("schedules/:id")
  @RequireModule("menu")
  deleteSchedule(@OrgId() orgId: string, @Param("id") id: string) {
    return this.service.deleteSchedule(orgId, id);
  }

  @Get("outlets/:outletId")
  @RequireModule("menu")
  getOutletMenu(@OrgId() orgId: string, @Param("outletId") outletId: string) {
    return this.service.getOutletMenu(orgId, outletId);
  }

  @Post("outlets/:outletId/items/:menuItemId/prices")
  @RequireModule("menu")
  setOutletPrice(
    @OrgId() orgId: string,
    @Param("outletId") outletId: string,
    @Param("menuItemId") menuItemId: string,
    @Body() body: { price: number; priceType?: "retail" | "wholesale" },
  ) {
    return this.service.setOutletPrice(
      orgId,
      outletId,
      menuItemId,
      body.price,
      body.priceType ?? "retail",
    );
  }
}

@Controller("public/menu")
export class PublicMenuController {
  constructor(private service: MenuService) {}

  @Public()
  @Get("outlets/:outletId")
  getOutletMenu(@Param("outletId") outletId: string) {
    return this.service.getOutletMenuPublic(outletId);
  }
}

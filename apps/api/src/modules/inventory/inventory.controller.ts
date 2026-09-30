import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { OrgId, RequireModule } from "../../common/decorators";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { InventoryService } from "./inventory.service";

@Controller("inventory")
export class InventoryController {
  constructor(private service: InventoryService) {}

  @Get()
  @RequirePermissions("inventory:read")
  list(@OrgId() orgId: string) {
    return this.service.list(orgId);
  }

  @Get("items")
  @RequireModule("inventory")
  @RequirePermissions("inventory:read")
  listItems(@OrgId() orgId: string, @Query("outletId") outletId?: string) {
    return this.service.listItems(orgId, outletId || undefined);
  }

  @Get("outlet-stock")
  @RequireModule("inventory")
  @RequirePermissions("inventory:read")
  outletStock(@OrgId() orgId: string) {
    return this.service.outletStock(orgId);
  }

  @Get("items/:id/lots")
  @RequireModule("inventory")
  @RequirePermissions("inventory:read")
  listLots(@OrgId() orgId: string, @Param("id") id: string) {
    return this.service.listLots(orgId, id);
  }

  @Get("stock-register")
  @RequireModule("inventory")
  @RequirePermissions("inventory:read")
  stockRegister(
    @OrgId() orgId: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("outletId") outletId?: string,
    @Query("liquidOnly") liquidOnly?: string,
  ) {
    return this.service.stockRegister(orgId, { from, to, outletId, liquidOnly });
  }

  @Get("low-stock")
  @RequireModule("inventory")
  @RequirePermissions("inventory:read")
  lowStock(@OrgId() orgId: string, @Query("outletId") outletId?: string) {
    return this.service.lowStock(orgId, outletId || undefined);
  }

  @Post("items")
  @RequireModule("inventory")
  @RequirePermissions("inventory:adjust")
  createItem(
    @OrgId() orgId: string,
    @Body()
    body: {
      outletId?: string;
      name: string;
      sku?: string;
      unit?: string;
      currentStock?: number;
      reorderLevel?: number;
      packLabel?: string | null;
      packSize?: number | null;
    },
  ) {
    return this.service.createItem(orgId, body);
  }

  @Patch("items/:id")
  @RequireModule("inventory")
  @RequirePermissions("inventory:adjust")
  updateItem(
    @OrgId() orgId: string,
    @Param("id") id: string,
    @Body()
    body: {
      name?: string;
      sku?: string;
      unit?: string;
      currentStock?: number;
      reorderLevel?: number;
      packLabel?: string | null;
      packSize?: number | null;
    },
  ) {
    return this.service.updateItem(orgId, id, body);
  }

  @Delete("items/:id")
  @RequireModule("inventory")
  @RequirePermissions("inventory:adjust")
  removeItem(@OrgId() orgId: string, @Param("id") id: string) {
    return this.service.removeItem(orgId, id);
  }

  @Post("items/:id/adjust")
  @RequireModule("inventory")
  @RequirePermissions("inventory:adjust")
  adjust(
    @OrgId() orgId: string,
    @Param("id") id: string,
    @Body()
    body: { quantity: number; type: "in" | "out" | "waste"; notes?: string; inPacks?: boolean },
  ) {
    return this.service.adjust(orgId, id, body);
  }

  @Post("transfers")
  @RequireModule("inventory")
  @RequirePermissions("inventory:transfer", "inventory:adjust")
  transfer(@OrgId() orgId: string, @Body() body: Record<string, unknown>) {
    return this.service.transfer(orgId, body as never);
  }
}

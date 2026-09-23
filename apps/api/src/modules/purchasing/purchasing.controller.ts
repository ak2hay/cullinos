import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { OrgId, RequireModule } from "../../common/decorators";
import { PurchasingService } from "./purchasing.service";

@Controller("purchasing")
export class PurchasingController {
  constructor(private service: PurchasingService) {}

  @Get()
  @RequireModule("inventory")
  list(@OrgId() orgId: string) {
    return this.service.list(orgId);
  }

  @Get("suppliers")
  @RequireModule("inventory")
  listSuppliers(@OrgId() orgId: string) {
    return this.service.listSuppliers(orgId);
  }

  @Post("suppliers")
  @RequireModule("inventory")
  createSupplier(
    @OrgId() orgId: string,
    @Body() body: { name: string; email?: string; phone?: string; address?: string },
  ) {
    return this.service.createSupplier(orgId, body);
  }

  @Patch("suppliers/:id")
  @RequireModule("inventory")
  updateSupplier(
    @OrgId() orgId: string,
    @Param("id") id: string,
    @Body() body: { name?: string; email?: string; phone?: string; address?: string },
  ) {
    return this.service.updateSupplier(orgId, id, body);
  }

  @Delete("suppliers/:id")
  @RequireModule("inventory")
  deleteSupplier(@OrgId() orgId: string, @Param("id") id: string) {
    return this.service.deleteSupplier(orgId, id);
  }

  @Get(":id")
  @RequireModule("inventory")
  get(@OrgId() orgId: string, @Param("id") id: string) {
    return this.service.get(orgId, id);
  }

  @Post()
  @RequireModule("inventory")
  create(
    @OrgId() orgId: string,
    @Body()
    body: {
      supplierId: string;
      items: Array<{
        inventoryItemId?: string;
        name: string;
        quantity: number;
        unitPrice: number;
      }>;
    },
  ) {
    return this.service.create(orgId, body);
  }

  @Post(":id/send")
  @RequireModule("inventory")
  send(@OrgId() orgId: string, @Param("id") id: string) {
    return this.service.send(orgId, id);
  }

  @Post(":id/grn")
  @RequireModule("inventory")
  createGrn(
    @OrgId() orgId: string,
    @Param("id") id: string,
    @Body()
    body: {
      items: Array<{
        inventoryItemId?: string;
        quantity: number;
        unitPrice: number;
      }>;
    },
  ) {
    return this.service.createGrn(orgId, id, body);
  }

  @Post("grn/:grnId/confirm")
  @RequireModule("inventory")
  confirmGrn(@OrgId() orgId: string, @Param("grnId") grnId: string) {
    return this.service.confirmGrn(orgId, grnId);
  }
}

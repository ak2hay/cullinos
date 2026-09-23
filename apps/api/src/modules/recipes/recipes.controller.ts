import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { OrgId, RequireModule } from "../../common/decorators";
import { RecipesService } from "./recipes.service";

@Controller("recipes")
export class RecipesController {
  constructor(private service: RecipesService) {}

  @Get()
  @RequireModule("inventory")
  list(@OrgId() orgId: string) {
    return this.service.list(orgId);
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
      menuItemId: string;
      name?: string;
      yieldQty?: number;
      parentRecipeId?: string | null;
      ingredients: Array<{
        inventoryItemId?: string | null;
        subRecipeId?: string | null;
        quantity: number;
        unit?: string;
      }>;
    },
  ) {
    return this.service.create(orgId, body);
  }

  @Patch(":id")
  @RequireModule("inventory")
  update(
    @OrgId() orgId: string,
    @Param("id") id: string,
    @Body()
    body: {
      yieldQty?: number;
      parentRecipeId?: string | null;
      ingredients?: Array<{
        inventoryItemId?: string | null;
        subRecipeId?: string | null;
        quantity: number;
      }>;
    },
  ) {
    return this.service.update(orgId, id, body);
  }

  @Delete(":id")
  @RequireModule("inventory")
  remove(@OrgId() orgId: string, @Param("id") id: string) {
    return this.service.delete(orgId, id);
  }
}

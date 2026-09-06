import { Body, Controller, Get, Post } from "@nestjs/common";
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

  @Post()
  @RequireModule("inventory")
  create(
    @OrgId() orgId: string,
    @Body()
    body: {
      menuItemId: string;
      name?: string;
      yieldQty?: number;
      ingredients: Array<{
        inventoryItemId: string;
        quantity: number;
        unit?: string;
      }>;
    },
  ) {
    return this.service.create(orgId, body);
  }
}

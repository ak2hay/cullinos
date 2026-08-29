import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { OrgId, RequireModule } from "../../common/decorators";
import { ProductionService } from "./production.service";

@Controller("production")
export class ProductionController {
  constructor(private service: ProductionService) {}

  @Get()
  @RequireModule("production")
  list(@OrgId() orgId: string, @Query("outletId") outletId?: string) {
    return this.service.list(orgId, outletId);
  }

  @Get("recipes/:recipeId/scale")
  @RequireModule("production")
  scaleRecipe(
    @OrgId() orgId: string,
    @Param("recipeId") recipeId: string,
    @Query("factor") factor?: string,
  ) {
    return this.service.scaleRecipe(orgId, recipeId, Number(factor ?? 1));
  }

  @Get(":id")
  @RequireModule("production")
  get(@OrgId() orgId: string, @Param("id") id: string) {
    return this.service.get(orgId, id);
  }

  @Post()
  @RequireModule("production")
  create(@OrgId() orgId: string, @Body() body: Record<string, unknown>) {
    return this.service.create(orgId, body as never);
  }

  @Patch(":id")
  @RequireModule("production")
  update(
    @OrgId() orgId: string,
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.service.update(orgId, id, body);
  }

  @Post(":id/complete")
  @RequireModule("production")
  complete(
    @OrgId() orgId: string,
    @Param("id") id: string,
    @Body("actualQty") actualQty?: number,
  ) {
    return this.service.complete(orgId, id, actualQty);
  }

  @Delete(":id")
  @RequireModule("production")
  delete(@OrgId() orgId: string, @Param("id") id: string) {
    return this.service.delete(orgId, id);
  }
}

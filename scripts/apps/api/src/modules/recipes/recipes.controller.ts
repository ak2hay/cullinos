import { Controller, Get } from "@nestjs/common";
import { OrgId } from "../../common/decorators";
import { RecipesService } from "./recipes.service";

@Controller("recipes")
export class RecipesController {
  constructor(private service: RecipesService) {}
  @Get() list(@OrgId() orgId: string) { return this.service.list(orgId); }
}

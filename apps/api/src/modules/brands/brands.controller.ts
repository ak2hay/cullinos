import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { OrgId } from "../../common/decorators";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { BrandsService } from "./brands.service";
import { CreateBrandDto } from "./dto/brand.dto";

@Controller("brands")
@RequirePermissions("org:read", "outlet:read")
export class BrandsController {
  constructor(private service: BrandsService) {}

  @Get()
  list(@OrgId() orgId: string) {
    return this.service.list(orgId);
  }

  @Get(":id")
  get(@OrgId() orgId: string, @Param("id") id: string) {
    return this.service.get(orgId, id);
  }

  @Post()
  @RequirePermissions("org:update")
  create(@OrgId() orgId: string, @Body() body: CreateBrandDto) {
    return this.service.create(orgId, body);
  }
}

import { Controller, Get, Param } from "@nestjs/common";
import { Public } from "../../common/decorators";
import { StorefrontService } from "./storefront.service";

@Controller("storefront")
export class StorefrontController {
  constructor(private service: StorefrontService) {}

  @Public()
  @Get(":orgSlug/:outletSlug")
  bootstrap(
    @Param("orgSlug") orgSlug: string,
    @Param("outletSlug") outletSlug: string,
  ) {
    return this.service.bootstrap(orgSlug, outletSlug);
  }
}

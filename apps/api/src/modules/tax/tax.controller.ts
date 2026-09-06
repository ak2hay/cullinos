import { Body, Controller, Get, Post } from "@nestjs/common";
import { OrgId } from "../../common/decorators";
import { TaxService } from "./tax.service";

@Controller("tax")
export class TaxController {
  constructor(private service: TaxService) {}

  @Get()
  list(@OrgId() orgId: string) {
    return this.service.list(orgId);
  }

  @Post("groups")
  createGroup(
    @OrgId() orgId: string,
    @Body()
    body: {
      name: string;
      rates: Array<{ name: string; rate: number; type?: string }>;
      isInclusive?: boolean;
    },
  ) {
    return this.service.createGroup(orgId, body);
  }
}

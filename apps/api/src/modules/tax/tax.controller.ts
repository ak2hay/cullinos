import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
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

  @Post("groups/ensure-presets")
  ensurePresets(@OrgId() orgId: string) {
    return this.service.ensurePresets(orgId);
  }

  @Patch("groups/:id")
  updateGroup(
    @OrgId() orgId: string,
    @Param("id") id: string,
    @Body()
    body: {
      name?: string;
      rates?: Array<{ name: string; rate: number; type?: string }>;
      isInclusive?: boolean;
    },
  ) {
    return this.service.updateGroup(orgId, id, body);
  }

  @Delete("groups/:id")
  deleteGroup(@OrgId() orgId: string, @Param("id") id: string) {
    return this.service.deleteGroup(orgId, id);
  }
}

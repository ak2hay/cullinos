import { Body, Controller, Get, Post } from "@nestjs/common";
import {
  IsArray,
  IsOptional,
  IsString,
  MinLength,
} from "class-validator";
import type { JwtPayload } from "@cullinos/auth";
import { CurrentUser, OrgId } from "../../common/decorators";
import { PromoService } from "./promo.service";

class SendCampaignDto {
  @IsString()
  @MinLength(1)
  subject!: string;

  @IsString()
  @MinLength(1)
  body!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  customerIds?: string[];
}

@Controller("promo")
export class PromoController {
  constructor(private service: PromoService) {}

  @Get("recipients/customers")
  listCustomers(@OrgId() orgId: string) {
    return this.service.listCustomerRecipients(orgId);
  }

  @Post("campaigns")
  sendCampaign(
    @OrgId() orgId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: SendCampaignDto,
  ) {
    return this.service.sendCustomerCampaign(
      orgId,
      user.sub,
      dto.subject,
      dto.body,
      dto.customerIds,
    );
  }
}

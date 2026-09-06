import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import {
  IsArray,
  IsOptional,
  IsString,
  MinLength,
} from "class-validator";
import type { JwtPayload } from "@cullinos/auth";
import { CurrentUser } from "../../common/decorators";
import { SuperAdminGuard } from "../marketing/guards/super-admin.guard";
import { PromoService } from "./promo.service";

class SendOwnerCampaignDto {
  @IsString()
  @MinLength(1)
  subject!: string;

  @IsString()
  @MinLength(1)
  body!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ownerUserIds?: string[];
}

@Controller("super-admin/promo")
@UseGuards(SuperAdminGuard)
export class SuperAdminPromoController {
  constructor(private service: PromoService) {}

  @Get("recipients/owners")
  listOwners() {
    return this.service.listOwnerRecipients();
  }

  @Get("campaigns")
  listCampaigns(@Query("page") page?: string, @Query("limit") limit?: string) {
    return this.service.listOwnerCampaigns(Number(page) || 1, Number(limit) || 20);
  }

  @Post("campaigns")
  sendCampaign(@CurrentUser() user: JwtPayload, @Body() dto: SendOwnerCampaignDto) {
    return this.service.sendOwnerCampaign(
      user.sub,
      dto.subject,
      dto.body,
      dto.ownerUserIds,
    );
  }
}

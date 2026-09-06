import { Body, Controller, Get, Post } from "@nestjs/common";
import {
  IsArray,
  IsDateString,
  IsObject,
  IsOptional,
  IsString,
} from "class-validator";
import { OrgId, RequireModule } from "../../common/decorators";
import { FranchiseService } from "./franchise.service";

class CreateFranchiseAgreementDto {
  @IsString()
  franchiseeName!: string;

  @IsDateString()
  startDate!: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsObject()
  terms?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  outletIds?: string[];
}

@Controller("franchise")
@RequireModule("franchise")
export class FranchiseController {
  constructor(private service: FranchiseService) {}

  @Get()
  list(@OrgId() orgId: string) {
    return this.service.list(orgId);
  }

  @Post()
  create(@OrgId() orgId: string, @Body() dto: CreateFranchiseAgreementDto) {
    return this.service.createAgreement(orgId, dto);
  }

  @Get("franchisees")
  listFranchisees(@OrgId() orgId: string) {
    return this.service.listFranchisees(orgId);
  }
}

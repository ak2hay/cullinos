import { Body, Controller, Get, Post } from "@nestjs/common";
import { IsBoolean, IsObject, IsOptional, IsString } from "class-validator";
import { OrgId } from "../../common/decorators";
import { IntegrationsService } from "./integrations.service";

class RegisterIntegrationDto {
  @IsString()
  provider!: string;

  @IsObject()
  config!: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

@Controller("integrations")
export class IntegrationsController {
  constructor(private service: IntegrationsService) {}

  @Get()
  list(@OrgId() orgId: string) {
    return this.service.list(orgId);
  }

  @Post()
  register(@OrgId() orgId: string, @Body() dto: RegisterIntegrationDto) {
    return this.service.register(orgId, dto);
  }
}

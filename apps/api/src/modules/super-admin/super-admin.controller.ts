import { Body, Controller, Get, Param, Patch, Post, Put, Query, UseGuards } from "@nestjs/common";
import { IsEmail, IsOptional, IsString, MinLength } from "class-validator";
import { Public } from "../../common/decorators";
import { SuperAdminGuard } from "../marketing/guards/super-admin.guard";
import { SuperAdminService } from "./super-admin.service";

class SuperAdminLoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(4)
  password!: string;
}

class SuspendDto {
  @IsString()
  reason!: string;
}

class OnboardRestaurantDto {
  @IsString()
  @MinLength(2)
  companyName!: string;

  @IsString()
  planSlug!: string;

  @IsEmail()
  ownerEmail!: string;

  @IsString()
  @MinLength(8)
  ownerPassword!: string;

  @IsString()
  @IsOptional()
  ownerName?: string;

  @IsString()
  @IsOptional()
  outletName?: string;
}

@Controller("super-admin")
@UseGuards(SuperAdminGuard)
export class SuperAdminController {
  constructor(private service: SuperAdminService) {}

  @Public()
  @Post("login")
  login(@Body() dto: SuperAdminLoginDto) {
    return this.service.login(dto.email, dto.password);
  }

  @Post("organizations")
  onboardRestaurant(@Body() body: OnboardRestaurantDto) {
    return this.service.onboardRestaurant(body);
  }

  @Get("organizations")
  listOrganizations(@Query("page") page?: string, @Query("limit") limit?: string) {
    return this.service.listOrganizations(Number(page) || 1, Number(limit) || 20);
  }

  @Get("tenants")
  listTenants() {
    return this.service.listTenants();
  }

  @Patch("organizations/:id/suspend")
  suspendOrganization(@Param("id") id: string, @Body() body: SuspendDto) {
    return this.service.suspendTenant(id, body.reason);
  }

  @Patch("organizations/:id/activate")
  activateOrganization(@Param("id") id: string) {
    return this.service.reactivateTenant(id);
  }

  @Put("organizations/:id/subscription")
  manageSubscription(
    @Param("id") id: string,
    @Body() body: { planId?: string; planSlug?: string; status: string },
  ) {
    return this.service.manageSubscription(id, body);
  }

  @Get("plans")
  listPlans() {
    return this.service.listPlans();
  }

  @Patch("tenants/:id/suspend")
  suspend(@Param("id") id: string) {
    return this.service.suspendTenant(id);
  }

  @Patch("tenants/:id/reactivate")
  reactivate(@Param("id") id: string) {
    return this.service.reactivateTenant(id);
  }

  @Get("health")
  health() {
    return this.service.health();
  }
}

import { Body, Controller, Get, Param, Patch, Post, Put, Query } from "@nestjs/common";
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";
import type { JwtPayload } from "@cullinos/auth";
import { CurrentUser, OrgId, RequireModule } from "../../common/decorators";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { AuditService } from "../audit/audit.service";
import { UrbanPiperService } from "./urbanpiper.service";

class UrbanPiperSettingsDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  apiKey?: string;

  @IsOptional()
  @IsIn(["sandbox", "production"])
  mode?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(30)
  acceptTimeoutMinutes?: number;

  @IsOptional()
  @IsBoolean()
  autoRejectOnTimeout?: boolean;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(120)
  defaultPrepTimeMinutes?: number;

  @IsOptional()
  @IsBoolean()
  autoPushMenu?: boolean;
}

class UrbanPiperOutletDto {
  @IsOptional()
  @IsBoolean()
  connected?: boolean;

  @IsOptional()
  @IsString()
  storeRefId?: string | null;

  @IsOptional()
  @IsObject()
  platforms?: { swiggy?: boolean; zomato?: boolean };
}

class ItemAvailabilityDto {
  @IsArray()
  @IsString({ each: true })
  itemIds!: string[];

  @IsBoolean()
  available!: boolean;
}

class StoreOnlineDto {
  @IsBoolean()
  online!: boolean;
}

class MapItemDto {
  @IsString()
  externalItemId!: string;

  @IsOptional()
  @IsString()
  menuItemId?: string | null;
}

class AcceptDto {
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(120)
  prepTimeMinutes?: number;
}

class RejectDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

@Controller("urbanpiper")
@RequireModule("orders")
export class UrbanPiperController {
  constructor(
    private service: UrbanPiperService,
    private audit: AuditService,
  ) {}

  @Get("settings")
  @RequirePermissions("settings:read")
  getSettings(@OrgId() orgId: string) {
    return this.service.getSettings(orgId);
  }

  @Put("settings")
  @RequirePermissions("settings:update")
  async updateSettings(
    @OrgId() orgId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UrbanPiperSettingsDto,
  ) {
    const result = await this.service.updateSettings(orgId, dto);
    await this.audit.log({
      organizationId: orgId,
      userId: user.sub,
      action: "urbanpiper.update",
      entityType: "aggregator_integration",
      entityId: "urbanpiper",
      metadata: {
        isActive: dto.isActive ?? null,
        apiKeyChanged: Boolean(dto.apiKey?.trim()),
        mode: dto.mode ?? null,
      },
    });
    return result;
  }

  @Post("settings/regenerate-webhook-secret")
  @RequirePermissions("settings:update")
  async regenerateSecret(@OrgId() orgId: string, @CurrentUser() user: JwtPayload) {
    const result = await this.service.regenerateWebhookSecret(orgId);
    await this.audit.log({
      organizationId: orgId,
      userId: user.sub,
      action: "urbanpiper.webhook_secret_rotated",
      entityType: "aggregator_integration",
      entityId: "urbanpiper",
    });
    return result;
  }

  @Patch("outlets/:outletId")
  @RequirePermissions("settings:update")
  updateOutlet(
    @OrgId() orgId: string,
    @Param("outletId") outletId: string,
    @Body() dto: UrbanPiperOutletDto,
  ) {
    return this.service.updateOutlet(orgId, outletId, dto);
  }

  @Post("outlets/:outletId/menu-push")
  @RequirePermissions("menu:update")
  pushMenu(@OrgId() orgId: string, @Param("outletId") outletId: string) {
    return this.service.pushMenu(orgId, outletId);
  }

  @Post("outlets/:outletId/items/availability")
  @RequirePermissions("menu:update")
  setItemsAvailability(
    @OrgId() orgId: string,
    @Param("outletId") outletId: string,
    @Body() dto: ItemAvailabilityDto,
  ) {
    return this.service.setItemsAvailability(orgId, outletId, dto.itemIds, dto.available);
  }

  @Post("outlets/:outletId/store-status")
  @RequirePermissions("order:update")
  setStoreOnline(
    @OrgId() orgId: string,
    @Param("outletId") outletId: string,
    @Body() dto: StoreOnlineDto,
  ) {
    return this.service.setStoreOnline(orgId, outletId, dto.online);
  }

  @Post("outlets/:outletId/item-map")
  @RequirePermissions("menu:update")
  mapItem(
    @OrgId() orgId: string,
    @Param("outletId") outletId: string,
    @Body() dto: MapItemDto,
  ) {
    return this.service.mapItem(orgId, outletId, dto.externalItemId, dto.menuItemId ?? null);
  }

  @Get("orders")
  @RequirePermissions("order:read")
  listOrders(@OrgId() orgId: string, @Query("outletId") outletId: string) {
    return this.service.listOrders(orgId, outletId);
  }

  @Post("orders/:id/accept")
  @RequirePermissions("order:update")
  accept(@OrgId() orgId: string, @Param("id") id: string, @Body() dto: AcceptDto) {
    return this.service.accept(orgId, id, dto.prepTimeMinutes);
  }

  @Post("orders/:id/reject")
  @RequirePermissions("order:update")
  reject(
    @OrgId() orgId: string,
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() dto: RejectDto,
  ) {
    return this.service.reject(orgId, id, dto.reason, user.sub);
  }

  @Post("orders/:id/ready")
  @RequirePermissions("order:update")
  ready(@OrgId() orgId: string, @CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.service.markReady(orgId, id, user.sub);
  }

  @Post("orders/:id/dispatch")
  @RequirePermissions("order:update")
  dispatch(@OrgId() orgId: string, @CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.service.markDispatched(orgId, id, user.sub);
  }

  @Post("orders/:id/retry-sync")
  @RequirePermissions("order:update")
  retrySync(@OrgId() orgId: string, @Param("id") id: string) {
    return this.service.retryStatusSync(orgId, id);
  }
}

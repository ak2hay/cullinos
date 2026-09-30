import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from "@nestjs/common";
import { IsBoolean, IsObject, IsOptional, IsString } from "class-validator";
import type { AggregatorOutletConfig, AggregatorProvider } from "@cullinos/integrations";
import type { JwtPayload } from "@cullinos/auth";
import { CurrentUser, OrgId, RequireModule } from "../../common/decorators";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { AuditService } from "../audit/audit.service";
import { AggregatorsService, type SettlementImportRow } from "./aggregators.service";

class UpsertAggregatorDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  webhookSecret?: string;

  @IsOptional()
  @IsObject()
  outlets?: Record<string, AggregatorOutletConfig>;
}

class OutletFlagsDto {
  @IsOptional()
  @IsBoolean()
  connected?: boolean;

  @IsOptional()
  @IsBoolean()
  menuSyncEnabled?: boolean;
}

class ImportSettlementsDto {
  @IsOptional()
  @IsString()
  format?: "csv" | "json";

  @IsOptional()
  @IsString()
  csv?: string;

  @IsOptional()
  rows?: SettlementImportRow[];
}

@Controller("aggregators")
@RequireModule("reports")
export class AggregatorsController {
  constructor(
    private service: AggregatorsService,
    private audit: AuditService,
  ) {}

  @Get()
  @RequirePermissions("settings:read")
  list(@OrgId() orgId: string) {
    return this.service.list(orgId);
  }

  @Get("reconciliation")
  @RequirePermissions("reports:read")
  reconciliation(
    @OrgId() orgId: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("outletId") outletId?: string,
    @Query("provider") provider?: string,
  ) {
    return this.service.reconciliationReport(orgId, { from, to, outletId, provider });
  }

  @Get(":provider")
  @RequirePermissions("settings:read")
  get(@OrgId() orgId: string, @Param("provider") provider: AggregatorProvider) {
    return this.service.getProvider(orgId, provider);
  }

  @Put(":provider")
  @RequirePermissions("settings:update")
  async upsert(
    @OrgId() orgId: string,
    @CurrentUser() user: JwtPayload,
    @Param("provider") provider: AggregatorProvider,
    @Body() dto: UpsertAggregatorDto,
  ) {
    const result = await this.service.upsertProvider(orgId, provider, dto);
    await this.audit.log({
      organizationId: orgId,
      userId: user.sub,
      action: "aggregators.update",
      entityType: "aggregator_integration",
      entityId: provider,
      metadata: {
        isActive: dto.isActive ?? null,
        webhookSecretChanged: Boolean(dto.webhookSecret),
        outletsChanged: dto.outlets !== undefined,
      },
    });
    return result;
  }

  @Post(":provider/regenerate-webhook-secret")
  @RequirePermissions("settings:update")
  async regenerateSecret(
    @OrgId() orgId: string,
    @CurrentUser() user: JwtPayload,
    @Param("provider") provider: AggregatorProvider,
  ) {
    const result = await this.service.regenerateWebhookSecret(orgId, provider);
    await this.audit.log({
      organizationId: orgId,
      userId: user.sub,
      action: "aggregators.webhook_secret_rotated",
      entityType: "aggregator_integration",
      entityId: provider,
    });
    return result;
  }

  @Patch(":provider/outlets/:outletId")
  @RequirePermissions("settings:update")
  updateOutlet(
    @OrgId() orgId: string,
    @Param("provider") provider: AggregatorProvider,
    @Param("outletId") outletId: string,
    @Body() dto: OutletFlagsDto,
  ) {
    return this.service.updateOutletFlags(orgId, provider, outletId, dto);
  }

  @Post(":provider/outlets/:outletId/menu-sync")
  @RequirePermissions("menu:update")
  menuSync(
    @OrgId() orgId: string,
    @Param("provider") provider: AggregatorProvider,
    @Param("outletId") outletId: string,
  ) {
    return this.service.syncMenu(orgId, provider, outletId);
  }

  @Post("settlements/import")
  @RequirePermissions("reports:export")
  importSettlements(@OrgId() orgId: string, @Body() dto: ImportSettlementsDto) {
    const format = dto.format ?? (dto.csv ? "csv" : "json");
    const rows =
      format === "csv" && dto.csv
        ? this.service.parseSettlementCsv(dto.csv)
        : (dto.rows ?? []);
    return this.service.importSettlements(orgId, rows, format);
  }
}

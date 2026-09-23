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
import { OrgId, RequireModule } from "../../common/decorators";
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
  constructor(private service: AggregatorsService) {}

  @Get()
  list(@OrgId() orgId: string) {
    return this.service.list(orgId);
  }

  @Get("reconciliation")
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
  get(@OrgId() orgId: string, @Param("provider") provider: AggregatorProvider) {
    return this.service.getProvider(orgId, provider);
  }

  @Put(":provider")
  upsert(
    @OrgId() orgId: string,
    @Param("provider") provider: AggregatorProvider,
    @Body() dto: UpsertAggregatorDto,
  ) {
    return this.service.upsertProvider(orgId, provider, dto);
  }

  @Post(":provider/regenerate-webhook-secret")
  regenerateSecret(
    @OrgId() orgId: string,
    @Param("provider") provider: AggregatorProvider,
  ) {
    return this.service.regenerateWebhookSecret(orgId, provider);
  }

  @Patch(":provider/outlets/:outletId")
  updateOutlet(
    @OrgId() orgId: string,
    @Param("provider") provider: AggregatorProvider,
    @Param("outletId") outletId: string,
    @Body() dto: OutletFlagsDto,
  ) {
    return this.service.updateOutletFlags(orgId, provider, outletId, dto);
  }

  @Post(":provider/outlets/:outletId/menu-sync")
  menuSync(
    @OrgId() orgId: string,
    @Param("provider") provider: AggregatorProvider,
    @Param("outletId") outletId: string,
  ) {
    return this.service.syncMenu(orgId, provider, outletId);
  }

  @Post("settlements/import")
  importSettlements(@OrgId() orgId: string, @Body() dto: ImportSettlementsDto) {
    const format = dto.format ?? (dto.csv ? "csv" : "json");
    const rows =
      format === "csv" && dto.csv
        ? this.service.parseSettlementCsv(dto.csv)
        : (dto.rows ?? []);
    return this.service.importSettlements(orgId, rows, format);
  }
}

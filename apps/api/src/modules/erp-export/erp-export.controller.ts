import { Controller, Get, Query } from "@nestjs/common";
import { OrgId, RequireModule } from "../../common/decorators";
import { ErpExportService } from "./erp-export.service";

@Controller("erp-export")
export class ErpExportController {
  constructor(private service: ErpExportService) {}

  @Get("day-book")
  @RequireModule("reports")
  dayBook(
    @OrgId() orgId: string,
    @Query("outletId") outletId: string,
    @Query("date") date?: string,
    @Query("format") format?: "csv" | "xml",
  ) {
    return this.service.dayBook(orgId, outletId, date, format ?? "csv");
  }
}

import { Module } from "@nestjs/common";
import { ErpExportController } from "./erp-export.controller";
import { ErpExportService } from "./erp-export.service";

@Module({
  controllers: [ErpExportController],
  providers: [ErpExportService],
  exports: [ErpExportService],
})
export class ErpExportModule {}

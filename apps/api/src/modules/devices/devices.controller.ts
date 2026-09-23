import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from "@nestjs/common";
import { OrgId } from "../../common/decorators";
import { DevicesService } from "./devices.service";
import type { PrintProfileKind } from "./print-profile.types";

@Controller("devices")
export class DevicesController {
  constructor(private service: DevicesService) {}

  @Get()
  list(
    @OrgId() orgId: string,
    @Query("includeVirtual") includeVirtual?: string,
  ) {
    return this.service.list(orgId, {
      includeVirtual: includeVirtual === "1" || includeVirtual === "true",
    });
  }

  @Post("pairing-sessions")
  createPairingSession(
    @OrgId() orgId: string,
    @Body() body: { type?: string; outletId?: string; nameHint?: string },
  ) {
    return this.service.createPairingSession(orgId, body);
  }

  @Post("pair")
  claimPairing(
    @OrgId() orgId: string,
    @Body() body: { code: string; name?: string; platform?: string },
  ) {
    return this.service.claimPairing(orgId, body);
  }

  @Get("print-jobs")
  listPrintJobs(
    @OrgId() orgId: string,
    @Query("status") status?: string,
  ) {
    return this.service.listPrintJobs(orgId, { status });
  }

  @Post("print-jobs")
  createPrintJob(
    @OrgId() orgId: string,
    @Body()
    body: {
      outletId?: string;
      deviceId?: string;
      orderId?: string;
      kind?: string;
      status?: "pending" | "sent" | "failed" | "done";
      error?: string;
      payloadSummary?: string;
    },
  ) {
    return this.service.createPrintJob(orgId, body);
  }

  @Patch("print-jobs/:id")
  updatePrintJob(
    @OrgId() orgId: string,
    @Param("id") id: string,
    @Body() body: { status?: string; error?: string | null },
  ) {
    return this.service.updatePrintJob(orgId, id, body);
  }

  /**
   * POST /devices/display-heartbeat
   * Stamped by authenticated display pages (e.g. KDS) to update Device.lastSeenAt.
   */
  @Post("display-heartbeat")
  displayHeartbeat(
    @OrgId() orgId: string,
    @Body() body: { outletId: string; mode: string },
  ) {
    if (!body.outletId) throw new BadRequestException("outletId is required");
    const mode = (body.mode || "kds").toLowerCase().replace(/[^a-z]/g, "");
    return this.service.upsertDisplayHeartbeat(orgId, body.outletId, mode);
  }

  @Get("print-profiles")
  getPrintProfiles(@OrgId() orgId: string, @Query("outletId") outletId: string) {
    if (!outletId) throw new BadRequestException("outletId query is required");
    return this.service.getPrintProfiles(orgId, outletId);
  }

  @Get("print-profiles/:kind")
  getPrintProfile(
    @OrgId() orgId: string,
    @Param("kind") kind: PrintProfileKind,
    @Query("outletId") outletId: string,
  ) {
    if (!outletId) throw new BadRequestException("outletId query is required");
    if (kind !== "receipt" && kind !== "kot") {
      throw new BadRequestException("kind must be receipt or kot");
    }
    return this.service.getPrintProfile(orgId, outletId, kind);
  }

  @Put("print-profiles/:kind")
  upsertPrintProfile(
    @OrgId() orgId: string,
    @Param("kind") kind: PrintProfileKind,
    @Query("outletId") outletId: string,
    @Body()
    body: Partial<{
      paperWidthMm: number;
      fontSize: "small" | "normal" | "large";
      headerText: string;
      footerText: string;
      showLogo: boolean;
      showTaxBreakdown: boolean;
      copies: number;
      cutPaper: boolean;
      deviceId: string | null;
    }>,
  ) {
    if (!outletId) throw new BadRequestException("outletId query is required");
    if (kind !== "receipt" && kind !== "kot") {
      throw new BadRequestException("kind must be receipt or kot");
    }
    return this.service.upsertPrintProfile(orgId, outletId, kind, body);
  }

  @Post()
  create(
    @OrgId() orgId: string,
    @Body()
    body: {
      name: string;
      type: string;
      outletId?: string;
      identifier?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    return this.service.create(orgId, body);
  }

  @Patch(":id")
  update(
    @OrgId() orgId: string,
    @Param("id") id: string,
    @Body()
    body: {
      name?: string;
      type?: string;
      outletId?: string | null;
      identifier?: string | null;
      metadata?: Record<string, unknown>;
    },
  ) {
    return this.service.update(orgId, id, body);
  }

  @Delete(":id")
  remove(@OrgId() orgId: string, @Param("id") id: string) {
    return this.service.delete(orgId, id);
  }
}

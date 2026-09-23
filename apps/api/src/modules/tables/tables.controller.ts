import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import type { JwtPayload } from "@cullinos/auth";
import { CurrentUser, OrgId, Public, RequireModule } from "../../common/decorators";
import { ServiceRequestsService } from "./service-requests.service";
import { TableSessionsService } from "./table-sessions.service";
import { TablesService } from "./tables.service";

@Controller("tables")
export class TablesController {
  constructor(
    private service: TablesService,
    private sessions: TableSessionsService,
    private serviceRequests: ServiceRequestsService,
  ) {}

  @Post()
  @RequireModule("tables")
  create(
    @OrgId() orgId: string,
    @Body()
    body: {
      outletId: string;
      name: string;
      capacity?: number;
      sectionName?: string;
      floorId?: string;
      sectionId?: string;
      floorName?: string;
    },
  ) {
    return this.service.create(orgId, body);
  }

  @Get("outlets/:outletId/floors")
  @RequireModule("tables")
  listFloors(@OrgId() orgId: string, @Param("outletId") outletId: string) {
    return this.service.listFloors(orgId, outletId);
  }

  @Post("outlets/:outletId/floors")
  @RequireModule("tables")
  createFloor(
    @OrgId() orgId: string,
    @Param("outletId") outletId: string,
    @Body() body: { name?: string; sortOrder?: number },
  ) {
    return this.service.createFloor(orgId, outletId, {
      name: body.name ?? "",
      sortOrder: body.sortOrder,
    });
  }

  @Post("outlets/:outletId/floors/:floorId/sections")
  @RequireModule("tables")
  createSection(
    @OrgId() orgId: string,
    @Param("outletId") outletId: string,
    @Param("floorId") floorId: string,
    @Body() body: { name?: string; sortOrder?: number },
  ) {
    return this.service.createSection(orgId, outletId, floorId, {
      name: body.name ?? "",
      sortOrder: body.sortOrder,
    });
  }

  @Get("outlets/:outletId")
  @RequireModule("tables")
  listByOutlet(@OrgId() orgId: string, @Param("outletId") outletId: string) {
    return this.service.listByOutlet(orgId, outletId);
  }

  @Get("outlets/:outletId/service-requests")
  @RequireModule("tables")
  listServiceRequests(
    @OrgId() orgId: string,
    @Param("outletId") outletId: string,
    @Query("status") status?: string,
  ) {
    return this.serviceRequests.listForOutlet(orgId, outletId, status);
  }

  @Patch("outlets/:outletId/service-requests/:id/acknowledge")
  @RequireModule("tables")
  acknowledgeServiceRequest(
    @OrgId() orgId: string,
    @CurrentUser() user: JwtPayload,
    @Param("outletId") outletId: string,
    @Param("id") id: string,
  ) {
    return this.serviceRequests.acknowledge(orgId, outletId, id, user.sub);
  }

  @Patch("outlets/:outletId/service-requests/:id/resolve")
  @RequireModule("tables")
  resolveServiceRequest(
    @OrgId() orgId: string,
    @CurrentUser() user: JwtPayload,
    @Param("outletId") outletId: string,
    @Param("id") id: string,
  ) {
    return this.serviceRequests.resolve(orgId, outletId, id, user.sub);
  }

  @Patch("outlets/:outletId/:tableId/status")
  @RequireModule("tables")
  updateStatus(
    @OrgId() orgId: string,
    @Param("outletId") outletId: string,
    @Param("tableId") tableId: string,
    @Body("status") status: string,
  ) {
    return this.service.updateStatus(orgId, outletId, tableId, status);
  }

  @Patch("outlets/:outletId/:tableId")
  @RequireModule("tables")
  update(
    @OrgId() orgId: string,
    @Param("outletId") outletId: string,
    @Param("tableId") tableId: string,
    @Body()
    body: {
      name?: string;
      capacity?: number;
      floorId?: string;
      sectionId?: string;
      sectionName?: string;
      floorName?: string;
    },
  ) {
    return this.service.update(orgId, outletId, tableId, body);
  }

  @Delete("outlets/:outletId/:tableId")
  @RequireModule("tables")
  remove(
    @OrgId() orgId: string,
    @Param("outletId") outletId: string,
    @Param("tableId") tableId: string,
  ) {
    return this.service.remove(orgId, outletId, tableId);
  }

  @Post("outlets/:outletId/:tableId/regenerate-qr")
  @RequireModule("tables")
  regenerateQr(
    @OrgId() orgId: string,
    @Param("outletId") outletId: string,
    @Param("tableId") tableId: string,
  ) {
    return this.service.regenerateQr(orgId, outletId, tableId);
  }

  @Post("outlets/:outletId/merge")
  @RequireModule("tables")
  mergeTables(
    @OrgId() orgId: string,
    @Param("outletId") outletId: string,
    @Body() body: { primaryTableId?: string; tableIds?: string[] },
  ) {
    return this.sessions.mergeTables(
      orgId,
      outletId,
      body.primaryTableId ?? "",
      body.tableIds ?? [],
    );
  }

  @Post("outlets/:outletId/transfer")
  @RequireModule("tables")
  transferTable(
    @OrgId() orgId: string,
    @Param("outletId") outletId: string,
    @Body() body: { fromTableId?: string; toTableId?: string },
  ) {
    return this.sessions.transferTable(
      orgId,
      outletId,
      body.fromTableId ?? "",
      body.toTableId ?? "",
    );
  }

  @Post("outlets/:outletId/:tableId/sessions")
  @RequireModule("tables")
  startSession(
    @OrgId() orgId: string,
    @Param("outletId") outletId: string,
    @Param("tableId") tableId: string,
    @Body("guestCount") guestCount?: number,
  ) {
    return this.sessions.startSession(orgId, outletId, tableId, guestCount);
  }

  @Get("outlets/:outletId/:tableId/sessions/active")
  @RequireModule("tables")
  getActiveSession(
    @OrgId() orgId: string,
    @Param("outletId") outletId: string,
    @Param("tableId") tableId: string,
  ) {
    return this.sessions.getActiveSession(orgId, outletId, tableId);
  }

  @Post("outlets/:outletId/:tableId/sessions/:sessionId/close")
  @RequireModule("tables")
  closeSession(
    @OrgId() orgId: string,
    @Param("outletId") outletId: string,
    @Param("tableId") tableId: string,
    @Param("sessionId") sessionId: string,
  ) {
    return this.sessions.closeSession(orgId, outletId, tableId, sessionId);
  }
}

@Controller("public/tables")
export class PublicTablesController {
  constructor(
    private service: TablesService,
    private sessions: TableSessionsService,
  ) {}

  @Public()
  @Get("outlets/:outletId")
  list(@Param("outletId") outletId: string) {
    return this.service.listByOutletPublic(outletId);
  }

  /** Resolve permanent table QR and join/create a dining session. */
  @Public()
  @Get("by-qr/:qrCode")
  resolveByQr(@Param("qrCode") qrCode: string) {
    return this.sessions.joinOrCreateByQrCode(qrCode);
  }

  @Public()
  @Post("by-qr/:qrCode/join")
  joinByQr(@Param("qrCode") qrCode: string) {
    return this.sessions.joinOrCreateByQrCode(qrCode);
  }
}

@Controller("public/sessions")
export class PublicSessionsController {
  constructor(
    private sessions: TableSessionsService,
    private serviceRequests: ServiceRequestsService,
  ) {}

  @Public()
  @Get(":token")
  validate(@Param("token") token: string) {
    return this.sessions.validatePublicSession(token);
  }

  @Public()
  @Post(":token/items")
  addItems(
    @Param("token") token: string,
    @Body() body: Record<string, unknown>,
  ) {
    const items = (body.items ?? []) as never[];
    return this.sessions.addItemsToSession(token, items, {
      customerName: body.customerName as string | undefined,
      notes: body.notes as string | undefined,
    });
  }

  @Public()
  @Post(":token/submit")
  submit(@Param("token") token: string) {
    return this.sessions.submitSessionOrder(token);
  }

  @Public()
  @Post(":token/service-requests")
  createServiceRequest(
    @Param("token") token: string,
    @Body() body: { type?: "waiter" | "bill" | "water"; note?: string },
  ) {
    return this.serviceRequests.createFromSession(token, body);
  }
}

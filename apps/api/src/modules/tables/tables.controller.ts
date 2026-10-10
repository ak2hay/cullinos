import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { JwtPayload } from "@cullinos/auth";
import { CurrentUser, OrgId, Public, RequireModule } from "../../common/decorators";
import {
  provePublicCustomerId,
  resolvePublicCustomerByPhone,
} from "../../common/public-customer.util";
import { PrismaService } from "../../prisma/prisma.service";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { MergeTablesDto, TransferTableDto } from "./dto/tables.dto";
import { ServiceRequestsService } from "./service-requests.service";
import { TableSessionsService } from "./table-sessions.service";
import { TablesService } from "./tables.service";

@Controller("tables")
@RequirePermissions("table:manage", "pos:access")
export class TablesController {
  constructor(
    private service: TablesService,
    private sessions: TableSessionsService,
    private serviceRequests: ServiceRequestsService,
  ) {}

  @Post()
  @RequireModule("tables")
  @RequirePermissions("outlet:update", "settings:update")
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
  @RequirePermissions("table:read")
  listFloors(@OrgId() orgId: string, @Param("outletId") outletId: string) {
    return this.service.listFloors(orgId, outletId);
  }

  @Post("outlets/:outletId/floors")
  @RequireModule("tables")
  @RequirePermissions("outlet:update", "settings:update")
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

  @Patch("outlets/:outletId/floors/:floorId")
  @RequireModule("tables")
  @RequirePermissions("outlet:update", "settings:update")
  updateFloor(
    @OrgId() orgId: string,
    @Param("outletId") outletId: string,
    @Param("floorId") floorId: string,
    @Body() body: { name?: string; sortOrder?: number },
  ) {
    return this.service.updateFloor(orgId, outletId, floorId, {
      name: typeof body?.name === "string" ? body.name : undefined,
      sortOrder: body?.sortOrder,
    });
  }

  @Delete("outlets/:outletId/floors/:floorId")
  @RequireModule("tables")
  @RequirePermissions("outlet:update", "settings:update")
  deleteFloor(
    @OrgId() orgId: string,
    @Param("outletId") outletId: string,
    @Param("floorId") floorId: string,
  ) {
    return this.service.deleteFloor(orgId, outletId, floorId);
  }

  @Post("outlets/:outletId/floors/:floorId/sections")
  @RequireModule("tables")
  @RequirePermissions("outlet:update", "settings:update")
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
  @RequirePermissions("table:read")
  listByOutlet(@OrgId() orgId: string, @Param("outletId") outletId: string) {
    return this.service.listByOutlet(orgId, outletId);
  }

  @Get("outlets/:outletId/service-requests")
  @RequireModule("tables")
  @RequirePermissions("table:read")
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
  @RequirePermissions("outlet:update", "settings:update")
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
  @RequirePermissions("outlet:update", "settings:update")
  remove(
    @OrgId() orgId: string,
    @Param("outletId") outletId: string,
    @Param("tableId") tableId: string,
  ) {
    return this.service.remove(orgId, outletId, tableId);
  }

  @Post("outlets/:outletId/:tableId/regenerate-qr")
  @RequireModule("tables")
  @RequirePermissions("outlet:update", "settings:update")
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
    @Body() body: MergeTablesDto,
  ) {
    return this.sessions.mergeTables(orgId, outletId, body.primaryTableId, body.tableIds);
  }

  @Post("outlets/:outletId/transfer")
  @RequireModule("tables")
  transferTable(
    @OrgId() orgId: string,
    @Param("outletId") outletId: string,
    @Body() body: TransferTableDto,
  ) {
    return this.sessions.transferTable(orgId, outletId, body.fromTableId, body.toTableId);
  }

  @Post("outlets/:outletId/:tableId/unmerge")
  @RequireModule("tables")
  unmergeTable(
    @OrgId() orgId: string,
    @Param("outletId") outletId: string,
    @Param("tableId") tableId: string,
  ) {
    return this.sessions.unmergeTable(orgId, outletId, tableId);
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
  @RequirePermissions("table:read")
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
  constructor(private sessions: TableSessionsService) {}

  /**
   * @deprecated Kept only for guest app builds that predate `POST by-qr/:qrCode/join`.
   * The QR code is the secret — never expose table QR codes through a public listing.
   */
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
    private jwt: JwtService,
    private prisma: PrismaService,
  ) {}

  @Public()
  @Get(":token")
  validate(@Param("token") token: string) {
    return this.sessions.validatePublicSession(token);
  }

  @Public()
  @Post(":token/items")
  async addItems(
    @Param("token") token: string,
    @Body() body: Record<string, unknown>,
    @Headers("authorization") authorization?: string,
  ) {
    const items = (body.items ?? []) as never[];
    const orgId = await this.sessions.organizationIdForToken(token);
    const customerId =
      (await provePublicCustomerId(
        this.jwt,
        this.prisma,
        orgId,
        typeof body.customerId === "string" ? body.customerId : undefined,
        authorization,
      )) ?? (await resolvePublicCustomerByPhone(this.prisma, orgId, body.customerPhone, body.customerName));
    return this.sessions.addItemsToSession(token, items, {
      customerName: body.customerName as string | undefined,
      notes: body.notes as string | undefined,
      ageConfirmed: body.ageConfirmed === true,
      customerId,
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

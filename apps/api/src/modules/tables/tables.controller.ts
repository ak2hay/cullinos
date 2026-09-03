import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { OrgId, Public, RequireModule } from "../../common/decorators";
import { TableSessionsService } from "./table-sessions.service";
import { TablesService } from "./tables.service";

@Controller("tables")
export class TablesController {
  constructor(
    private service: TablesService,
    private sessions: TableSessionsService,
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
    },
  ) {
    return this.service.create(orgId, body);
  }

  @Get("outlets/:outletId")
  @RequireModule("tables")
  listByOutlet(@OrgId() orgId: string, @Param("outletId") outletId: string) {
    return this.service.listByOutlet(orgId, outletId);
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
  constructor(private service: TablesService) {}

  @Public()
  @Get("outlets/:outletId")
  list(@Param("outletId") outletId: string) {
    return this.service.listByOutletPublic(outletId);
  }
}

@Controller("public/sessions")
export class PublicSessionsController {
  constructor(private sessions: TableSessionsService) {}

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
}

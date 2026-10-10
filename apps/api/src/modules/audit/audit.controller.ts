import { Controller, Get, Query } from "@nestjs/common";
import { OrgId } from "../../common/decorators";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { AuditService, REFUND_AUDIT_ACTIONS } from "./audit.service";

@Controller("audit")
@RequirePermissions("org:manage_settings", "staff:manage")
export class AuditController {
  constructor(private service: AuditService) {}

  @Get()
  list(
    @OrgId() orgId: string,
    @Query("action") action?: string,
    @Query("entityId") entityId?: string,
  ) {
    return this.service.list(orgId, { action, entityId });
  }

  /** Refund and passcode activity — visible to anyone allowed to refund. */
  @Get("refunds")
  @RequirePermissions("order:refund", "org:manage_settings")
  refunds(@OrgId() orgId: string, @Query("entityId") entityId?: string) {
    return this.service.list(orgId, { actions: [...REFUND_AUDIT_ACTIONS], entityId });
  }
}

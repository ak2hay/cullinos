import { Controller, Get } from "@nestjs/common";
import { OrgId } from "../../common/decorators";
import { NotificationsService } from "./notifications.service";

@Controller("notifications")
export class NotificationsController {
  constructor(private service: NotificationsService) {}
  @Get() list(@OrgId() orgId: string) { return this.service.list(orgId); }
}

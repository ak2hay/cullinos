import { Controller, Get, Param, Patch } from "@nestjs/common";
import { SuperAdminService } from "./super-admin.service";

@Controller("super-admin")
export class SuperAdminController {
  constructor(private service: SuperAdminService) {}
  @Get("tenants") listTenants() { return this.service.listTenants(); }
  @Patch("tenants/:id/suspend") suspend(@Param("id") id: string) { return this.service.suspendTenant(id); }
  @Patch("tenants/:id/reactivate") reactivate(@Param("id") id: string) { return this.service.reactivateTenant(id); }
}

import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { OrgId } from "../../common/decorators";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { UsersService } from "./users.service";

@Controller("users")
export class UsersController {
  constructor(private service: UsersService) {}

  @Get()
  @RequirePermissions("staff:read", "org:manage_users")
  list(@OrgId() orgId: string) {
    return this.service.list(orgId);
  }

  /** Restaurant owner creates floor staff, managers, cashiers, etc. */
  @Post()
  @RequirePermissions("staff:manage", "org:manage_users")
  create(
    @OrgId() orgId: string,
    @Body()
    body: {
      email: string;
      password: string;
      name: string;
      roleSlug: string;
      outletIds?: string[];
    },
  ) {
    return this.service.createStaffUser(orgId, body);
  }

  @Patch(":id/deactivate")
  @RequirePermissions("staff:manage", "org:manage_users")
  deactivate(@OrgId() orgId: string, @Param("id") id: string) {
    return this.service.deactivate(orgId, id);
  }
}

import { Controller, Get } from "@nestjs/common";
import { OrgId } from "../../common/decorators";
import { UsersService } from "./users.service";

@Controller("users")
export class UsersController {
  constructor(private service: UsersService) {}
  @Get() list(@OrgId() orgId: string) { return this.service.list(orgId); }
}

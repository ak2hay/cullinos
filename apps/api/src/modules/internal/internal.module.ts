import { Module } from "@nestjs/common";
import { OrganizationsModule } from "../organizations/organizations.module";
import { InternalController } from "./internal.controller";

@Module({
  imports: [OrganizationsModule],
  controllers: [InternalController],
})
export class InternalModule {}

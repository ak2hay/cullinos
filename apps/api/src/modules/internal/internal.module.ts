import { Module } from "@nestjs/common";
import { MailModule } from "../mail/mail.module";
import { OrganizationsModule } from "../organizations/organizations.module";
import { InternalController } from "./internal.controller";

@Module({
  imports: [OrganizationsModule, MailModule],
  controllers: [InternalController],
})
export class InternalModule {}

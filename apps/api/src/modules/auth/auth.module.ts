import { Module, type DynamicModule } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { APP_GUARD } from "@nestjs/core";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "../../common/jwt-auth.guard";
import { SuperAdminGuard } from "../../common/super-admin.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { EntitlementGuard } from "../../common/entitlement.guard";

const jwtModule = JwtModule.register({
  global: true,
  secret: process.env.JWT_SECRET || "dev-secret",
  signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN || "7d") as "7d" },
}) as DynamicModule;

@Module({
  imports: [jwtModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: SuperAdminGuard },
    { provide: APP_GUARD, useClass: EntitlementGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
  exports: [AuthService],
})
export class AuthModule {}

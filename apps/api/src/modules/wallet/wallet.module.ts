import { Module } from "@nestjs/common";
import { SuperAdminGuard } from "../marketing/guards/super-admin.guard";
import { PlatformConfigModule } from "../platform-config/platform-config.module";
import { RazorpayModule } from "../payments/razorpay.module";
import {
  SuperAdminWalletController,
  WalletController,
} from "./wallet.controller";
import { WalletService } from "./wallet.service";

@Module({
  imports: [PlatformConfigModule, RazorpayModule],
  controllers: [WalletController, SuperAdminWalletController],
  providers: [WalletService, SuperAdminGuard],
  exports: [WalletService],
})
export class WalletModule {}

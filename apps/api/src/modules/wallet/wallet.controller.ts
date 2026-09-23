import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import type { JwtPayload } from "@cullinos/auth";
import { CurrentUser, OrgId, RequireModule } from "../../common/decorators";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { SuperAdminGuard } from "../marketing/guards/super-admin.guard";
import { WalletService } from "./wallet.service";

@Controller("wallet")
export class WalletController {
  constructor(private wallet: WalletService) {}

  @Get()
  @RequirePermissions("settings:read", "org:read")
  getBalance(@OrgId() orgId: string) {
    return this.wallet.getBalance(orgId);
  }

  @Get("ledger")
  @RequirePermissions("settings:read", "org:read")
  ledger(@OrgId() orgId: string, @Query("take") take?: string) {
    return this.wallet.listLedger(orgId, take ? Number(take) : 50);
  }

  @Get("sms-estimate")
  @RequireModule("sms")
  @RequirePermissions("settings:read", "org:read")
  async estimate(@OrgId() orgId: string, @Query("recipients") recipients?: string) {
    const count = Math.max(0, Number(recipients ?? 0) || 0);
    const est = this.wallet.estimateSmsCost(count);
    const bal = await this.wallet.getBalance(orgId);
    return {
      ...est,
      ...bal,
      recipients: count,
      canAfford: est.estimatePaise <= bal.balancePaise,
    };
  }

  @Post("top-up")
  @RequirePermissions("settings:update", "org:manage_settings")
  topUp(@OrgId() orgId: string, @Body("amountRupees") amountRupees: number) {
    return this.wallet.createTopUpOrder(orgId, Number(amountRupees));
  }

  @Post("top-up/confirm")
  @RequirePermissions("settings:update", "org:manage_settings")
  confirm(
    @OrgId() orgId: string,
    @Body()
    body: {
      razorpayOrderId: string;
      razorpayPaymentId: string;
      razorpaySignature: string;
    },
  ) {
    return this.wallet.confirmTopUp(orgId, body);
  }
}

@Controller("super-admin/orgs")
@UseGuards(SuperAdminGuard)
export class SuperAdminWalletController {
  constructor(private wallet: WalletService) {}

  @Get(":orgId/wallet")
  getBalance(@Param("orgId") orgId: string) {
    return this.wallet.getBalance(orgId);
  }

  @Post(":orgId/wallet/adjust")
  adjust(
    @Param("orgId") orgId: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: { amountPaise: number; note: string },
  ) {
    return this.wallet.manualAdjust(
      orgId,
      Number(body.amountPaise),
      body.note ?? "",
      user.sub,
    );
  }
}

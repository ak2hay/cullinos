import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { OrgId, Public, RequireModule } from "../../common/decorators";
import { getJwtSecret } from "../../common/jwt-secret.util";
import { LoyaltyService } from "./loyalty.service";

@Controller("loyalty")
export class LoyaltyController {
  constructor(private service: LoyaltyService) {}

  @Get()
  list(@OrgId() orgId: string) {
    return this.service.list(orgId);
  }

  @Get("settings")
  @RequireModule("loyalty")
  getSettings(@OrgId() orgId: string) {
    return this.service.getSettings(orgId);
  }

  @Patch("settings")
  @RequireModule("loyalty")
  updateSettings(@OrgId() orgId: string, @Body() body: Record<string, unknown>) {
    return this.service.updateSettings(orgId, body as never);
  }

  @Post("tiers")
  @RequireModule("loyalty")
  createTier(@OrgId() orgId: string, @Body() body: Record<string, unknown>) {
    return this.service.createTier(orgId, body as never);
  }

  @Delete("tiers/:id")
  @RequireModule("loyalty")
  deleteTier(@OrgId() orgId: string, @Param("id") id: string) {
    return this.service.deleteTier(orgId, id);
  }

  @Post("customers/:customerId/stamp")
  @RequireModule("loyalty")
  addStamp(@OrgId() orgId: string, @Param("customerId") customerId: string) {
    return this.service.addStamp(orgId, customerId);
  }

  @Post("customers/:customerId/redeem-stamps")
  @RequireModule("loyalty")
  redeemStamps(@OrgId() orgId: string, @Param("customerId") customerId: string) {
    return this.service.redeemStamps(orgId, customerId);
  }

  @Post("customers/:customerId/redeem")
  @RequireModule("loyalty")
  redeemPoints(
    @OrgId() orgId: string,
    @Param("customerId") customerId: string,
    @Body() body: { points?: number; orderId?: string },
  ) {
    return this.service.redeemPoints(
      orgId,
      customerId,
      Number(body.points),
      body.orderId,
    );
  }

  @Get("rewards")
  @RequireModule("loyalty")
  listRewards(@OrgId() orgId: string) {
    return this.service.listRewards(orgId);
  }

  @Post("rewards")
  @RequireModule("loyalty")
  createReward(@OrgId() orgId: string, @Body() body: Record<string, unknown>) {
    return this.service.createReward(orgId, body as never);
  }

  @Patch("rewards/:id")
  @RequireModule("loyalty")
  updateReward(
    @OrgId() orgId: string,
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.service.updateReward(orgId, id, body as never);
  }

  @Delete("rewards/:id")
  @RequireModule("loyalty")
  deleteReward(@OrgId() orgId: string, @Param("id") id: string) {
    return this.service.deleteReward(orgId, id);
  }

  @Post("customers/:customerId/redeem-reward")
  @RequireModule("loyalty")
  redeemReward(
    @OrgId() orgId: string,
    @Param("customerId") customerId: string,
    @Body() body: { rewardId?: string; orderId?: string },
  ) {
    if (!body.rewardId) {
      throw new BadRequestException("rewardId is required");
    }
    return this.service.redeemReward(
      orgId,
      customerId,
      body.rewardId,
      body.orderId,
    );
  }
}

@Controller("public/loyalty")
export class PublicLoyaltyController {
  constructor(
    private service: LoyaltyService,
    private jwt: JwtService,
  ) {}

  private customerIdFromAuth(orgId: string, auth: string | undefined): string {
    if (!auth?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing token");
    }
    try {
      const payload = this.jwt.verify(auth.slice(7), {
        secret: getJwtSecret(),
      }) as { sub: string; type?: string; orgId?: string };
      if (payload.type !== "customer") {
        throw new UnauthorizedException("Not a customer token");
      }
      if (payload.orgId && payload.orgId !== orgId) {
        throw new UnauthorizedException("Organization mismatch");
      }
      return payload.sub;
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException("Invalid token");
    }
  }

  @Public()
  @Get(":orgId/settings")
  getSettings(@Param("orgId") orgId: string) {
    return this.service.getSettings(orgId);
  }

  /** Customer portal wallet (Bearer customer JWT). */
  @Public()
  @Get(":orgId/me")
  getMe(
    @Param("orgId") orgId: string,
    @Headers("authorization") auth: string | undefined,
  ) {
    const customerId = this.customerIdFromAuth(orgId, auth);
    return this.service.getCustomerPortal(orgId, customerId);
  }

  /** Customer-authenticated redeem (Bearer customer JWT). */
  @Public()
  @Post(":orgId/redeem")
  async redeem(
    @Param("orgId") orgId: string,
    @Headers("authorization") auth: string | undefined,
    @Body() body: { points?: number; orderId?: string },
  ) {
    const customerId = this.customerIdFromAuth(orgId, auth);
    return this.service.redeemPoints(
      orgId,
      customerId,
      Number(body.points),
      body.orderId,
    );
  }

  @Public()
  @Get(":orgId/rewards")
  listRewards(@Param("orgId") orgId: string) {
    return this.service.listRewards(orgId, true);
  }

  @Public()
  @Post(":orgId/redeem-reward")
  async redeemReward(
    @Param("orgId") orgId: string,
    @Headers("authorization") auth: string | undefined,
    @Body() body: { rewardId?: string; orderId?: string },
  ) {
    if (!body.rewardId) {
      throw new BadRequestException("rewardId is required");
    }
    const customerId = this.customerIdFromAuth(orgId, auth);
    return this.service.redeemReward(
      orgId,
      customerId,
      body.rewardId,
      body.orderId,
    );
  }
}

import { Body, Controller, Headers, HttpCode, Param, Post, UnauthorizedException } from "@nestjs/common";
import { Public } from "../../common/decorators";
import { UrbanPiperService } from "./urbanpiper.service";

/**
 * UrbanPiper callbacks. Configure each URL in UrbanPiper with the custom header
 * `x-aggregator-secret: <secret shown in Admin → Aggregators>`.
 */
@Controller("aggregators/webhooks/urbanpiper")
export class UrbanPiperWebhookController {
  constructor(private service: UrbanPiperService) {}

  private requireSecret(secret: string | undefined) {
    if (!secret) throw new UnauthorizedException("Missing x-aggregator-secret header");
    return secret;
  }

  @Public()
  @Post(":orgId/orders")
  @HttpCode(200)
  orders(
    @Param("orgId") orgId: string,
    @Headers("x-aggregator-secret") secret: string | undefined,
    @Body() body: unknown,
  ) {
    return this.service.ingestOrder(orgId, this.requireSecret(secret), body);
  }

  @Public()
  @Post(":orgId/status")
  @HttpCode(200)
  status(
    @Param("orgId") orgId: string,
    @Headers("x-aggregator-secret") secret: string | undefined,
    @Body() body: unknown,
  ) {
    return this.service.ingestStatus(orgId, this.requireSecret(secret), body);
  }

  @Public()
  @Post(":orgId/rider")
  @HttpCode(200)
  rider(
    @Param("orgId") orgId: string,
    @Headers("x-aggregator-secret") secret: string | undefined,
    @Body() body: unknown,
  ) {
    return this.service.ingestRider(orgId, this.requireSecret(secret), body);
  }
}

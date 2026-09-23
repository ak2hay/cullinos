import {
  Body,
  Controller,
  Headers,
  Param,
  Post,
  Query,
  UnauthorizedException,
} from "@nestjs/common";
import type { AggregatorProvider } from "@cullinos/integrations";
import { Public } from "../../common/decorators";
import { AggregatorsService } from "./aggregators.service";

@Controller("aggregators/webhooks")
export class AggregatorsWebhookController {
  constructor(private service: AggregatorsService) {}

  @Public()
  @Post(":provider/:orgId")
  ingest(
    @Param("provider") provider: AggregatorProvider,
    @Param("orgId") orgId: string,
    @Headers("x-aggregator-secret") secret: string | undefined,
    @Body() body: unknown,
    @Query("outletId") outletId?: string,
  ) {
    if (!secret) {
      throw new UnauthorizedException("Missing x-aggregator-secret header");
    }
    return this.service.ingestWebhook(orgId, provider, secret, body, outletId);
  }
}

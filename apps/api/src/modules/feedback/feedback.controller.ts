import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Query,
  Res,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Response } from "express";
import { OrgId, Public, RequireModule } from "../../common/decorators";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { FeedbackService } from "./feedback.service";

@Controller("feedback")
@RequirePermissions("reports:read", "customer:update")
export class FeedbackController {
  constructor(private service: FeedbackService) {}

  @Get()
  @RequireModule("orders")
  list(
    @OrgId() orgId: string,
    @Query("outletId") outletId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.service.list(orgId, { outletId, from, to });
  }

  @Get("summary")
  @RequireModule("orders")
  summary(
    @OrgId() orgId: string,
    @Query("outletId") outletId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.service.summary(orgId, { outletId, from, to });
  }

  @Post("orders/:orderId/survey-link")
  @RequireModule("orders")
  @RequirePermissions("order:update", "pos:access")
  async surveyLink(@OrgId() orgId: string, @Param("orderId") orderId: string) {
    const row = await this.service.ensureSurveyToken(orgId, orderId);
    return {
      ...row,
      url: this.service.getSurveyLink(row.surveyToken),
    };
  }
}

@Controller("public/feedback")
export class PublicFeedbackController {
  constructor(private service: FeedbackService) {}

  @Public()
  @Get(":token/page")
  @Header("Cache-Control", "no-store")
  async surveyPage(@Param("token") token: string, @Res() res: Response) {
    const html = await this.service.renderSurveyPageHtml(token);
    res.type("html").send(html);
  }

  @Public()
  @Get(":token")
  getSurvey(@Param("token") token: string) {
    return this.service.getSurveyByToken(token);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post(":token")
  submit(
    @Param("token") token: string,
    @Body() body: { rating: number; comment?: string },
  ) {
    return this.service.submitSurvey(token, body.rating, body.comment);
  }
}

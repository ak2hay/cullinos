import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { OrgId, Public, RequireModule } from "../../common/decorators";
import { FeedbackService } from "./feedback.service";

@Controller("feedback")
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
  @Get(":token")
  getSurvey(@Param("token") token: string) {
    return this.service.getSurveyByToken(token);
  }

  @Public()
  @Post(":token")
  submit(
    @Param("token") token: string,
    @Body() body: { rating: number; comment?: string },
  ) {
    return this.service.submitSurvey(token, body.rating, body.comment);
  }
}

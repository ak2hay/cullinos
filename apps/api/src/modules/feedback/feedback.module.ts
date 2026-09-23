import { Module } from "@nestjs/common";
import {
  FeedbackController,
  PublicFeedbackController,
} from "./feedback.controller";
import { FeedbackService } from "./feedback.service";

@Module({
  controllers: [FeedbackController, PublicFeedbackController],
  providers: [FeedbackService],
  exports: [FeedbackService],
})
export class FeedbackModule {}

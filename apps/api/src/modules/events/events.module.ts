import { Module } from "@nestjs/common";
import { EventsController, PublicEventsController } from "./events.controller";
import { EventsService } from "./events.service";

@Module({
  controllers: [EventsController, PublicEventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}

import { Module } from '@nestjs/common';
import { KotController } from './kot.controller';
import { KotService } from './kot.service';

@Module({
  controllers: [KotController],
  providers: [KotService],
  exports: [KotService],
})
export class KotModule {}

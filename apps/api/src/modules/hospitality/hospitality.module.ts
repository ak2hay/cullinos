import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { HospitalityController } from './hospitality.controller';
import { HospitalityService } from './hospitality.service';

@Module({
  imports: [AuditModule],
  controllers: [HospitalityController],
  providers: [HospitalityService],
  exports: [HospitalityService],
})
export class HospitalityModule {}

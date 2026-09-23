import { Module, forwardRef } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrivacyModule } from '../privacy/privacy.module';
import { HospitalityController } from './hospitality.controller';
import { HospitalityService } from './hospitality.service';

@Module({
  imports: [AuditModule, forwardRef(() => PrivacyModule)],
  controllers: [HospitalityController],
  providers: [HospitalityService],
  exports: [HospitalityService],
})
export class HospitalityModule {}

import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { HealthService } from './health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'API health check' })
  check() {
    return this.healthService.check();
  }

  @Get('db')
  @ApiOperation({ summary: 'Database health check' })
  checkDatabase() {
    return this.healthService.checkDatabase();
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'cullinos-api',
    };
  }

  async checkDatabase() {
    const start = Date.now();
    await this.prisma.client.$queryRaw`SELECT 1`;
    return {
      status: 'ok',
      database: 'connected',
      latencyMs: Date.now() - start,
      timestamp: new Date().toISOString(),
    };
  }
}

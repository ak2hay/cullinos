import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { toInputJson } from '../../common/utils/prisma-json';
import { CreateInsightDto, ListInsightsQueryDto } from './dto/insights.dto';

@Injectable()
export class InsightsService {
  constructor(private prisma: PrismaService) {}

  async list(organizationId: string, query: ListInsightsQueryDto) {
    const page = query.page ? parseInt(query.page, 10) : 1;
    const limit = query.limit ? parseInt(query.limit, 10) : 20;
    const skip = (page - 1) * limit;

    const where = {
      organizationId,
      ...(query.type ? { type: query.type } : {}),
      ...(query.outletId ? { outletId: query.outletId } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.client.insight.findMany({
        where,
        skip,
        take: limit,
        orderBy: { generatedAt: 'desc' },
      }),
      this.prisma.client.insight.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, hasMore: skip + data.length < total },
    };
  }

  async create(organizationId: string, dto: CreateInsightDto) {
    return this.prisma.client.insight.create({
      data: {
        organizationId,
        outletId: dto.outletId,
        type: dto.type,
        summary: dto.summary,
        dataSnapshot: toInputJson(dto.dataSnapshot ?? {}) ?? {},
      },
    });
  }
}

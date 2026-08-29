import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class InsightsService {
  constructor(private prisma: PrismaService) {}

  list(_orgId: string) {
    return this.prisma.insightsSnapshot.findMany({ take: 200 });
  }
}

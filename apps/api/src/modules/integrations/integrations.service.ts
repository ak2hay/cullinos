import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

export interface RegisterIntegrationInput {
  provider: string;
  config: Record<string, unknown>;
  isActive?: boolean;
}

@Injectable()
export class IntegrationsService {
  constructor(private prisma: PrismaService) {}

  list(orgId: string) {
    return this.prisma.integration.findMany({
      where: { organizationId: orgId },
      orderBy: { provider: "asc" },
      take: 200,
    });
  }

  register(orgId: string, input: RegisterIntegrationInput) {
    return this.prisma.integration.create({
      data: {
        organizationId: orgId,
        provider: input.provider,
        config: input.config as Prisma.InputJsonValue,
        isActive: input.isActive ?? true,
      },
    });
  }
}

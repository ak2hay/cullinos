import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { PAYMENT_GATEWAY_PROVIDERS } from "../payments/payment-gateway.types";

export interface RegisterIntegrationInput {
  provider: string;
  config: Record<string, unknown>;
  isActive?: boolean;
}

/** Providers with dedicated, encrypted configuration flows — never writable here. */
const RESERVED_PROVIDERS = new Set<string>([
  ...PAYMENT_GATEWAY_PROVIDERS,
  "swiggy",
  "zomato",
]);

type IntegrationRow = {
  id: string;
  provider: string;
  isActive: boolean;
  config: Prisma.JsonValue;
};

function toPublic(row: IntegrationRow) {
  const cfg =
    row.config && typeof row.config === "object" && !Array.isArray(row.config)
      ? (row.config as Record<string, unknown>)
      : {};
  return {
    id: row.id,
    provider: row.provider,
    isActive: row.isActive,
    configKeys: Object.keys(cfg).sort(),
  };
}

@Injectable()
export class IntegrationsService {
  constructor(private prisma: PrismaService) {}

  async list(orgId: string) {
    const rows = await this.prisma.integration.findMany({
      where: { organizationId: orgId },
      orderBy: { provider: "asc" },
      take: 200,
    });
    return rows.map(toPublic);
  }

  async register(orgId: string, input: RegisterIntegrationInput) {
    const provider = input.provider?.trim().toLowerCase();
    if (!provider || !/^[a-z0-9_-]{2,40}$/.test(provider)) {
      throw new BadRequestException("Invalid provider");
    }
    if (RESERVED_PROVIDERS.has(provider)) {
      throw new BadRequestException(
        "This provider must be configured from its dedicated settings screen",
      );
    }
    const row = await this.prisma.integration.create({
      data: {
        organizationId: orgId,
        provider,
        config: input.config as Prisma.InputJsonValue,
        isActive: input.isActive ?? true,
      },
    });
    return toPublic(row);
  }
}

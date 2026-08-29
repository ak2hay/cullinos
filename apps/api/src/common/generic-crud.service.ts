import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

type ModelDelegate = {
  findMany: (args?: unknown) => Promise<unknown[]>;
};

@Injectable()
export class GenericCrudService {
  constructor(private prisma: PrismaService) {}

  list(model: string, orgId: string, extraWhere?: Record<string, unknown>) {
    const delegate = (this.prisma as unknown as Record<string, ModelDelegate>)[model];
    if (!delegate?.findMany) return [];
    return delegate.findMany({
      where: { organizationId: orgId, ...extraWhere },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }
}

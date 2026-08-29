import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class RecipesService {
  constructor(private prisma: PrismaService) {}

  list(orgId: string) {
    return this.prisma.recipe.findMany({
      where: { menuItem: { organizationId: orgId } },
      include: { ingredients: true },
      take: 200,
    });
  }
}

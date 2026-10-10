import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { AggregatorsService } from "./aggregators.service";

describe("AggregatorsService.syncMenu", () => {
  it("rejects outbound sync instead of reporting a successful stub", async () => {
    const prisma = {
      integration: {
        findFirst: vi.fn().mockResolvedValue({
          isActive: true,
          config: {
            outlets: {
              out_1: { connected: true, menuSyncEnabled: true },
            },
          },
        }),
      },
      menuItem: { findMany: vi.fn() },
    };
    const service = new AggregatorsService(prisma as never, {} as never);

    await expect(service.syncMenu("org_1", "swiggy", "out_1")).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.syncMenu("org_1", "zomato", "out_1")).rejects.toThrow(
      /not available/,
    );
    expect(prisma.menuItem.findMany).not.toHaveBeenCalled();
  });
});

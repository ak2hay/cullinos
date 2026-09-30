import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { TablesService } from "./tables.service";

function makeService(overrides: {
  scopedFloor?: { id: string; outletId: string; name: string } | null;
  clash?: { id: string } | null;
  tableCount?: number;
}) {
  const floorFindFirst = vi.fn(async (args: { where: Record<string, unknown> }) => {
    if ("name" in args.where) return overrides.clash ?? null;
    return overrides.scopedFloor ?? null;
  });
  const prisma = {
    outlet: { findFirst: vi.fn(async () => ({ id: "out_1" })) },
    floor: {
      findFirst: floorFindFirst,
      findMany: vi.fn(async () => []),
      update: vi.fn(async () => ({})),
      delete: vi.fn(async () => ({})),
    },
    table: { count: vi.fn(async () => overrides.tableCount ?? 0) },
  };
  const service = new TablesService(prisma as never, {} as never);
  return { service, prisma, floorFindFirst };
}

const floor = { id: "fl_1", outletId: "out_1", name: "Ground" };

describe("TablesService floors", () => {
  it("scopes floor lookups by outlet and organization", async () => {
    const { service, floorFindFirst } = makeService({ scopedFloor: floor });
    await service.deleteFloor("org_1", "out_1", "fl_1");
    expect(floorFindFirst).toHaveBeenCalledWith({
      where: { id: "fl_1", outletId: "out_1", outlet: { organizationId: "org_1" } },
    });
  });

  it("returns 404 for a floor in another organization", async () => {
    const { service, prisma } = makeService({ scopedFloor: null });
    await expect(service.deleteFloor("org_2", "out_1", "fl_1")).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.floor.delete).not.toHaveBeenCalled();
  });

  it("refuses to delete a floor that still has tables", async () => {
    const { service, prisma } = makeService({ scopedFloor: floor, tableCount: 3 });
    await expect(service.deleteFloor("org_1", "out_1", "fl_1")).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.floor.delete).not.toHaveBeenCalled();
  });

  it("deletes an empty floor", async () => {
    const { service, prisma } = makeService({ scopedFloor: floor, tableCount: 0 });
    await expect(service.deleteFloor("org_1", "out_1", "fl_1")).resolves.toEqual({
      id: "fl_1",
      deleted: true,
    });
    expect(prisma.floor.delete).toHaveBeenCalledWith({ where: { id: "fl_1" } });
  });

  it("rejects renaming to a duplicate floor name", async () => {
    const { service, prisma } = makeService({ scopedFloor: floor, clash: { id: "fl_2" } });
    await expect(
      service.updateFloor("org_1", "out_1", "fl_1", { name: "first" }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.floor.update).not.toHaveBeenCalled();
  });

  it("rejects a blank floor name", async () => {
    const { service } = makeService({ scopedFloor: floor });
    await expect(
      service.updateFloor("org_1", "out_1", "fl_1", { name: "   " }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("renames a floor", async () => {
    const { service, prisma } = makeService({ scopedFloor: floor });
    await service.updateFloor("org_1", "out_1", "fl_1", { name: " First " });
    expect(prisma.floor.update).toHaveBeenCalledWith({
      where: { id: "fl_1" },
      data: { name: "First" },
    });
  });
});

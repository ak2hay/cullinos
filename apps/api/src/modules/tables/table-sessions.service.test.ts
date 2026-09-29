import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { TableSessionsService } from "./table-sessions.service";

const ORG = "org_1";
const OUTLET = "outlet_1";

type FakeOrder = {
  id: string;
  orderNumber: string;
  organizationId: string;
  outletId: string;
  tableId: string | null;
  tableSessionId: string | null;
  status: string;
  notes?: string | null;
  createdAt: Date;
  items: Array<Record<string, unknown>>;
};

type FakeSession = {
  id: string;
  tableId: string;
  status: string;
  sessionToken: string;
  guestCount: number | null;
  startedAt: Date;
  endedAt?: Date | null;
};

function makeItem(name: string) {
  return {
    menuItemId: `mi_${name}`,
    variantId: null,
    name,
    quantity: 1,
    unitPrice: 100,
    notes: null,
    modifiers: null,
  };
}

function makeOrder(overrides: Partial<FakeOrder> & { id: string; tableId: string }): FakeOrder {
  return {
    orderNumber: overrides.id.toUpperCase(),
    organizationId: ORG,
    outletId: OUTLET,
    tableSessionId: null,
    status: "confirmed",
    createdAt: new Date("2026-09-27T10:00:00Z"),
    items: [makeItem(`${overrides.id}_item`)],
    ...overrides,
  };
}

type FakeTable = {
  id: string;
  name: string;
  status: string;
  mergedIntoTableId: string | null;
};

function makeHarness(
  input: {
    orders?: FakeOrder[];
    sessions?: FakeSession[];
    /** child table id -> primary table id */
    merged?: Record<string, string>;
  } = {},
) {
  const orders = input.orders ?? [];
  const sessions = input.sessions ?? [];
  const tables = new Map<string, FakeTable>(
    ["T1", "T2", "T3", "T4"].map((id) => [
      id,
      { id, name: id, status: "available", mergedIntoTableId: null },
    ]),
  );
  for (const o of orders) {
    if (o.tableId) tables.get(o.tableId)!.status = "occupied";
  }
  for (const s of sessions) tables.get(s.tableId)!.status = "occupied";
  for (const [child, primary] of Object.entries(input.merged ?? {})) {
    Object.assign(tables.get(child)!, { status: "occupied", mergedIntoTableId: primary });
    tables.get(primary)!.status = "occupied";
  }
  const matchesIn = (id: string, where: { id?: { in: string[] }; mergedIntoTableId?: string }) =>
    (where.id ? where.id.in.includes(id) : true) &&
    (where.mergedIntoTableId !== undefined
      ? tables.get(id)!.mergedIntoTableId === where.mergedIntoTableId
      : true);

  const withOrder = (s: FakeSession) => ({
    ...s,
    order: orders.find((o) => o.tableSessionId === s.id) ?? null,
  });

  const openOrderFor = (o: FakeOrder, where: { tableSessionId?: string; tableId?: string }) =>
    (where.tableSessionId !== undefined && o.tableSessionId === where.tableSessionId) ||
    (where.tableId !== undefined && o.tableId === where.tableId);

  const prisma = {
    table: {
      findFirst: vi.fn(async ({ where }: { where: { id: string } }) => {
        const t = tables.get(where.id);
        if (!t) return null;
        const primary = t.mergedIntoTableId ? tables.get(t.mergedIntoTableId) : null;
        return {
          ...t,
          mergedInto: primary ? { id: primary.id, name: primary.name } : null,
          section: {
            floor: { outlet: { slug: "main", organization: { slug: "org" } } },
          },
        };
      }),
      findMany: vi.fn(
        async ({ where }: { where: { id?: { in: string[] }; mergedIntoTableId?: string } }) =>
          [...tables.values()].filter((t) => matchesIn(t.id, where)).map((t) => ({ id: t.id })),
      ),
      update: vi.fn(
        async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          const t = tables.get(where.id)!;
          Object.assign(t, data);
          return t;
        },
      ),
      updateMany: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { id?: { in: string[] }; mergedIntoTableId?: string };
          data: Partial<FakeTable>;
        }) => {
          const hits = [...tables.values()].filter((t) => matchesIn(t.id, where));
          hits.forEach((t) => Object.assign(t, data));
          return { count: hits.length };
        },
      ),
    },
    tableSession: {
      findFirst: vi.fn(async ({ where }: { where: { tableId: string; status: string } }) => {
        const s = sessions.find((x) => x.tableId === where.tableId && x.status === where.status);
        return s ? withOrder(s) : null;
      }),
      update: vi.fn(
        async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          const s = sessions.find((x) => x.id === where.id)!;
          Object.assign(s, data);
          return withOrder(s);
        },
      ),
      updateMany: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { tableId: { in: string[] }; status: string };
          data: Partial<FakeSession>;
        }) => {
          const hits = sessions.filter(
            (s) => where.tableId.in.includes(s.tableId) && s.status === where.status,
          );
          hits.forEach((s) => Object.assign(s, data));
          return { count: hits.length };
        },
      ),
      create: vi.fn(async ({ data }: { data: Partial<FakeSession> & { tableId: string } }) => {
        const s: FakeSession = {
          id: `S${sessions.length + 1}`,
          status: "active",
          sessionToken: "tok",
          guestCount: null,
          startedAt: new Date(),
          ...data,
        };
        sessions.push(s);
        return withOrder(s);
      }),
    },
    order: {
      count: vi.fn(
        async ({
          where,
        }: {
          where: {
            organizationId: string;
            OR: Array<{ tableSessionId?: string; tableId?: string }>;
            status: { notIn: string[] };
          };
        }) =>
          orders.filter(
            (o) =>
              o.organizationId === where.organizationId &&
              !where.status.notIn.includes(o.status) &&
              where.OR.some((w) => openOrderFor(o, w)),
          ).length,
      ),
      findMany: vi.fn(
        async ({
          where,
        }: {
          where: {
            tableId: string;
            organizationId: string;
            outletId: string;
            status: { notIn: string[] };
          };
        }) =>
          orders
            .filter(
              (o) =>
                o.tableId === where.tableId &&
                o.organizationId === where.organizationId &&
                o.outletId === where.outletId &&
                !where.status.notIn.includes(o.status),
            )
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
      ),
      findFirst: vi.fn(
        async ({ where }: { where: { id: string; organizationId: string } }) =>
          orders.find((o) => o.id === where.id && o.organizationId === where.organizationId) ??
          null,
      ),
      update: vi.fn(
        async ({ where, data }: { where: { id: string }; data: Partial<FakeOrder> }) => {
          const o = orders.find((x) => x.id === where.id)!;
          if (
            data.tableSessionId &&
            orders.some((x) => x.id !== o.id && x.tableSessionId === data.tableSessionId)
          ) {
            throw new Error("Unique constraint failed on tableSessionId");
          }
          Object.assign(o, data);
          return o;
        },
      ),
      updateMany: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { id: { in: string[] }; organizationId: string };
          data: Partial<FakeOrder>;
        }) => {
          const hits = orders.filter(
            (o) => where.id.in.includes(o.id) && o.organizationId === where.organizationId,
          );
          hits.forEach((o) => Object.assign(o, data));
          return { count: hits.length };
        },
      ),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(prisma)),
  };

  const ws = { emitToOutlet: vi.fn() };
  const ordersService = {
    addItems: vi.fn(async (_orgId: string, orderId: string, items: Array<Record<string, unknown>>) => {
      const o = orders.find((x) => x.id === orderId)!;
      o.items.push(...items);
      return o;
    }),
    absorbOrder: vi.fn(async (_orgId: string, sourceId: string, targetId: string) => {
      const source = orders.find((x) => x.id === sourceId)!;
      const target = orders.find((x) => x.id === targetId)!;
      target.items.push(...source.items);
      source.items = [];
      Object.assign(source, {
        status: "cancelled",
        notes: `Merged into ${target.orderNumber}`,
        tableSessionId: null,
      });
      return target;
    }),
    releaseStock: vi.fn(async () => false),
  };

  const service = new TableSessionsService(prisma as never, ws as never, ordersService as never);
  return { service, prisma, tables, orders, sessions, ordersService };
}

describe("TableSessionsService.transferTable", () => {
  it("moves a POS order that has no table session", async () => {
    const h = makeHarness({ orders: [makeOrder({ id: "o1", tableId: "T1" })] });

    await h.service.transferTable(ORG, OUTLET, "T1", "T2");

    expect(h.orders[0].tableId).toBe("T2");
    expect(h.tables.get("T1")!.status).toBe("available");
    expect(h.tables.get("T2")!.status).toBe("occupied");
  });

  it("moves the active session together with its order", async () => {
    const h = makeHarness({
      sessions: [
        { id: "S1", tableId: "T1", status: "active", sessionToken: "t", guestCount: 2, startedAt: new Date() },
      ],
      orders: [makeOrder({ id: "o1", tableId: "T1", tableSessionId: "S1" })],
    });

    const result = await h.service.transferTable(ORG, OUTLET, "T1", "T2");

    expect(h.sessions[0].tableId).toBe("T2");
    expect(h.orders[0].tableId).toBe("T2");
    expect(result?.tableId).toBe("T2");
  });

  it("rejects when the target table has an open order", async () => {
    const h = makeHarness({
      orders: [makeOrder({ id: "o1", tableId: "T1" }), makeOrder({ id: "o2", tableId: "T2" })],
    });

    await expect(h.service.transferTable(ORG, OUTLET, "T1", "T2")).rejects.toThrow(
      "Target table already has an open order",
    );
    expect(h.orders[0].tableId).toBe("T1");
  });

  it("rejects when the source table has nothing to transfer", async () => {
    const h = makeHarness();

    await expect(h.service.transferTable(ORG, OUTLET, "T1", "T2")).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

describe("TableSessionsService.mergeTables", () => {
  it("merges two POS-only tables into an empty primary without a unique clash", async () => {
    const h = makeHarness({
      orders: [makeOrder({ id: "o2", tableId: "T2" }), makeOrder({ id: "o3", tableId: "T3" })],
    });

    await h.service.mergeTables(ORG, OUTLET, "T1", ["T2", "T3"]);

    const o2 = h.orders.find((o) => o.id === "o2")!;
    const o3 = h.orders.find((o) => o.id === "o3")!;
    expect(o2.tableId).toBe("T1");
    expect(o2.tableSessionId).toBe(h.sessions[0].id);
    expect(o2.items).toHaveLength(2);
    expect(o3.status).toBe("cancelled");
    expect(o3.notes).toBe("Merged into O2");
    expect(h.ordersService.absorbOrder).toHaveBeenCalledWith(ORG, "o3", "o2");
    expect(h.tables.get("T1")!.status).toBe("occupied");
    expect(h.tables.get("T2")).toMatchObject({ status: "occupied", mergedIntoTableId: "T1" });
    expect(h.tables.get("T3")).toMatchObject({ status: "occupied", mergedIntoTableId: "T1" });
  });

  it("merges a secondary order into the primary's existing POS order", async () => {
    const h = makeHarness({
      orders: [makeOrder({ id: "o1", tableId: "T1" }), makeOrder({ id: "o2", tableId: "T2" })],
    });

    await h.service.mergeTables(ORG, OUTLET, "T1", ["T1", "T2"]);

    expect(h.orders.find((o) => o.id === "o1")!.items).toHaveLength(2);
    expect(h.orders.find((o) => o.id === "o2")!.status).toBe("cancelled");
    expect(h.sessions).toHaveLength(0);
  });

  it("links an empty secondary to the primary for a large group", async () => {
    const h = makeHarness({ orders: [makeOrder({ id: "o1", tableId: "T1" })] });

    await h.service.mergeTables(ORG, OUTLET, "T1", ["T2"]);

    expect(h.tables.get("T2")).toMatchObject({ status: "occupied", mergedIntoTableId: "T1" });
    expect(h.tables.get("T1")!.status).toBe("occupied");
    expect(h.ordersService.absorbOrder).not.toHaveBeenCalled();
  });

  it("rejects a secondary already merged with another table", async () => {
    const h = makeHarness({ merged: { T2: "T3" } });

    await expect(h.service.mergeTables(ORG, OUTLET, "T1", ["T2"])).rejects.toThrow(
      "T2 is already merged with T3",
    );
    expect(h.tables.get("T2")!.mergedIntoTableId).toBe("T3");
  });

  it("rejects a merged table as the primary", async () => {
    const h = makeHarness({ merged: { T2: "T3" } });

    await expect(h.service.mergeTables(ORG, OUTLET, "T2", ["T1"])).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("moves a secondary's own merged tables onto the new primary", async () => {
    const h = makeHarness({
      orders: [makeOrder({ id: "o1", tableId: "T1" })],
      merged: { T3: "T2" },
    });

    await h.service.mergeTables(ORG, OUTLET, "T1", ["T2"]);

    expect(h.tables.get("T2")!.mergedIntoTableId).toBe("T1");
    expect(h.tables.get("T3")!.mergedIntoTableId).toBe("T1");
  });
});

describe("TableSessionsService merged table lifecycle", () => {
  it("closing the primary session releases its merged tables", async () => {
    const h = makeHarness({
      sessions: [
        { id: "S1", tableId: "T1", status: "active", sessionToken: "t", guestCount: 2, startedAt: new Date() },
      ],
      merged: { T2: "T1", T3: "T1" },
    });

    await h.service.closeSession(ORG, OUTLET, "T1", "S1");

    for (const id of ["T1", "T2", "T3"]) {
      expect(h.tables.get(id)).toMatchObject({ status: "available", mergedIntoTableId: null });
    }
  });

  it("transfer moves the merged group to the new table", async () => {
    const h = makeHarness({
      orders: [makeOrder({ id: "o1", tableId: "T1" })],
      merged: { T2: "T1" },
    });

    await h.service.transferTable(ORG, OUTLET, "T1", "T4");

    expect(h.tables.get("T1")!.status).toBe("available");
    expect(h.tables.get("T4")!.status).toBe("occupied");
    expect(h.tables.get("T2")).toMatchObject({ status: "occupied", mergedIntoTableId: "T4" });
  });

  it("transfer rejects a merged secondary as the source", async () => {
    const h = makeHarness({
      orders: [makeOrder({ id: "o1", tableId: "T1" })],
      merged: { T2: "T1" },
    });

    await expect(h.service.transferTable(ORG, OUTLET, "T2", "T4")).rejects.toThrow(
      "T2 is merged with T1",
    );
  });

  it("transfer rejects a target that is not free", async () => {
    const h = makeHarness({
      orders: [makeOrder({ id: "o1", tableId: "T1" })],
      merged: { T3: "T1" },
    });

    await expect(h.service.transferTable(ORG, OUTLET, "T1", "T3")).rejects.toThrow(
      "T3 is merged with another table",
    );
  });

  it("starting a session on a merged table points staff to the primary", async () => {
    const h = makeHarness({ merged: { T2: "T1" } });

    await expect(h.service.startSession(ORG, OUTLET, "T2")).rejects.toThrow(
      "T2 is merged with T1",
    );
  });

  it("unmerge frees a single merged table", async () => {
    const h = makeHarness({ merged: { T2: "T1", T3: "T1" } });

    await h.service.unmergeTable(ORG, OUTLET, "T2");

    expect(h.tables.get("T2")).toMatchObject({ status: "available", mergedIntoTableId: null });
    expect(h.tables.get("T3")!.mergedIntoTableId).toBe("T1");
    expect(h.tables.get("T1")!.status).toBe("occupied");
  });
});

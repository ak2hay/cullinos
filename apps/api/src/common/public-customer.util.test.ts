import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { phoneSearchTerm } from "../modules/customers/customers.service";
import { findOrCreateCustomerByPhone, resolvePublicCustomerByPhone } from "./public-customer.util";

type Row = { id: string; organizationId: string; phone: string; anonymizedAt: Date | null };

function makePrisma(rows: Row[]) {
  return {
    customer: {
      findFirst: vi.fn(async ({ where }: { where: { organizationId: string; phone: { in: string[] } } }) =>
        rows.find((r) => r.organizationId === where.organizationId && where.phone.in.includes(r.phone)) ?? null,
      ),
      create: vi.fn(async ({ data }: { data: { organizationId: string; phone: string } }) => {
        const row = { id: `cust_${rows.length + 1}`, organizationId: data.organizationId, phone: data.phone, anonymizedAt: null };
        rows.push(row);
        return { id: row.id };
      }),
    },
  };
}

describe("resolvePublicCustomerByPhone", () => {
  it("creates a customer on the first QR order and reuses it on the next", async () => {
    const rows: Row[] = [];
    const prisma = makePrisma(rows);

    const first = await resolvePublicCustomerByPhone(prisma as never, "org_1", "98765 43210", "Asha");
    const second = await resolvePublicCustomerByPhone(prisma as never, "org_1", "+91-98765-43210", "A");

    expect(first).toBe("cust_1");
    expect(second).toBe("cust_1");
    expect(prisma.customer.create).toHaveBeenCalledTimes(1);
    expect(rows[0].phone).toBe("+919876543210");
  });

  it("never matches a customer from another organization", async () => {
    const rows: Row[] = [
      { id: "other", organizationId: "org_2", phone: "+919876543210", anonymizedAt: null },
    ];
    const prisma = makePrisma(rows);

    const id = await resolvePublicCustomerByPhone(prisma as never, "org_1", "9876543210", "Asha");

    expect(id).not.toBe("other");
    expect(prisma.customer.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ organizationId: "org_1" }) }),
    );
  });

  it("ignores invalid phones and erased customers", async () => {
    const prisma = makePrisma([
      { id: "erased", organizationId: "org_1", phone: "+919876543210", anonymizedAt: new Date() },
    ]);
    expect(await resolvePublicCustomerByPhone(prisma as never, "org_1", "123", "x")).toBeUndefined();
    expect(await resolvePublicCustomerByPhone(prisma as never, "org_1", undefined, "x")).toBeUndefined();
    expect(await resolvePublicCustomerByPhone(prisma as never, "org_1", "9876543210", "x")).toBeUndefined();
    expect(prisma.customer.create).not.toHaveBeenCalled();
  });

  it("recovers from a concurrent create on the same phone", async () => {
    const rows: Row[] = [];
    const prisma = makePrisma(rows);
    prisma.customer.create.mockImplementationOnce(async () => {
      rows.push({ id: "raced", organizationId: "org_1", phone: "+919876543210", anonymizedAt: null });
      throw new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "test" });
    });

    expect(await resolvePublicCustomerByPhone(prisma as never, "org_1", "9876543210", "x")).toBe("raced");
  });
});

describe("findOrCreateCustomerByPhone", () => {
  it.each(["917057026024", "7057026024", "+917057026024"])(
    "reuses a customer stored as %s instead of creating a duplicate",
    async (stored) => {
      const prisma = makePrisma([
        { id: "legacy", organizationId: "org_1", phone: stored, anonymizedAt: null },
      ]);
      for (const input of ["+91 70570 26024", "917057026024", "7057026024"]) {
        const result = await findOrCreateCustomerByPhone(prisma as never, "org_1", input);
        expect(result?.customer.id).toBe("legacy");
        expect(result?.created).toBe(false);
      }
      expect(prisma.customer.create).not.toHaveBeenCalled();
    },
  );

  it("stores E.164 and names new guests by the normalized number", async () => {
    const rows: Row[] = [];
    const prisma = makePrisma(rows);
    await findOrCreateCustomerByPhone(prisma as never, "org_1", "917057026024");
    expect(prisma.customer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ phone: "+917057026024", name: "Guest 6024" }),
      }),
    );
  });
});

describe("phoneSearchTerm", () => {
  it("strips formatting from phone-like queries", () => {
    expect(phoneSearchTerm("98765 43210")).toBe("9876543210");
    expect(phoneSearchTerm("+91-98765-43210")).toBe("9876543210");
    expect(phoneSearchTerm("Asha")).toBe("Asha");
  });
});

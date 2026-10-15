import { ConflictException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { CustomersService } from "./customers.service";

type Row = {
  id: string;
  organizationId: string;
  name: string;
  phone: string | null;
  email: string | null;
  anonymizedAt: Date | null;
};

function makeService(rows: Row[]) {
  const prisma = {
    customer: {
      findFirst: vi.fn(async ({ where }: { where: { organizationId: string; phone: { in: string[] } } }) =>
        rows.find((r) => r.organizationId === where.organizationId && r.phone && where.phone.in.includes(r.phone)) ??
        null,
      ),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => rows.find((r) => r.id === where.id) ?? null),
      findUniqueOrThrow: vi.fn(async ({ where }: { where: { id: string } }) => rows.find((r) => r.id === where.id)!),
      create: vi.fn(async ({ data }: { data: Omit<Row, "id" | "anonymizedAt"> }) => {
        const row = { ...data, id: `cust_${rows.length + 1}`, anonymizedAt: null };
        rows.push(row);
        return row;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<Row> }) => {
        const row = rows.find((r) => r.id === where.id)!;
        Object.assign(row, data);
        return row;
      }),
    },
  };
  const audit = { log: vi.fn() };
  const consent = { record: vi.fn() };
  const privacy = { setMarketingEmailOptIn: vi.fn(), setMarketingSmsOptIn: vi.fn() };
  const service = new CustomersService(prisma as never, audit as never, consent as never, privacy as never);
  return { service, prisma, audit, consent, privacy };
}

const legacy = (over: Partial<Row> = {}): Row => ({
  id: "legacy",
  organizationId: "org_1",
  name: "Guest 9403",
  phone: "919876549403",
  email: null,
  anonymizedAt: null,
  ...over,
});

describe("CustomersService.create with an existing phone", () => {
  it("folds into the existing customer instead of creating a duplicate", async () => {
    const rows = [legacy()];
    const { service, prisma, audit, privacy } = makeService(rows);

    const res = await service.create(
      "org_1",
      { name: "Asha", phone: "98765 49403", email: "asha@example.com", marketingEmailOptIn: true },
      "staff_1",
    );

    expect(res).toMatchObject({ id: "legacy", name: "Asha", email: "asha@example.com", merged: true });
    expect(prisma.customer.create).not.toHaveBeenCalled();
    expect(rows).toHaveLength(1);
    expect(privacy.setMarketingEmailOptIn).toHaveBeenCalledWith("org_1", "legacy", true, "admin_crm", {
      actorUserId: "staff_1",
    });
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: "customer_matched_existing" }));
  });

  it("keeps a real name and an existing email", async () => {
    const rows = [legacy({ name: "Bilal", email: "b@example.com" })];
    const { service } = makeService(rows);

    const res = await service.create("org_1", { name: "Someone Else", phone: "9876549403", email: "x@example.com" });

    expect(res).toMatchObject({ id: "legacy", name: "Bilal", email: "b@example.com", merged: true });
  });

  it("creates a new customer when the phone is not taken", async () => {
    const rows: Row[] = [];
    const { service, consent } = makeService(rows);

    const res = await service.create("org_1", { name: "Chitra", phone: "9123456789" });

    expect(res).toMatchObject({ name: "Chitra", phone: "+919123456789", merged: false });
    expect(consent.record).toHaveBeenCalled();
  });

  it("does not fold into another organization's customer", async () => {
    const rows = [legacy({ organizationId: "org_2" })];
    const { service } = makeService(rows);

    const res = await service.create("org_1", { name: "Asha", phone: "9876549403" });

    expect(res).toMatchObject({ organizationId: "org_1", merged: false });
    expect(rows).toHaveLength(2);
  });

  it("still rejects editing a phone onto another customer's number", async () => {
    const rows = [legacy(), legacy({ id: "other", name: "Other", phone: "+919000000001" })];
    const { service } = makeService(rows);
    vi.spyOn(service, "get").mockResolvedValue({} as never);
    vi.spyOn(service, "get").mockResolvedValue({} as never);

    await expect(service.update("org_1", "other", { phone: "9876549403" })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});

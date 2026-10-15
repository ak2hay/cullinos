import { describe, expect, it } from "vitest";
import { customerPhoneKey, findDuplicateGroups, mergedCustomerFields } from "./customer-merge";

const row = (id: string, phone: string | null, extra: Record<string, unknown> = {}, day = 1) => ({
  id,
  name: `Guest ${id}`,
  phone,
  email: null as string | null,
  loyaltyTierId: null as string | null,
  loyaltyPoints: 0,
  stampCount: 0,
  createdAt: new Date(2026, 8, day),
  ...extra,
});

describe("customerPhoneKey", () => {
  it("maps every stored format of an Indian mobile to the same E.164 key", () => {
    for (const p of [
      "+917499249403",
      "917499249403",
      "7499249403",
      "+91 74992 49403",
      "\u200B+917499249403 ",
      "+9107499249403",
      "07499249403",
    ]) {
      expect(customerPhoneKey(p)).toBe("+917499249403");
    }
  });

  it("ignores anonymized and junk phones", () => {
    expect(customerPhoneKey("anon_abc")).toBeNull();
    expect(customerPhoneKey("123")).toBeNull();
    expect(customerPhoneKey(null)).toBeNull();
  });
});

describe("findDuplicateGroups", () => {
  it("keeps the oldest customer and groups the rest", () => {
    const { groups, toNormalize } = findDuplicateGroups([
      row("b", "917499249403", {}, 2),
      row("a", "+917499249403", {}, 1),
      row("c", "7499249403", {}, 3),
      row("d", "9876543210", {}, 1),
      row("e", "+919999999999", {}, 1),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].primary.id).toBe("a");
    expect(groups[0].duplicates.map((d) => d.id)).toEqual(["b", "c"]);
    expect(toNormalize.map((n) => [n.customer.id, n.phone])).toEqual([["d", "+919876543210"]]);
  });
});

describe("mergedCustomerFields", () => {
  it("sums points and stamps and prefers a real name over a Guest name", () => {
    const fields = mergedCustomerFields({
      phone: "+917499249403",
      primary: row("a", "+917499249403", { loyaltyPoints: 2200, stampCount: 1 }),
      duplicates: [row("b", "917499249403", { name: "Akshay", loyaltyPoints: 50, email: "a@x.com" })],
    });
    expect(fields).toMatchObject({
      phone: "+917499249403",
      name: "Akshay",
      email: "a@x.com",
      loyaltyPoints: 2250,
      stampCount: 1,
    });
  });
});

import { describe, it, expect } from "vitest";
import { dayBookToCsv, dayBookToTallyXml } from "./erp-export.util";

describe("erp-export util", () => {
  it("builds Tally-compatible CSV with ledger columns", () => {
    const csv = dayBookToCsv([
      {
        date: "2026-09-16",
        voucherType: "Sales",
        voucherNumber: "0001",
        ledgerName: "Sales Account",
        debit: 0,
        credit: 100,
        narration: "Order",
      },
      {
        date: "2026-09-16",
        voucherType: "Receipt",
        voucherNumber: "0001",
        ledgerName: "Cash",
        debit: 118,
        credit: 0,
        narration: "Order",
      },
    ]);

    expect(csv).toContain("Date,Voucher Type,Voucher Number");
    expect(csv).toContain("Sales Account");
    expect(csv).toContain("118.00");
  });

  it("wraps rows in Tally import envelope XML", () => {
    const xml = dayBookToTallyXml("2026-09-16", "Main Outlet", [
      {
        date: "2026-09-16",
        voucherType: "Receipt",
        voucherNumber: "0001",
        ledgerName: "Cash",
        debit: 50,
        credit: 0,
        narration: "Test",
      },
    ]);

    expect(xml).toContain("<TALLYREQUEST>Import Data</TALLYREQUEST>");
    expect(xml).toContain("<VOUCHER");
    expect(xml).toContain("<LEDGERNAME>Cash</LEDGERNAME>");
  });
});

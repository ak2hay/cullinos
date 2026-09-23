export type DayBookRow = {
  date: string;
  voucherType: string;
  voucherNumber: string;
  ledgerName: string;
  debit: number;
  credit: number;
  narration: string;
};

export function dayBookToCsv(rows: DayBookRow[]): string {
  const header =
    "Date,Voucher Type,Voucher Number,Ledger Name,Debit Amount,Credit Amount,Narration";
  const escape = (v: string) =>
    /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  const lines = rows.map(
    (r) =>
      [
        r.date,
        r.voucherType,
        r.voucherNumber,
        r.ledgerName,
        r.debit > 0 ? r.debit.toFixed(2) : "",
        r.credit > 0 ? r.credit.toFixed(2) : "",
        r.narration,
      ]
        .map((c) => escape(String(c)))
        .join(","),
  );
  return [header, ...lines].join("\n");
}

export function dayBookToTallyXml(
  date: string,
  outletName: string,
  rows: DayBookRow[],
): string {
  const esc = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const vouchers = new Map<string, DayBookRow[]>();
  for (const row of rows) {
    const key = `${row.voucherType}:${row.voucherNumber}`;
    const list = vouchers.get(key) ?? [];
    list.push(row);
    vouchers.set(key, list);
  }

  const voucherBlocks = [...vouchers.entries()]
    .map(([key, lines]) => {
      const [voucherType, voucherNumber] = key.split(":");
      const ledgerEntries = lines
        .map((line) => {
          const amount = line.debit > 0 ? line.debit : line.credit;
          const isDebit = line.debit > 0;
          return `
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${esc(line.ledgerName)}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>${isDebit ? "Yes" : "No"}</ISDEEMEDPOSITIVE>
              <AMOUNT>${isDebit ? amount : -amount}</AMOUNT>
              <NARRATION>${esc(line.narration)}</NARRATION>
            </ALLLEDGERENTRIES.LIST>`;
        })
        .join("");

      return `
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="${esc(voucherType)}" ACTION="Create">
            <DATE>${date.replace(/-/g, "")}</DATE>
            <VOUCHERTYPENAME>${esc(voucherType)}</VOUCHERTYPENAME>
            <VOUCHERNUMBER>${esc(voucherNumber)}</VOUCHERNUMBER>
            <NARRATION>${esc(`Cullinos ${outletName}`)}</NARRATION>
            ${ledgerEntries}
          </VOUCHER>
        </TALLYMESSAGE>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${esc(outletName)}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>${voucherBlocks}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
}

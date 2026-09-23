import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import {
  dayBookToCsv,
  dayBookToTallyXml,
  type DayBookRow,
} from "./erp-export.util";

export type DayBookExport = {
  date: string;
  outletId: string;
  outletName: string;
  format: "csv" | "xml";
  filename: string;
  mimeType: string;
  content: string;
  rowCount: number;
};

@Injectable()
export class ErpExportService {
  constructor(private prisma: PrismaService) {}

  async dayBook(
    orgId: string,
    outletId: string,
    date?: string,
    format: "csv" | "xml" = "csv",
  ): Promise<DayBookExport> {
    if (!outletId) throw new BadRequestException("outletId is required");

    const outlet = await this.prisma.outlet.findFirst({
      where: { id: outletId, organizationId: orgId },
    });
    if (!outlet) throw new NotFoundException("Outlet not found");

    const dayStart = date ? new Date(date) : new Date();
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const orders = await this.prisma.order.findMany({
      where: {
        organizationId: orgId,
        outletId,
        status: { in: ["completed", "confirmed", "ready", "served"] },
        createdAt: { gte: dayStart, lt: dayEnd },
      },
      include: {
        taxLines: true,
        payments: {
          where: { status: "completed" },
          include: { paymentMethod: true },
        },
      },
      orderBy: { createdAt: "asc" },
      take: 5000,
    });

    const dateLabel = dayStart.toISOString().slice(0, 10);
    const rows: DayBookRow[] = [];

    for (const order of orders) {
      const voucherNo = order.orderNumber || order.id.slice(-8);
      const salesAmount =
        Number(order.subtotal) - Number(order.discountTotal);
      const taxTotal = Number(order.taxTotal);
      const narration = `Cullinos order ${voucherNo}`;

      if (salesAmount > 0) {
        rows.push({
          date: dateLabel,
          voucherType: "Sales",
          voucherNumber: voucherNo,
          ledgerName: "Sales Account",
          debit: 0,
          credit: Math.round(salesAmount * 100) / 100,
          narration,
        });
      }

      for (const tax of order.taxLines) {
        const amt = Number(tax.amount);
        if (amt <= 0) continue;
        rows.push({
          date: dateLabel,
          voucherType: "Sales",
          voucherNumber: voucherNo,
          ledgerName: tax.taxName || "GST",
          debit: 0,
          credit: Math.round(amt * 100) / 100,
          narration: `${tax.taxName} @ ${Number(tax.rate)}%`,
        });
      }

      const tip = Number(order.tipAmount);
      if (tip > 0) {
        rows.push({
          date: dateLabel,
          voucherType: "Sales",
          voucherNumber: voucherNo,
          ledgerName: "Tips Received",
          debit: 0,
          credit: Math.round(tip * 100) / 100,
          narration: "Tip",
        });
      }

      if (order.payments.length === 0) {
        const total = Number(order.total);
        if (total > 0) {
          rows.push({
            date: dateLabel,
            voucherType: "Receipt",
            voucherNumber: voucherNo,
            ledgerName: "Cash",
            debit: Math.round(total * 100) / 100,
            credit: 0,
            narration,
          });
        }
      } else {
        for (const payment of order.payments) {
          const amt = Number(payment.amount);
          if (amt <= 0) continue;
          const ledger =
            payment.paymentMethod?.name ||
            (payment.paymentMethod?.code === "upi" ? "Bank/UPI" : "Cash");
          rows.push({
            date: dateLabel,
            voucherType: "Receipt",
            voucherNumber: voucherNo,
            ledgerName: ledger,
            debit: Math.round(amt * 100) / 100,
            credit: 0,
            narration,
          });
        }
      }

      if (taxTotal > 0 && order.taxLines.length === 0) {
        rows.push({
          date: dateLabel,
          voucherType: "Sales",
          voucherNumber: voucherNo,
          ledgerName: "GST",
          debit: 0,
          credit: Math.round(taxTotal * 100) / 100,
          narration: "Tax",
        });
      }
    }

    const stamp = `${dateLabel}_${outlet.slug || outlet.id.slice(0, 8)}`;
    if (format === "xml") {
      return {
        date: dateLabel,
        outletId,
        outletName: outlet.name,
        format,
        filename: `tally-daybook-${stamp}.xml`,
        mimeType: "application/xml;charset=utf-8",
        content: dayBookToTallyXml(dateLabel, outlet.name, rows),
        rowCount: rows.length,
      };
    }

    return {
      date: dateLabel,
      outletId,
      outletName: outlet.name,
      format,
      filename: `tally-daybook-${stamp}.csv`,
      mimeType: "text/csv;charset=utf-8",
      content: dayBookToCsv(rows),
      rowCount: rows.length,
    };
  }
}

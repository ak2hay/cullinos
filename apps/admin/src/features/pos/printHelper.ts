import { devicesApi } from '@/lib/api';

export type PrintProfileKind = 'receipt' | 'kot';

export type PrintProfile = {
  kind: PrintProfileKind;
  outletId: string;
  paperWidthMm: number;
  fontSize: 'small' | 'normal' | 'large';
  headerText?: string;
  footerText?: string;
  showLogo: boolean;
  showTaxBreakdown: boolean;
  copies: number;
  cutPaper: boolean;
  deviceId?: string | null;
};

export type PrintableOrder = {
  orderNumber: string;
  customerName?: string | null;
  notes?: string | null;
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    notes?: string | null;
    hsnCode?: string | null;
  }>;
  subtotal?: number;
  taxTotal?: number;
  total?: number;
  /** Amounts in rupees for print display */
  taxLines?: Array<{ taxName: string; amount: number; rate?: number }>;
  feedbackUrl?: string | null;
  gstin?: string | null;
};

const FONT_PX: Record<PrintProfile['fontSize'], number> = {
  small: 11,
  normal: 13,
  large: 16,
};

function profileCss(profile: PrintProfile): string {
  const px = FONT_PX[profile.fontSize];
  return `
    @page { size: ${profile.paperWidthMm}mm auto; margin: 4mm; }
    body { font-family: ui-monospace, monospace; font-size: ${px}px; width: ${profile.paperWidthMm}mm; margin: 0 auto; }
    h1 { font-size: ${px + 4}px; text-align: center; margin: 0 0 8px; }
    .line { display: flex; justify-content: space-between; gap: 8px; }
    .muted { opacity: 0.7; font-size: ${px - 1}px; }
    hr { border: none; border-top: 1px dashed #999; margin: 8px 0; }
  `;
}

function formatMoney(n: number): string {
  return `₹${n.toFixed(2)}`;
}

export function buildReceiptHtml(order: PrintableOrder, profile: PrintProfile): string {
  const subtotal = order.subtotal ?? order.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const taxTotal = order.taxTotal ?? 0;
  const total = order.total ?? subtotal + taxTotal;

  const itemRows = order.items
    .map(
      (item) => `
      <div class="line">
        <span>${item.quantity}× ${item.name}</span>
        <span>${formatMoney(item.unitPrice * item.quantity)}</span>
      </div>
      ${item.hsnCode ? `<div class="muted">HSN/SAC ${item.hsnCode}</div>` : ''}
      ${item.notes ? `<div class="muted">${item.notes}</div>` : ''}`,
    )
    .join('');

  const taxRows =
    profile.showTaxBreakdown && order.taxLines?.length
      ? order.taxLines
          .map((t) => {
            const label =
              t.rate != null && t.rate > 0
                ? `${t.taxName} (${t.rate}%)`
                : t.taxName;
            return `<div class="line muted"><span>${label}</span><span>${formatMoney(t.amount)}</span></div>`;
          })
          .join('')
      : taxTotal > 0
        ? `<div class="line muted"><span>Tax</span><span>${formatMoney(taxTotal)}</span></div>`
        : '';

  const hsnCodes = [
    ...new Set(order.items.map((i) => i.hsnCode).filter(Boolean) as string[]),
  ];

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${profileCss(profile)}</style></head><body>
    ${profile.headerText ? `<h1>${profile.headerText}</h1>` : ''}
    ${order.gstin ? `<div class="muted" style="text-align:center">GSTIN: ${order.gstin}</div>` : ''}
    <div class="line"><strong>#${order.orderNumber}</strong><span>${new Date().toLocaleString()}</span></div>
    ${order.customerName ? `<div class="muted">${order.customerName}</div>` : ''}
    <hr />
    ${itemRows}
    <hr />
    <div class="line"><span>Subtotal</span><span>${formatMoney(subtotal)}</span></div>
    ${taxRows}
    <div class="line"><strong>Total</strong><strong>${formatMoney(total)}</strong></div>
    ${
      hsnCodes.length
        ? `<p class="muted">HSN/SAC: ${hsnCodes.join(', ')}</p>`
        : ''
    }
    ${order.notes ? `<p class="muted">${order.notes}</p>` : ''}
    ${
      order.feedbackUrl
        ? `<hr /><div style="text-align:center;margin-top:10px">
      <p class="muted">Scan for feedback</p>
      <img alt="Feedback QR" width="96" height="96" src="https://api.qrserver.com/v1/create-qr-code/?size=96x96&data=${encodeURIComponent(order.feedbackUrl)}" />
      <p class="muted" style="word-break:break-all;font-size:9px">${order.feedbackUrl}</p>
    </div>`
        : ''
    }
    ${profile.footerText ? `<p class="muted" style="text-align:center;margin-top:12px">${profile.footerText}</p>` : ''}
  </body></html>`;
}

export function buildKotHtml(order: PrintableOrder, profile: PrintProfile): string {
  const itemRows = order.items
    .map(
      (item) => `
      <div class="line"><strong>${item.quantity}× ${item.name}</strong></div>
      ${item.notes ? `<div class="muted">${item.notes}</div>` : ''}`,
    )
    .join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${profileCss(profile)}</style></head><body>
    ${profile.headerText ? `<h1>${profile.headerText}</h1>` : ''}
    <div class="line"><strong>KOT #${order.orderNumber}</strong><span>${new Date().toLocaleTimeString()}</span></div>
    ${order.customerName ? `<div class="muted">${order.customerName}</div>` : ''}
    <hr />
    ${itemRows}
    ${order.notes ? `<hr /><p class="muted">${order.notes}</p>` : ''}
  </body></html>`;
}

/** Sample receipt for printer test print. */
export function buildTestPrintOrder(deviceName: string): PrintableOrder {
  return {
    orderNumber: 'TEST',
    customerName: deviceName,
    items: [{ name: 'Test print item', quantity: 1, unitPrice: 1, hsnCode: '996331' }],
    subtotal: 1,
    taxTotal: 0.05,
    total: 1.05,
    taxLines: [
      { taxName: 'CGST', amount: 0.025, rate: 2.5 },
      { taxName: 'SGST', amount: 0.025, rate: 2.5 },
    ],
    gstin: null,
  };
}

/** Open browser print dialog using outlet print profile. */
export async function printWithProfile(
  kind: PrintProfileKind,
  outletId: string,
  order: PrintableOrder,
  opts?: { deviceId?: string; orderId?: string; recordJob?: boolean },
): Promise<void> {
  const profiles = await devicesApi.printProfiles(outletId);
  const profile = kind === 'receipt' ? profiles.receipt : profiles.kot;
  const html =
    kind === 'receipt' ? buildReceiptHtml(order, profile) : buildKotHtml(order, profile);

  let jobId: string | undefined;
  if (opts?.recordJob !== false) {
    try {
      const job = await devicesApi.createPrintJob({
        outletId,
        deviceId: opts?.deviceId ?? profile.deviceId ?? undefined,
        orderId: opts?.orderId,
        kind,
        status: 'sent',
        payloadSummary: `#${order.orderNumber} ${kind}`,
      });
      jobId = job.id;
    } catch {
      // Non-blocking: print still proceeds without job log.
    }
  }

  const frame = document.createElement('iframe');
  frame.style.position = 'fixed';
  frame.style.right = '0';
  frame.style.bottom = '0';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.border = '0';
  document.body.appendChild(frame);

  const doc = frame.contentDocument ?? frame.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(frame);
    if (jobId) {
      await devicesApi
        .updatePrintJob(jobId, { status: 'failed', error: 'Print frame unavailable' })
        .catch(() => undefined);
    }
    throw new Error('Print frame unavailable');
  }

  doc.open();
  doc.write(html);
  doc.close();

  const printOnce = () => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(() => document.body.removeChild(frame), 500);
  };

  try {
    const copies = Math.max(1, profile.copies ?? 1);
    for (let i = 0; i < copies; i++) {
      if (i === 0) {
        frame.onload = printOnce;
        if (doc.readyState === 'complete') printOnce();
      } else {
        await new Promise<void>((resolve) => {
          setTimeout(() => {
            frame.contentWindow?.print();
            resolve();
          }, 400 * i);
        });
      }
    }
    if (jobId) {
      await devicesApi.updatePrintJob(jobId, { status: 'done' }).catch(() => undefined);
    }
  } catch (err) {
    if (jobId) {
      await devicesApi
        .updatePrintJob(jobId, {
          status: 'failed',
          error: err instanceof Error ? err.message : 'Print failed',
        })
        .catch(() => undefined);
    }
    throw err;
  }
}

/** Minimal browser receipt/KOT helper (standalone POS; respects outlet print profiles when available). */
import QRCode from 'qrcode';
import { devicesApi } from '@/lib/api';

export type PrintableOrder = {
  orderNumber: string;
  customerName?: string | null;
  notes?: string | null;
  outletName?: string | null;
  items: Array<{ name: string; quantity: number; unitPrice: number; notes?: string | null }>;
  subtotal?: number;
  taxTotal?: number;
  discountTotal?: number;
  tipAmount?: number;
  total?: number;
  feedbackUrl?: string | null;
};

function formatMoney(n: number): string {
  return `₹${n.toFixed(2)}`;
}

/** Guest names and item notes are user-controlled; the print frame shares our origin. */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const e = escapeHtml;

async function feedbackQrDataUrl(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  try {
    return await QRCode.toDataURL(url, { width: 160, margin: 0 });
  } catch {
    return null;
  }
}

function buildReceiptHtml(order: PrintableOrder, feedbackQr: string | null): string {
  const subtotal = order.subtotal ?? order.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const taxTotal = order.taxTotal ?? 0;
  const discountTotal = order.discountTotal ?? 0;
  const tipAmount = order.tipAmount ?? 0;
  const total = order.total ?? Math.max(0, subtotal + taxTotal + tipAmount - discountTotal);

  const itemRows = order.items
    .map(
      (item) => `
      <div style="display:flex;justify-content:space-between;gap:8px">
        <span>${e(item.quantity)}× ${e(item.name)}</span>
        <span>${formatMoney(item.unitPrice * item.quantity)}</span>
      </div>
      ${item.notes ? `<div style="opacity:0.7;font-size:11px">${e(item.notes)}</div>` : ''}`,
    )
    .join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
    <style>
      @page { size: 80mm auto; margin: 4mm; }
      body { font-family: ui-monospace, monospace; font-size: 13px; width: 80mm; margin: 0 auto; }
      h1 { font-size: 17px; text-align: center; margin: 0 0 8px; }
      .line { display: flex; justify-content: space-between; gap: 8px; }
      .muted { opacity: 0.7; font-size: 12px; }
      hr { border: none; border-top: 1px dashed #999; margin: 8px 0; }
    </style></head><body>
    <h1>Receipt</h1>
    <div class="line"><strong>#${e(order.orderNumber)}</strong><span>${new Date().toLocaleString()}</span></div>
    ${order.customerName ? `<div class="muted">${e(order.customerName)}</div>` : ''}
    <hr />
    ${itemRows}
    <hr />
    <div class="line"><span>Subtotal</span><span>${formatMoney(subtotal)}</span></div>
    ${taxTotal > 0 ? `<div class="line muted"><span>Tax</span><span>${formatMoney(taxTotal)}</span></div>` : ''}
    ${tipAmount > 0 ? `<div class="line muted"><span>Tip</span><span>${formatMoney(tipAmount)}</span></div>` : ''}
    ${discountTotal > 0 ? `<div class="line"><span>Discount</span><span>−${formatMoney(discountTotal)}</span></div>` : ''}
    <div class="line"><strong>Total</strong><strong>${formatMoney(total)}</strong></div>
    ${order.notes ? `<p class="muted">${e(order.notes)}</p>` : ''}
    ${
      feedbackQr
        ? `<hr /><div style="text-align:center;margin-top:10px">
      <p class="muted">Scan for feedback${order.outletName ? ` · ${e(order.outletName)}` : ''}</p>
      <img alt="Feedback QR" width="96" height="96" style="image-rendering:pixelated" src="${e(feedbackQr)}" />
    </div>`
        : ''
    }
    <p class="muted" style="text-align:center;margin-top:12px">${
      order.outletName?.trim()
        ? `Thank you for dining at ${e(order.outletName.trim())}!`
        : 'Thank you!'
    }</p>
  </body></html>`;
}

function buildKotHtml(order: PrintableOrder): string {
  const itemRows = order.items
    .map(
      (item) => `
      <div><strong>${e(item.quantity)}× ${e(item.name)}</strong></div>
      ${item.notes ? `<div style="opacity:0.7;font-size:12px">${e(item.notes)}</div>` : ''}`,
    )
    .join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
    <style>
      @page { size: 80mm auto; margin: 4mm; }
      body { font-family: ui-monospace, monospace; font-size: 13px; width: 80mm; margin: 0 auto; }
    </style></head><body>
    <div style="display:flex;justify-content:space-between"><strong>KOT #${e(order.orderNumber)}</strong><span>${new Date().toLocaleTimeString()}</span></div>
    ${order.customerName ? `<div style="opacity:0.7">${e(order.customerName)}</div>` : ''}
    <hr style="border:none;border-top:1px dashed #999;margin:8px 0" />
    ${itemRows}
    ${order.notes ? `<hr style="border:none;border-top:1px dashed #999;margin:8px 0" /><p style="opacity:0.7">${e(order.notes)}</p>` : ''}
  </body></html>`;
}

export async function printReceipt(
  kind: 'receipt' | 'kot',
  order: PrintableOrder,
  opts?: { outletId?: string; force?: boolean },
): Promise<void> {
  if (opts?.outletId && !opts.force) {
    try {
      const profiles = await devicesApi.printProfiles(opts.outletId);
      const profile = kind === 'receipt' ? profiles.receipt : profiles.kot;
      if (profile.enabled === false) return;
    } catch {
      // If profiles unavailable, fall through for receipt only; skip kot by default
      if (kind === 'kot') return;
    }
  } else if (kind === 'kot' && !opts?.force) {
    // Without outlet profile, skip browser KOT (use KDS)
    return;
  }

  const html =
    kind === 'receipt'
      ? buildReceiptHtml(order, await feedbackQrDataUrl(order.feedbackUrl))
      : buildKotHtml(order);

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
    throw new Error('Print frame unavailable');
  }

  doc.open();
  doc.write(html);
  doc.close();

  await waitForImages(doc);
  frame.contentWindow?.focus();
  frame.contentWindow?.print();
  setTimeout(() => frame.remove(), 500);
}

/** Print dialogs capture the page as-is, so wait for images (capped so a broken image can't block printing). */
function waitForImages(doc: Document, timeoutMs = 3000): Promise<void> {
  const pending = Array.from(doc.images).filter((img) => !img.complete);
  if (pending.length === 0) return Promise.resolve();
  const loads = pending.map(
    (img) =>
      new Promise<void>((resolve) => {
        img.addEventListener('load', () => resolve(), { once: true });
        img.addEventListener('error', () => resolve(), { once: true });
      }),
  );
  return Promise.race([
    Promise.all(loads).then(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}

/** Minimal browser receipt/KOT helper (standalone POS; no device profiles). */

export type PrintableOrder = {
  orderNumber: string;
  customerName?: string | null;
  notes?: string | null;
  items: Array<{ name: string; quantity: number; unitPrice: number; notes?: string | null }>;
  subtotal?: number;
  taxTotal?: number;
  total?: number;
  feedbackUrl?: string | null;
};

function formatMoney(n: number): string {
  return `₹${n.toFixed(2)}`;
}

function buildReceiptHtml(order: PrintableOrder): string {
  const subtotal = order.subtotal ?? order.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const taxTotal = order.taxTotal ?? 0;
  const total = order.total ?? subtotal + taxTotal;

  const itemRows = order.items
    .map(
      (item) => `
      <div style="display:flex;justify-content:space-between;gap:8px">
        <span>${item.quantity}× ${item.name}</span>
        <span>${formatMoney(item.unitPrice * item.quantity)}</span>
      </div>
      ${item.notes ? `<div style="opacity:0.7;font-size:11px">${item.notes}</div>` : ''}`,
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
    <div class="line"><strong>#${order.orderNumber}</strong><span>${new Date().toLocaleString()}</span></div>
    ${order.customerName ? `<div class="muted">${order.customerName}</div>` : ''}
    <hr />
    ${itemRows}
    <hr />
    <div class="line"><span>Subtotal</span><span>${formatMoney(subtotal)}</span></div>
    ${taxTotal > 0 ? `<div class="line muted"><span>Tax</span><span>${formatMoney(taxTotal)}</span></div>` : ''}
    <div class="line"><strong>Total</strong><strong>${formatMoney(total)}</strong></div>
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
  </body></html>`;
}

function buildKotHtml(order: PrintableOrder): string {
  const itemRows = order.items
    .map(
      (item) => `
      <div><strong>${item.quantity}× ${item.name}</strong></div>
      ${item.notes ? `<div style="opacity:0.7;font-size:12px">${item.notes}</div>` : ''}`,
    )
    .join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
    <style>
      @page { size: 80mm auto; margin: 4mm; }
      body { font-family: ui-monospace, monospace; font-size: 13px; width: 80mm; margin: 0 auto; }
    </style></head><body>
    <div style="display:flex;justify-content:space-between"><strong>KOT #${order.orderNumber}</strong><span>${new Date().toLocaleTimeString()}</span></div>
    ${order.customerName ? `<div style="opacity:0.7">${order.customerName}</div>` : ''}
    <hr style="border:none;border-top:1px dashed #999;margin:8px 0" />
    ${itemRows}
    ${order.notes ? `<hr style="border:none;border-top:1px dashed #999;margin:8px 0" /><p style="opacity:0.7">${order.notes}</p>` : ''}
  </body></html>`;
}

export async function printReceipt(kind: 'receipt' | 'kot', order: PrintableOrder): Promise<void> {
  const html = kind === 'receipt' ? buildReceiptHtml(order) : buildKotHtml(order);

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

  const printOnce = () => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(() => document.body.removeChild(frame), 500);
  };

  frame.onload = printOnce;
  if (doc.readyState === 'complete') printOnce();
}

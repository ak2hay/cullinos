import QRCode from 'qrcode';
import { devicesApi, organizationsApi } from '@/lib/api';
import { resolvePublicImageSrc } from '@/components/ImageUploadField';

export type PrintProfileKind = 'receipt' | 'kot';

export type PrintProfile = {
  kind: PrintProfileKind;
  outletId: string;
  paperWidthMm: number;
  fontSize: 'small' | 'normal' | 'large';
  headerText?: string;
  footerText?: string;
  showLogo: boolean;
  logoUrl?: string | null;
  showTaxBreakdown: boolean;
  copies: number;
  cutPaper: boolean;
  enabled?: boolean;
  deviceId?: string | null;
};

export type PrintableOrder = {
  orderNumber: string;
  customerName?: string | null;
  notes?: string | null;
  outletName?: string | null;
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    notes?: string | null;
    hsnCode?: string | null;
  }>;
  subtotal?: number;
  taxTotal?: number;
  discountTotal?: number;
  tipAmount?: number;
  deliveryFee?: number;
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
    body { font-family: ui-monospace, monospace; font-size: ${px}px; width: ${profile.paperWidthMm}mm; margin: 0 auto; color: #111; }
    h1 { font-size: ${px + 4}px; text-align: center; margin: 0 0 6px; font-weight: 700; letter-spacing: 0.02em; }
    .logo { display: block; max-width: 48mm; max-height: 18mm; margin: 0 auto 8px; object-fit: contain; }
    .line { display: flex; justify-content: space-between; gap: 8px; }
    .muted { opacity: 0.7; font-size: ${px - 1}px; }
    .total-row { font-size: ${px + 2}px; margin-top: 4px; }
    hr { border: none; border-top: 1px dashed #999; margin: 8px 0; }
  `;
}

function formatMoney(n: number): string {
  return `₹${n.toFixed(2)}`;
}

/** Guest names, item notes and profile text are user-controlled; the print frame shares our origin. */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const e = escapeHtml;

function logoHtml(profile: PrintProfile): string {
  if (!profile.showLogo || !profile.logoUrl) return '';
  const src = resolvePublicImageSrc(profile.logoUrl);
  return `<img class="logo" alt="" src="${e(src)}" />`;
}

function resolveThanksFooter(profile: PrintProfile, outletName?: string | null): string {
  const custom = profile.footerText?.trim() ?? '';
  const isGeneric =
    !custom ||
    /^thank you[!?.]*$/i.test(custom) ||
    /^thanks[!?.]*$/i.test(custom);
  if (!isGeneric) return custom;
  if (outletName?.trim()) return `Thank you for dining at ${outletName.trim()}!`;
  return custom || 'Thank you!';
}

export async function feedbackQrDataUrl(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  try {
    return await QRCode.toDataURL(url, { width: 160, margin: 0 });
  } catch {
    return null;
  }
}

export function buildReceiptHtml(
  order: PrintableOrder,
  profile: PrintProfile,
  feedbackQr?: string | null,
): string {
  const subtotal = order.subtotal ?? order.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const taxTotal = order.taxTotal ?? 0;
  const discountTotal = order.discountTotal ?? 0;
  const tipAmount = order.tipAmount ?? 0;
  const deliveryFee = order.deliveryFee ?? 0;
  const total =
    order.total ?? Math.max(0, subtotal + taxTotal + tipAmount + deliveryFee - discountTotal);
  const extraRows = [
    deliveryFee > 0 ? `<div class="line muted"><span>Delivery</span><span>${formatMoney(deliveryFee)}</span></div>` : '',
    tipAmount > 0 ? `<div class="line muted"><span>Tip</span><span>${formatMoney(tipAmount)}</span></div>` : '',
    discountTotal > 0 ? `<div class="line"><span>Discount</span><span>−${formatMoney(discountTotal)}</span></div>` : '',
  ].join('');
  const thanks = resolveThanksFooter(profile, order.outletName);

  const itemRows = order.items
    .map(
      (item) => `
      <div class="line">
        <span>${e(item.quantity)}× ${e(item.name)}</span>
        <span>${formatMoney(item.unitPrice * item.quantity)}</span>
      </div>
      ${item.hsnCode ? `<div class="muted">HSN/SAC ${e(item.hsnCode)}</div>` : ''}
      ${item.notes ? `<div class="muted">${e(item.notes)}</div>` : ''}`,
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
            return `<div class="line muted"><span>${e(label)}</span><span>${formatMoney(t.amount)}</span></div>`;
          })
          .join('')
      : taxTotal > 0
        ? `<div class="line muted"><span>Tax</span><span>${formatMoney(taxTotal)}</span></div>`
        : '';

  const hsnCodes = [
    ...new Set(order.items.map((i) => i.hsnCode).filter(Boolean) as string[]),
  ];

  const feedbackBlock = feedbackQr
    ? `<hr /><div style="text-align:center;margin-top:10px">
      <p class="muted">Scan for feedback${order.outletName ? ` · ${e(order.outletName)}` : ''}</p>
      <img alt="Feedback QR" width="96" height="96" style="image-rendering:pixelated" src="${e(feedbackQr)}" />
    </div>`
    : '';

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${profileCss(profile)}</style></head><body>
    ${logoHtml(profile)}
    ${profile.headerText ? `<h1>${e(profile.headerText)}</h1>` : ''}
    ${order.gstin ? `<div class="muted" style="text-align:center">GSTIN: ${e(order.gstin)}</div>` : ''}
    <div class="line"><strong>#${e(order.orderNumber)}</strong><span>${new Date().toLocaleString()}</span></div>
    ${order.customerName ? `<div class="muted">${e(order.customerName)}</div>` : ''}
    <hr />
    ${itemRows}
    <hr />
    <div class="line"><span>Subtotal</span><span>${formatMoney(subtotal)}</span></div>
    ${taxRows}
    ${extraRows}
    <div class="line total-row"><strong>Total</strong><strong>${formatMoney(total)}</strong></div>
    ${
      hsnCodes.length
        ? `<p class="muted">HSN/SAC: ${e(hsnCodes.join(', '))}</p>`
        : ''
    }
    ${order.notes ? `<p class="muted">${e(order.notes)}</p>` : ''}
    ${feedbackBlock}
    <p class="muted" style="text-align:center;margin-top:12px">${e(thanks)}</p>
  </body></html>`;
}

export function buildKotHtml(order: PrintableOrder, profile: PrintProfile): string {
  const itemRows = order.items
    .map(
      (item) => `
      <div class="line"><strong>${e(item.quantity)}× ${e(item.name)}</strong></div>
      ${item.notes ? `<div class="muted">${e(item.notes)}</div>` : ''}`,
    )
    .join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${profileCss(profile)}</style></head><body>
    ${profile.headerText ? `<h1>${e(profile.headerText)}</h1>` : '<h1>KITCHEN</h1>'}
    <div class="line"><strong>KOT #${e(order.orderNumber)}</strong><span>${new Date().toLocaleTimeString()}</span></div>
    ${order.customerName ? `<div class="muted">${e(order.customerName)}</div>` : ''}
    <hr />
    ${itemRows}
    ${order.notes ? `<hr /><p class="muted">${e(order.notes)}</p>` : ''}
    ${profile.footerText ? `<p class="muted" style="text-align:center;margin-top:12px">${e(profile.footerText)}</p>` : ''}
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

/** Open browser print dialog using outlet print profile. Skips when profile.enabled === false. */
export async function printWithProfile(
  kind: PrintProfileKind,
  outletId: string,
  order: PrintableOrder,
  opts?: { deviceId?: string; orderId?: string; recordJob?: boolean; force?: boolean },
): Promise<void> {
  const profiles = await devicesApi.printProfiles(outletId);
  const profile = kind === 'receipt' ? profiles.receipt : profiles.kot;
  if (profile.enabled === false && !opts?.force) {
    return;
  }

  let resolved: PrintProfile = { ...profile, enabled: profile.enabled ?? true };
  if (resolved.showLogo && !resolved.logoUrl) {
    try {
      const org = await organizationsApi.current();
      if (org.logoUrl) resolved = { ...resolved, logoUrl: org.logoUrl };
    } catch {
      /* optional */
    }
  }

  const html =
    kind === 'receipt'
      ? buildReceiptHtml(order, resolved, await feedbackQrDataUrl(order.feedbackUrl))
      : buildKotHtml(order, resolved);

  let jobId: string | undefined;
  if (opts?.recordJob !== false) {
    try {
      const job = await devicesApi.createPrintJob({
        outletId,
        deviceId: opts?.deviceId ?? resolved.deviceId ?? undefined,
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

  try {
    await waitForImages(doc);
    const copies = Math.min(3, Math.max(1, resolved.copies ?? 1));
    for (let i = 0; i < copies; i++) {
      if (i > 0) await new Promise((resolve) => setTimeout(resolve, 400));
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    }
    setTimeout(() => frame.remove(), 500);
    if (jobId) {
      await devicesApi.updatePrintJob(jobId, { status: 'done' }).catch(() => undefined);
    }
  } catch (err) {
    frame.remove();
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

/** Print dialogs capture the page as-is, so wait for logo/QR images (capped so a broken image can't block printing). */
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

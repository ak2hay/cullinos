import QRCode from 'qrcode';
import { useEffect, useState } from 'react';

export function qrDataUrl(data: string, size: number): Promise<string> {
  return QRCode.toDataURL(data, { width: size, margin: 1 });
}

export function useQrDataUrl(data: string | null | undefined, size: number): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!data) {
      setUrl(null);
      return;
    }
    let cancelled = false;
    qrDataUrl(data, size)
      .then((next) => {
        if (!cancelled) setUrl(next);
      })
      .catch(() => {
        if (!cancelled) setUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [data, size]);
  return url;
}

export async function downloadQr(data: string, size: number, filename: string): Promise<void> {
  const href = await qrDataUrl(data, size);
  const a = document.createElement('a');
  a.href = href;
  a.download = filename.endsWith('.png') ? filename : `${filename}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Prints static HTML via a hidden same-origin iframe (no pop-up, no opener). */
export function printHtml(html: string): void {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;
  if (!doc || !win) {
    iframe.remove();
    throw new Error('Could not open print frame');
  }
  doc.open();
  doc.write(html);
  doc.close();
  const cleanup = () => setTimeout(() => iframe.remove(), 1000);
  win.addEventListener('afterprint', cleanup, { once: true });
  const images = Array.from(doc.images);
  Promise.all(
    images.map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            img.onload = () => resolve();
            img.onerror = () => resolve();
          }),
    ),
  ).then(() => {
    win.focus();
    win.print();
    setTimeout(() => iframe.remove(), 60_000);
  });
}

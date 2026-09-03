import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Button } from '@/components/ui/Form';

interface QrCodeModalProps {
  tableName: string;
  qrUrl: string;
  sessionToken: string;
  onViewOrder: () => void;
  onClose: () => void;
}

export function QrCodeModal({
  tableName,
  qrUrl,
  sessionToken,
  onViewOrder,
  onClose,
}: QrCodeModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!canvasRef.current || !qrUrl) return;
    void QRCode.toCanvas(canvasRef.current, qrUrl, {
      width: 280,
      margin: 2,
      color: { dark: '#0F0F1A', light: '#FFFFFF' },
    });
  }, [qrUrl]);

  async function copyLink() {
    await navigator.clipboard.writeText(qrUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg-primary">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div>
          <h2 className="font-semibold">{tableName}</h2>
          <p className="text-xs text-text-secondary">Guests scan to open the digital menu</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
        <canvas ref={canvasRef} className="rounded-xl bg-white p-3" />
        <p className="max-w-sm break-all text-center text-xs text-text-muted">{qrUrl}</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button variant="secondary" onClick={copyLink}>
            {copied ? 'Copied!' : 'Copy link'}
          </Button>
          <Button onClick={onViewOrder}>View table order</Button>
        </div>
        <p className="text-xs text-text-muted">Session: {sessionToken.slice(0, 8)}…</p>
      </div>
    </div>
  );
}

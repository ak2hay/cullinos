import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@cullinos/ui';

type Props = {
  file: File;
  targetWidth: number;
  targetHeight: number;
  onCancel: () => void;
  onCropped: (file: File) => void;
};

/**
 * Square (or fixed-ratio) crop: pan + zoom, then export to target pixels via canvas.
 */
export function ImageCropModal({
  file,
  targetWidth,
  targetHeight,
  onCancel,
  onCropped,
}: Props) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    const img = new Image();
    img.onload = () => setNatural({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const viewSize = 280;

  const coverScale = (() => {
    if (!natural.w || !natural.h) return 1;
    const vw = viewSize;
    const vh = viewSize;
    return Math.max(vw / natural.w, vh / natural.h);
  })();

  const displayW = natural.w * coverScale * zoom;
  const displayH = natural.h * coverScale * zoom;

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    setOffset({
      x: d.ox + (e.clientX - d.x),
      y: d.oy + (e.clientY - d.y),
    });
  };
  const onPointerUp = () => {
    dragRef.current = null;
  };

  const exportCrop = useCallback(async () => {
    if (!objectUrl || !natural.w) return;
    setBusy(true);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('Could not load image'));
        el.src = objectUrl;
      });

      // Map viewport crop square back to source pixels
      const scale = coverScale * zoom;
      // Image top-left in viewport coords (centered + offset)
      const imgLeft = viewSize / 2 - displayW / 2 + offset.x;
      const imgTop = viewSize / 2 - displayH / 2 + offset.y;
      // Crop window is the full viewport square
      const sx = (0 - imgLeft) / scale;
      const sy = (0 - imgTop) / scale;
      const sw = viewSize / scale;
      const sh = viewSize / scale;

      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas unavailable');
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', 0.92),
      );
      if (!blob) throw new Error('Could not export crop');
      const base = file.name.replace(/\.[^.]+$/, '') || 'image';
      onCropped(new File([blob], `${base}-${targetWidth}.jpg`, { type: 'image/jpeg' }));
    } finally {
      setBusy(false);
    }
  }, [
    objectUrl,
    natural.w,
    coverScale,
    zoom,
    displayW,
    displayH,
    offset.x,
    offset.y,
    targetWidth,
    targetHeight,
    file.name,
    onCropped,
  ]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md space-y-4 rounded-xl border border-white/10 bg-bg-card p-5 shadow-xl">
        <div>
          <h3 className="font-medium">Adjust photo</h3>
          <p className="mt-1 text-xs text-text-muted">
            Drag to reposition, zoom as needed. We&apos;ll crop to {targetWidth}×{targetHeight}px.
          </p>
        </div>
        <div
          className="relative mx-auto overflow-hidden rounded-lg border border-white/10 bg-black touch-none"
          style={{ width: viewSize, height: viewSize }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {objectUrl && natural.w > 0 ? (
            <img
              src={objectUrl}
              alt=""
              draggable={false}
              className="absolute max-w-none select-none"
              style={{
                width: displayW,
                height: displayH,
                left: viewSize / 2 - displayW / 2 + offset.x,
                top: viewSize / 2 - displayH / 2 + offset.y,
              }}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-text-muted">
              Loading…
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 ring-2 ring-inset ring-brand-primary/60" />
        </div>
        <label className="block text-sm">
          <span className="mb-1.5 block text-text-secondary">Zoom</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full"
          />
        </label>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" loading={busy} onClick={() => void exportCrop()}>
            Crop &amp; upload
          </Button>
        </div>
      </div>
    </div>
  );
}

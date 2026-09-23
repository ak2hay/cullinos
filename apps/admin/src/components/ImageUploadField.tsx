import { useRef, useState } from 'react';
import { Button } from '@cullinos/ui';
import { API_BASE } from '@/lib/api';
import { ImageCropModal } from '@/components/ImageCropModal';

/** Platform-wide max image upload size (must match API MARKETING_UPLOAD_MAX_BYTES). */
export const IMAGE_UPLOAD_MAX_MB = 5;
export const IMAGE_UPLOAD_MAX_PIXELS = 4096;

/** Resolve relative `/cms/...` upload URLs against the API host (not the SPA origin). */
export function resolvePublicImageSrc(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('data:')) return trimmed;
  if (trimmed.startsWith('/')) {
    const origin = API_BASE.replace(/\/api\/v1\/?$/, '').replace(/\/$/, '');
    return `${origin}${trimmed}`;
  }
  return trimmed;
}

export type ImageSlotHint = {
  label: string;
  ratioLabel: string;
  /** width / height — recommended ratio for UI hints only */
  ratio: number;
  targetWidth: number;
  targetHeight: number;
  maxMb: number;
  /** When true, open crop modal before upload */
  cropBeforeUpload?: boolean;
};

export const IMAGE_SLOT_HINTS: Record<string, ImageSlotHint> = {
  banner: {
    label: 'Guest banner',
    ratioLabel: '3:1',
    ratio: 3 / 1,
    targetWidth: 1200,
    targetHeight: 400,
    maxMb: IMAGE_UPLOAD_MAX_MB,
  },
  promoSlide: {
    label: 'Promo slide',
    ratioLabel: '16:9',
    ratio: 16 / 9,
    targetWidth: 1920,
    targetHeight: 1080,
    maxMb: IMAGE_UPLOAD_MAX_MB,
  },
  coupon: {
    label: 'Coupon / offer',
    ratioLabel: '1:1',
    ratio: 1,
    targetWidth: 800,
    targetHeight: 800,
    maxMb: IMAGE_UPLOAD_MAX_MB,
    cropBeforeUpload: true,
  },
  menuItem: {
    label: 'Menu product',
    ratioLabel: '1:1',
    ratio: 1,
    targetWidth: 800,
    targetHeight: 800,
    maxMb: IMAGE_UPLOAD_MAX_MB,
    cropBeforeUpload: true,
  },
  outletCover: {
    label: 'Outlet cover',
    ratioLabel: '16:9',
    ratio: 16 / 9,
    targetWidth: 1600,
    targetHeight: 900,
    maxMb: IMAGE_UPLOAD_MAX_MB,
  },
  outletGallery: {
    label: 'Gallery photo',
    ratioLabel: '4:3',
    ratio: 4 / 3,
    targetWidth: 1200,
    targetHeight: 900,
    maxMb: IMAGE_UPLOAD_MAX_MB,
  },
} as const;

type SlotKey = keyof typeof IMAGE_SLOT_HINTS;

type Props = {
  slot: SlotKey;
  value: string;
  onChange: (url: string) => void;
  onUpload: (file: File) => Promise<string>;
  disabled?: boolean;
  /** When set, replaces the default "Upload image" label. */
  uploadLabel?: string;
  /** Hide the bordered card chrome (for embedding in another section). */
  bare?: boolean;
};

function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      URL.revokeObjectURL(url);
      if (width < 1 || height < 1) {
        reject(new Error('Could not read image dimensions. Use a valid PNG, JPG, or WebP.'));
        return;
      }
      resolve({ width, height });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read image dimensions. Use a valid PNG, JPG, or WebP.'));
    };
    img.src = url;
  });
}

/** Client-side checks aligned with MarketingUploadService (MIME, size, max pixels). */
export async function validateClientImageFile(
  file: File,
  hint?: ImageSlotHint,
): Promise<void> {
  const allowed = new Set(['image/png', 'image/jpeg', 'image/webp']);
  if (!allowed.has(file.type)) {
    throw new Error('Unsupported file type. Use PNG, JPG, or WebP.');
  }
  const maxMb = hint?.maxMb ?? IMAGE_UPLOAD_MAX_MB;
  const maxBytes = maxMb * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new Error(`File too large. Maximum size is ${maxMb}MB.`);
  }
  const dims = await readImageDimensions(file);
  if (dims.width > IMAGE_UPLOAD_MAX_PIXELS || dims.height > IMAGE_UPLOAD_MAX_PIXELS) {
    const label = hint?.label ?? 'Image';
    throw new Error(
      `${label} is too large. Maximum dimension is ${IMAGE_UPLOAD_MAX_PIXELS}px on the longest side. Got ${dims.width}×${dims.height}.`,
    );
  }
}

export function ImageUploadField({
  slot,
  value,
  onChange,
  onUpload,
  disabled,
  uploadLabel,
  bare,
}: Props) {
  const hint = IMAGE_SLOT_HINTS[slot];
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);

  async function uploadValidated(file: File) {
    setUploading(true);
    setError(null);
    try {
      await validateClientImageFile(file, hint);
      const url = await onUpload(file);
      onChange(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function handleFile(file: File | null) {
    if (!file) return;
    setError(null);
    try {
      await validateClientImageFile(file, hint);
      if (hint.cropBeforeUpload) {
        setCropFile(file);
        return;
      }
      await uploadValidated(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid image');
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  const hintText = hint.cropBeforeUpload
    ? `Any ratio OK — crop to ${hint.targetWidth}×${hint.targetHeight}px before upload. PNG/JPG/WebP, max ${hint.maxMb} MB.`
    : `Recommended ${hint.targetWidth}×${hint.targetHeight}px (${hint.ratioLabel}), PNG/JPG/WebP, max ${hint.maxMb} MB.`;

  const body = (
    <>
      <div>
        <p className="text-sm font-medium">{hint.label} image</p>
        <p className="text-xs text-text-muted">{hintText}</p>
      </div>
      {value ? (
        <img
          src={resolvePublicImageSrc(value)}
          alt=""
          className="h-28 max-w-full rounded-lg object-cover"
        />
      ) : (
        <div className="flex h-28 items-center justify-center rounded-lg border border-dashed border-white/20 text-xs text-text-muted">
          No image
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <label className="inline-flex cursor-pointer items-center rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 text-sm">
          {uploading ? 'Uploading…' : uploadLabel ?? 'Upload image'}
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            disabled={disabled || uploading}
            onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
          />
        </label>
        {value ? (
          <Button type="button" variant="ghost" disabled={disabled || uploading} onClick={() => onChange('')}>
            Clear
          </Button>
        ) : null}
      </div>
      {error ? <p className="text-xs text-status-error">{error}</p> : null}
      {cropFile ? (
        <ImageCropModal
          file={cropFile}
          targetWidth={hint.targetWidth}
          targetHeight={hint.targetHeight}
          onCancel={() => {
            setCropFile(null);
            if (inputRef.current) inputRef.current.value = '';
          }}
          onCropped={(cropped) => {
            setCropFile(null);
            void uploadValidated(cropped);
          }}
        />
      ) : null}
    </>
  );

  if (bare) {
    return <div className="space-y-2">{body}</div>;
  }

  return <div className="space-y-2 rounded-lg border border-white/5 p-3">{body}</div>;
}

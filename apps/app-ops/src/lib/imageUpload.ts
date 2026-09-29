/** Client image upload helpers aligned with MarketingUploadService. */

export const IMAGE_UPLOAD_MAX_MB = 5;
export const IMAGE_UPLOAD_MAX_PIXELS = 4096;
export const ALLOWED_IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp';

export type ImageSlotHint = {
  label: string;
  ratioLabel: string;
  ratio: number;
  targetWidth: number;
  targetHeight: number;
  maxMb: number;
  cropBeforeUpload?: boolean;
};

export const IMAGE_SLOT_HINTS = {
  banner: {
    label: 'Guest banner',
    ratioLabel: '3:1',
    ratio: 3 / 1,
    targetWidth: 1200,
    targetHeight: 400,
    maxMb: IMAGE_UPLOAD_MAX_MB,
    cropBeforeUpload: true,
  },
  notification: {
    label: 'Push notification hero',
    ratioLabel: '2:1',
    ratio: 2 / 1,
    targetWidth: 1200,
    targetHeight: 600,
    maxMb: IMAGE_UPLOAD_MAX_MB,
    cropBeforeUpload: true,
  },
} as const satisfies Record<string, ImageSlotHint>;

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

export async function validateClientImageFile(
  file: File,
  hint?: ImageSlotHint,
  maxMbOverride?: number,
): Promise<void> {
  const allowed = new Set(['image/png', 'image/jpeg', 'image/webp']);
  if (!allowed.has(file.type)) {
    throw new Error('Unsupported file type. Use PNG, JPG, or WebP.');
  }
  const maxMb = maxMbOverride ?? hint?.maxMb ?? IMAGE_UPLOAD_MAX_MB;
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

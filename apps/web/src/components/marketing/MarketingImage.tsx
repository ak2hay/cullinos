'use client';

import Image from 'next/image';
import type { MarketingImageKey } from '@cullinos/shared';
import { MARKETING_IMAGES } from '@cullinos/shared';
import { useMarketingCms } from '@/components/marketing/MarketingCmsProvider';
import { resolveMarketingImage } from '@/lib/marketing-content';
import { isRemoteImage, isLocalMarketingImage } from '@/lib/images';

interface MarketingImageProps {
  imageKey: MarketingImageKey;
  alt: string;
  className?: string;
  fill?: boolean;
  width?: number;
  height?: number;
  priority?: boolean;
  sizes?: string;
}

export function MarketingImage({
  imageKey,
  alt,
  className,
  fill,
  width,
  height,
  priority,
  sizes,
}: MarketingImageProps) {
  const cms = useMarketingCms();
  const src = resolveMarketingImage(cms, imageKey, MARKETING_IMAGES[imageKey]);
  const useNextImage = isRemoteImage(src) || isLocalMarketingImage(src);
  const containClass = className?.includes('object-cover')
    ? className.replace('object-cover', 'object-contain p-3')
    : className ?? 'object-contain p-3';

  if (useNextImage) {
    return (
      <Image
        src={src}
        alt={alt}
        className={className}
        fill={fill}
        width={width}
        height={height}
        priority={priority}
        sizes={sizes}
      />
    );
  }

  if (fill) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        className={`absolute inset-0 h-full w-full ${containClass}`}
        loading={priority ? 'eager' : 'lazy'}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={containClass}
      width={width ?? 400}
      height={height ?? 280}
      loading={priority ? 'eager' : 'lazy'}
    />
  );
}

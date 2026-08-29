import Image from 'next/image';
import { getMarketingImage, isRemoteImage } from '@/lib/images';
import type { MarketingImageKey } from '@cullinos/shared';

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
  const src = getMarketingImage(imageKey);

  const mockupClassName = className?.includes('object-cover')
    ? className.replace('object-cover', 'object-contain p-3')
    : className;

  if (isRemoteImage(src)) {
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
      <Image
        src={src}
        alt={alt}
        className={mockupClassName ?? 'object-contain p-3'}
        fill
        sizes={sizes}
        priority={priority}
        unoptimized
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      className={mockupClassName ?? className}
      width={width ?? 400}
      height={height ?? 280}
      priority={priority}
      unoptimized
    />
  );
}

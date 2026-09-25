import Image from 'next/image';

import { isOptimizableImageHost } from '@/config/images';
import { cn } from '@/lib/cn';

/**
 * Renders a remote product image.
 *
 * Hosts that are explicitly allow-listed go through the Next.js optimizer
 * (responsive sizes, AVIF/WebP). Everything else falls back to a native lazy
 * `<img>`: we would rather serve an unoptimised image than turn our optimizer
 * into an open proxy for arbitrary URLs.
 */
export function ProductImage({
  src,
  alt,
  sizes,
  priority = false,
  className,
}: {
  src: string;
  alt: string;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  const shared = cn('object-cover', className);

  if (isOptimizableImageHost(src)) {
    return <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className={shared} />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- deliberate fallback for non-allow-listed hosts
    <img
      src={src}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      referrerPolicy="no-referrer"
      className={cn('absolute inset-0 size-full', shared)}
    />
  );
}

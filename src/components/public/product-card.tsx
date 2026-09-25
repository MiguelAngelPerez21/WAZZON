import { ImageOff, Star } from 'lucide-react';
import Link from 'next/link';

import { OutboundCta } from '@/components/public/outbound-cta';
import { PriceTag } from '@/components/public/price-tag';
import { Badge } from '@/components/ui/badge';
import { ProductImage } from '@/components/ui/product-image';
import { primaryOffer, type ProductView } from '@/domain/views';

const CARD_IMAGE_SIZES = '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw';

export function ProductCard({
  product,
  trackingMode,
  priority = false,
}: {
  product: ProductView;
  trackingMode: 'direct' | 'redirect';
  priority?: boolean;
}) {
  const offer = primaryOffer(product);
  const image = product.images[0];
  const href = `/producto/${product.slug}`;

  return (
    <article className="group border-ink-200 flex h-full flex-col overflow-hidden rounded-[--radius-card] border bg-white transition-shadow hover:shadow-md">
      <Link
        href={href}
        className="bg-ink-50 relative block aspect-square overflow-hidden"
        tabIndex={-1}
        aria-hidden
      >
        {image ? (
          <ProductImage
            src={image.url}
            alt={image.alt ?? ''}
            sizes={CARD_IMAGE_SIZES}
            priority={priority}
            className="transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <span className="text-ink-300 flex size-full items-center justify-center">
            <ImageOff aria-hidden className="size-10" />
          </span>
        )}

        <div className="absolute top-2 left-2 flex flex-col items-start gap-1">
          {product.featured ? (
            <Badge tone="brand" className="shadow-sm">
              <Star aria-hidden className="size-3" />
              Destacado
            </Badge>
          ) : null}
          {offer?.discountPercentage !== null && offer?.discountPercentage !== undefined ? (
            <Badge tone="deal" className="shadow-sm">
              −{offer.discountPercentage}%
            </Badge>
          ) : null}
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-3 sm:p-4">
        {product.category ? (
          <Link
            href={`/categoria/${product.category.slug}`}
            className="text-brand-700 hover:text-brand-800 text-xs font-medium"
          >
            {product.category.name}
          </Link>
        ) : null}

        <h3 className="text-ink-900 line-clamp-2 text-sm leading-snug font-medium sm:text-base">
          <Link href={href} className="hover:text-brand-700">
            {product.title}
          </Link>
        </h3>

        <PriceTag offer={offer} className="mt-auto" />

        {offer?.provider ? (
          <p className="text-ink-500 text-xs">
            En <span className="text-ink-700 font-medium">{offer.provider.name}</span>
          </p>
        ) : null}

        {offer ? (
          <OutboundCta
            offerId={offer.id}
            productId={product.id}
            affiliateUrl={offer.affiliateUrl}
            trackingMode={trackingMode}
            allowsRedirectTracking={offer.provider?.allowsRedirectTracking ?? false}
            size="sm"
            variant="outline"
            className="mt-1 w-full"
          />
        ) : null}
      </div>
    </article>
  );
}

import { formatPrice } from '@/domain/money';
import { cn } from '@/lib/cn';
import type { OfferView } from '@/domain/views';

/**
 * Price block.
 *
 * Renders nothing when there is no real price: no "—", no "consultar precio",
 * no invented figure.
 */
export function PriceTag({
  offer,
  size = 'md',
  className,
}: {
  offer: OfferView | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  if (!offer || offer.currentPrice === null) return null;

  const current = formatPrice(offer.currentPrice, offer.currency);
  const previous = formatPrice(offer.previousPrice, offer.currency);
  if (!current) return null;

  const currentSize = {
    sm: 'text-base',
    md: 'text-lg',
    lg: 'text-3xl',
  }[size];

  return (
    <div className={cn('flex flex-wrap items-baseline gap-x-2 gap-y-1', className)}>
      <span className={cn('text-ink-900 font-semibold tabular-nums', currentSize)}>{current}</span>
      {previous ? (
        <span className="text-ink-400 text-sm tabular-nums line-through">
          <span className="sr-only">Precio anterior: </span>
          {previous}
        </span>
      ) : null}
      {offer.discountPercentage !== null ? (
        <span className="bg-deal-600 rounded-full px-2 py-0.5 text-xs font-semibold text-white">
          −{offer.discountPercentage}%
        </span>
      ) : null}
    </div>
  );
}

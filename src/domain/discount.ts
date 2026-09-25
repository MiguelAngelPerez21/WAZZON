import { roundToCents } from '@/domain/money';

/**
 * Discount calculation.
 *
 * Mirrors the `offers.discount_percentage` generated column so the UI can
 * preview the value before saving. Returns `null` whenever the inputs do not
 * justify a discount — we never display an invented percentage.
 */
export function calculateDiscountPercentage(
  currentPrice: number | null | undefined,
  previousPrice: number | null | undefined,
): number | null {
  if (
    currentPrice === null ||
    currentPrice === undefined ||
    previousPrice === null ||
    previousPrice === undefined
  ) {
    return null;
  }

  if (!Number.isFinite(currentPrice) || !Number.isFinite(previousPrice)) return null;
  if (previousPrice <= 0) return null;
  if (previousPrice <= currentPrice) return null;
  if (currentPrice < 0) return null;

  const percentage = ((previousPrice - currentPrice) / previousPrice) * 100;
  // `floor` matches the SQL generated column exactly.
  return Math.floor(roundToCents(percentage));
}

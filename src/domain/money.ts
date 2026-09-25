/**
 * Money handling.
 *
 * Storage strategy: PostgreSQL `numeric(12,2)`. PostgREST serialises `numeric`
 * as a *string* to preserve precision, so the application always receives
 * `string | null` and converts explicitly here. We never let a float represent
 * money in the database.
 *
 * In TypeScript we work with `number` for presentation only, and always at a
 * 2-decimal scale, which is exactly representable for the magnitudes involved.
 */

export const SUPPORTED_CURRENCIES = ['EUR', 'USD', 'GBP', 'MXN', 'BRL', 'PLN'] as const;
export type Currency = (typeof SUPPORTED_CURRENCIES)[number];

export const MAX_PRICE = 9_999_999.99;

/** Parses a `numeric` column coming from PostgREST. */
export function parsePrice(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Parses user input such as "12,99 €" / "1.299,00" / "$12.99".
 * Returns `null` when the input cannot be understood — never a guessed value.
 */
export function parsePriceInput(raw: string): number | null {
  const cleaned = raw.replace(/[^\d.,-]/g, '').trim();
  if (!cleaned) return null;

  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');

  let normalised: string;
  if (lastComma > lastDot) {
    // European format: dots are thousand separators, comma is the decimal mark.
    normalised = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (lastDot > lastComma) {
    normalised = cleaned.replace(/,/g, '');
  } else {
    normalised = cleaned;
  }

  const parsed = Number.parseFloat(normalised);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > MAX_PRICE) return null;

  return roundToCents(parsed);
}

export function roundToCents(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Serialises a price for the database (`numeric` column). */
export function toDbPrice(value: number | null): string | null {
  if (value === null) return null;
  return roundToCents(value).toFixed(2);
}

export function formatPrice(
  value: number | null,
  currency: string,
  locale = 'es-ES',
): string | null {
  if (value === null) return null;
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

import { MAX_PRICE, SUPPORTED_CURRENCIES, parsePriceInput } from '@/domain/money';
import { validatePublicHttpUrl } from '@/security/url-guard';

/**
 * Sanitisation helpers for data coming from third-party HTML.
 *
 * Remote content is treated as hostile: it is never executed, never trusted for
 * length, and never rendered as raw HTML.
 */

const MAX_TITLE_LENGTH = 180;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_IMAGES = 8;

/** Collapses whitespace, removes control characters and any residual markup. */
export function sanitizeText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined;

  const cleaned = value
    // Any tag-looking fragment is dropped rather than escaped.
    .replace(/<[^>]*>/g, ' ')
    // Strip C0/C1 control characters.
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return undefined;
  return cleaned.slice(0, maxLength);
}

export function sanitizeTitle(value: unknown): string | undefined {
  return sanitizeText(value, MAX_TITLE_LENGTH);
}

export function sanitizeDescription(value: unknown): string | undefined {
  return sanitizeText(value, MAX_DESCRIPTION_LENGTH);
}

/**
 * Accepts only absolute https:// image URLs pointing at public hosts.
 * `data:` and `javascript:` URLs are rejected by `validatePublicHttpUrl`.
 */
export function sanitizeImageUrl(value: unknown, base: URL): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;

  let absolute: string;
  try {
    absolute = new URL(value.trim(), base).toString();
  } catch {
    return undefined;
  }

  try {
    const url = validatePublicHttpUrl(absolute);
    // Mixed content would be blocked by the browser anyway.
    if (url.protocol !== 'https:') return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

export function sanitizeImageList(values: unknown[], base: URL): string[] {
  const seen = new Set<string>();
  for (const value of values) {
    const url = sanitizeImageUrl(value, base);
    if (url && !seen.has(url)) seen.add(url);
    if (seen.size >= MAX_IMAGES) break;
  }
  return [...seen];
}

export function sanitizeCurrency(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const code = value.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) return undefined;
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(code) ? code : code;
}

export function sanitizePrice(value: unknown): number | undefined {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0 || value > MAX_PRICE) return undefined;
    return Math.round(value * 100) / 100;
  }
  if (typeof value !== 'string') return undefined;
  const parsed = parsePriceInput(value);
  return parsed === null ? undefined : parsed;
}

export function sanitizeCanonicalUrl(value: unknown, base: URL): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  try {
    const absolute = new URL(value.trim(), base).toString();
    return validatePublicHttpUrl(absolute).toString();
  } catch {
    return undefined;
  }
}

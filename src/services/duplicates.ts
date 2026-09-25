import 'server-only';

import { extractHostname, normalizeUrlForDedupe } from '@/domain/url';
import { logger } from '@/lib/logger';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Duplicate detection.
 *
 * Compares the normalised (tracking-free) form of the affiliate, original and
 * canonical URLs. A match is reported as a *warning*, never as a hard block:
 * the same landing page can legitimately back two different editorial products.
 */

export interface DuplicateMatch {
  productId: string;
  productTitle: string;
  productSlug: string;
  productStatus: string;
  offerId: string;
  matchedOn: 'affiliate_url' | 'original_url' | 'canonical_url';
}

export interface DuplicateCandidateUrls {
  affiliateUrl?: string | null;
  originalUrl?: string | null;
  canonicalUrl?: string | null;
}

/** The value stored in `offers.dedupe_key`. */
export function buildDedupeKey(urls: DuplicateCandidateUrls): string | null {
  const source = urls.canonicalUrl ?? urls.originalUrl ?? urls.affiliateUrl ?? null;
  return source ? normalizeUrlForDedupe(source) : null;
}

export async function findPotentialDuplicates(
  urls: DuplicateCandidateUrls,
  excludeProductId?: string,
): Promise<DuplicateMatch[]> {
  const keys = new Set<string>();
  const origin: Record<string, DuplicateMatch['matchedOn']> = {};

  const register = (raw: string | null | undefined, field: DuplicateMatch['matchedOn']) => {
    if (!raw) return;
    const key = normalizeUrlForDedupe(raw);
    if (!key) return;
    keys.add(key);
    origin[key] ??= field;
  };

  register(urls.affiliateUrl, 'affiliate_url');
  register(urls.originalUrl, 'original_url');
  register(urls.canonicalUrl, 'canonical_url');

  if (keys.size === 0) return [];

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('offers')
    .select(
      'id, dedupe_key, product_id, products!offers_product_id_fkey ( id, title, slug, status )',
    )
    .in('dedupe_key', [...keys])
    .limit(10)
    .returns<
      {
        id: string;
        dedupe_key: string | null;
        product_id: string;
        products: { id: string; title: string; slug: string; status: string } | null;
      }[]
    >();

  if (error) {
    logger.warn('duplicates.lookup_failed', { error });
    return [];
  }

  return (data ?? [])
    .filter((row) => row.products !== null && row.product_id !== excludeProductId)
    .map((row) => ({
      productId: row.products?.id ?? row.product_id,
      productTitle: row.products?.title ?? 'Producto',
      productSlug: row.products?.slug ?? '',
      productStatus: row.products?.status ?? 'draft',
      offerId: row.id,
      matchedOn: (row.dedupe_key ? origin[row.dedupe_key] : undefined) ?? 'affiliate_url',
    }));
}

/**
 * Matches a URL hostname against the `providers.domains` array.
 * Falls back to the `generic` provider so an unknown marketplace never blocks
 * the publishing flow.
 */
export async function detectProviderForUrl(
  rawUrl: string,
): Promise<{ id: string; slug: string; name: string } | null> {
  const hostname = extractHostname(rawUrl);
  if (!hostname) return null;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('providers')
    .select('id, slug, name, domains')
    .eq('active', true);

  if (error) {
    logger.warn('providers.detect_failed', { error });
    return null;
  }

  const providers = data ?? [];

  const matched = providers.find((provider) =>
    (provider.domains ?? []).some((domain) => {
      const candidate = domain.toLowerCase().replace(/^www\./, '');
      return hostname === candidate || hostname.endsWith(`.${candidate}`);
    }),
  );

  const chosen = matched ?? providers.find((provider) => provider.slug === 'generic');
  return chosen ? { id: chosen.id, slug: chosen.slug, name: chosen.name } : null;
}

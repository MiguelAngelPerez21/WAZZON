import 'server-only';

import { parsePrice } from '@/domain/money';
import { logger } from '@/lib/logger';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { OfferStatus } from '@/types/database';

export interface AdminOfferItem {
  id: string;
  productId: string;
  productTitle: string;
  providerName: string;
  currency: string;
  currentPrice: number | null;
  status: OfferStatus;
  expiresAt: string | null;
  lastCheckedAt: string | null;
}

interface RawAdminOffer {
  id: string;
  product_id: string;
  currency: string;
  current_price: string | number | null;
  status: OfferStatus;
  expires_at: string | null;
  last_checked_at: string | null;
  products: { title: string } | null;
  providers: { name: string } | null;
}

/**
 * Offers ordered by expiry, so the ones that need attention come first.
 * `expires_at` nulls last: an offer without an end date never needs review.
 */
export async function listAdminOffers(status?: OfferStatus): Promise<AdminOfferItem[]> {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from('offers')
    .select(
      `id, product_id, currency, current_price, status, expires_at, last_checked_at,
       products!offers_product_id_fkey ( title ),
       providers!offers_provider_id_fkey ( name )`,
    )
    .order('expires_at', { ascending: true, nullsFirst: false })
    .limit(200);

  if (status) query = query.eq('status', status);

  const { data, error } = await query.returns<RawAdminOffer[]>();

  if (error) {
    logger.error('admin.offers.list_failed', { error });
    throw new Error('No se han podido cargar las ofertas.');
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    productId: row.product_id,
    productTitle: row.products?.title ?? 'Producto',
    providerName: row.providers?.name ?? '—',
    currency: row.currency,
    currentPrice: parsePrice(row.current_price),
    status: row.status,
    expiresAt: row.expires_at,
    lastCheckedAt: row.last_checked_at,
  }));
}

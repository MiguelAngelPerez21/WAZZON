import 'server-only';

import { mapProduct, type ProductView, type RawProduct } from '@/domain/views';
import { logger } from '@/lib/logger';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { ProductStatus } from '@/types/database';

/**
 * Admin product reads.
 *
 * These use the cookie-bound client: RLS grants the extra visibility (drafts,
 * hidden, archived) only when the caller really is an admin.
 */

const ADMIN_PRODUCT_SELECT = `
  id, title, slug, short_description, description, status, featured, created_at, updated_at,
  published_at,
  category:categories!products_category_id_fkey ( id, name, slug ),
  images:product_images ( id, url, alt, position ),
  offers ( id, product_id, provider_id, market, currency, current_price, previous_price,
           discount_percentage, affiliate_url, original_url, canonical_url, coupon_code,
           coupon_description, starts_at, expires_at, status,
           provider:providers!offers_provider_id_fkey ( id, name, slug, allows_redirect_tracking ) )
`;

export interface AdminProductFilters {
  search?: string;
  status?: ProductStatus | 'all';
  categoryId?: string;
  featured?: boolean;
  sort?: 'recent' | 'title' | 'updated';
  page?: number;
  perPage?: number;
}

export interface AdminProductListItem extends ProductView {
  clicks: number;
}

export interface AdminProductPage {
  items: AdminProductListItem[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export async function listAdminProducts(
  filters: AdminProductFilters = {},
): Promise<AdminProductPage> {
  const supabase = await createSupabaseServerClient();
  const page = Math.max(1, filters.page ?? 1);
  const perPage = Math.min(100, Math.max(1, filters.perPage ?? 20));
  const from = (page - 1) * perPage;

  let query = supabase
    .from('products')
    .select(ADMIN_PRODUCT_SELECT, { count: 'exact' })
    .range(from, from + perPage - 1);

  if (filters.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  } else if (!filters.status) {
    // By default the archived (soft-deleted) products stay out of sight.
    query = query.neq('status', 'archived');
  }

  if (filters.categoryId) query = query.eq('category_id', filters.categoryId);
  if (filters.featured !== undefined) query = query.eq('featured', filters.featured);
  if (filters.search?.trim()) {
    const term = filters.search.trim().replace(/[%_,()]/g, ' ');
    query = query.ilike('title', `%${term}%`);
  }

  switch (filters.sort) {
    case 'title':
      query = query.order('title', { ascending: true });
      break;
    case 'updated':
      query = query.order('updated_at', { ascending: false });
      break;
    default:
      query = query.order('created_at', { ascending: false });
  }

  const { data, error, count } = await query.returns<RawProduct[]>();

  if (error) {
    logger.error('admin.products.list_failed', { error });
    throw new Error('No se han podido cargar los productos.');
  }

  const products = (data ?? []).map(mapProduct);
  const clicks = await getClickCounts(products.map((product) => product.id));

  const total = count ?? products.length;

  return {
    items: products.map((product) => ({ ...product, clicks: clicks.get(product.id) ?? 0 })),
    total,
    page,
    perPage,
    totalPages: Math.ceil(total / perPage),
  };
}

async function getClickCounts(productIds: string[]): Promise<Map<string, number>> {
  if (productIds.length === 0) return new Map();

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('analytics_product_click_counts', {
    p_product_ids: productIds,
  });

  if (error) {
    logger.warn('admin.products.clicks_failed', { error });
    return new Map();
  }

  return new Map((data ?? []).map((row) => [row.product_id, Number(row.clicks)]));
}

export async function getAdminProduct(id: string): Promise<ProductView | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('products')
    .select(ADMIN_PRODUCT_SELECT)
    .eq('id', id)
    .maybeSingle<RawProduct>();

  if (error) {
    logger.error('admin.products.get_failed', { error, id });
    throw new Error('No se ha podido cargar el producto.');
  }

  return data ? mapProduct(data) : null;
}

/** Slugs already in use, for collision-free slug generation. */
export async function getTakenSlugs(base: string): Promise<Set<string>> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('products')
    .select('slug')
    .like('slug', `${base}%`)
    .limit(200);

  if (error) {
    logger.warn('admin.products.slug_lookup_failed', { error });
    return new Set();
  }

  return new Set((data ?? []).map((row) => row.slug));
}

import { isSupabaseConfigured } from '@/lib/env';
import { logger } from '@/lib/logger';
import { supabasePublic } from '@/lib/supabase/public';
import {
  mapCategory,
  mapProduct,
  type CategoryView,
  type ProductView,
  type ProviderView,
  mapProvider,
  type RawProduct,
} from '@/domain/views';

/**
 * Public catalog reads.
 *
 * Always goes through the anonymous client, so what is returned here is exactly
 * what RLS exposes to a visitor — a signed-in admin can never leak drafts into
 * a cached public page.
 *
 * When Supabase is not configured (fresh clone, CI build without secrets) these
 * functions return empty results instead of throwing, so `next build` works.
 */

const PRODUCT_CARD_SELECT = `
  id, title, slug, short_description, status, featured, created_at, updated_at, published_at,
  category:categories!products_category_id_fkey ( id, name, slug ),
  images:product_images ( id, url, alt, position ),
  offers ( id, product_id, provider_id, market, currency, current_price, previous_price,
           discount_percentage, affiliate_url, original_url, canonical_url, coupon_code,
           coupon_description, starts_at, expires_at, status,
           provider:providers!offers_provider_id_fkey ( id, name, slug, allows_redirect_tracking ) )
`;

const PRODUCT_DETAIL_SELECT = `
  id, title, slug, short_description, description, status, featured, created_at, updated_at,
  published_at,
  category:categories!products_category_id_fkey ( id, name, slug ),
  images:product_images ( id, url, alt, position ),
  offers ( id, product_id, provider_id, market, currency, current_price, previous_price,
           discount_percentage, affiliate_url, original_url, canonical_url, coupon_code,
           coupon_description, starts_at, expires_at, status,
           provider:providers!offers_provider_id_fkey ( id, name, slug, allows_redirect_tracking ) )
`;

export type CatalogSort = 'recent' | 'price_asc' | 'price_desc' | 'popular';

export interface CatalogQuery {
  categoryId?: string | null;
  providerId?: string | null;
  search?: string | null;
  featured?: boolean | null;
  withOfferOnly?: boolean;
  minPrice?: number | null;
  maxPrice?: number | null;
  sort?: CatalogSort;
  page?: number;
  perPage?: number;
}

export interface CatalogPage {
  products: ProductView[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

const EMPTY_PAGE: CatalogPage = { products: [], total: 0, page: 1, perPage: 24, totalPages: 0 };

function isActiveOffer(offer: ProductView['offers'][number]): boolean {
  if (offer.status !== 'active') return false;
  const now = Date.now();
  if (offer.startsAt && new Date(offer.startsAt).getTime() > now) return false;
  if (offer.expiresAt && new Date(offer.expiresAt).getTime() <= now) return false;
  return true;
}

/** Keeps only offers a visitor should see; RLS already filtered most of them. */
function withVisibleOffers(product: ProductView): ProductView {
  return { ...product, offers: product.offers.filter(isActiveOffer) };
}

export async function listCatalogProducts(query: CatalogQuery = {}): Promise<CatalogPage> {
  const page = Math.max(1, query.page ?? 1);
  const perPage = Math.min(60, Math.max(1, query.perPage ?? 24));

  if (!isSupabaseConfigured) return { ...EMPTY_PAGE, page, perPage };

  const { data: ids, error } = await supabasePublic.rpc('list_catalog_products', {
    p_category_id: query.categoryId ?? null,
    p_provider_id: query.providerId ?? null,
    p_query: query.search ?? null,
    p_featured: query.featured ?? null,
    p_with_offer: query.withOfferOnly ?? false,
    p_min_price: query.minPrice ?? null,
    p_max_price: query.maxPrice ?? null,
    p_sort: query.sort ?? 'recent',
    p_limit: perPage,
    p_offset: (page - 1) * perPage,
  });

  if (error) {
    logger.error('catalog.list_failed', { error });
    throw new Error('No se ha podido cargar el catálogo.');
  }

  const rows = ids ?? [];
  if (rows.length === 0) return { ...EMPTY_PAGE, page, perPage };

  const orderedIds = rows.map((row) => row.product_id);
  const total = Number(rows[0]?.total_count ?? 0);

  const { data: products, error: productsError } = await supabasePublic
    .from('products')
    .select(PRODUCT_CARD_SELECT)
    .in('id', orderedIds)
    .returns<RawProduct[]>();

  if (productsError) {
    logger.error('catalog.hydrate_failed', { error: productsError });
    throw new Error('No se ha podido cargar el catálogo.');
  }

  const byId = new Map((products ?? []).map((row) => [row.id, mapProduct(row)]));
  const ordered = orderedIds
    .map((id) => byId.get(id))
    .filter((product): product is ProductView => product !== undefined)
    .map(withVisibleOffers);

  return {
    products: ordered,
    total,
    page,
    perPage,
    totalPages: Math.ceil(total / perPage),
  };
}

export async function getProductBySlug(slug: string): Promise<ProductView | null> {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await supabasePublic
    .from('products')
    .select(PRODUCT_DETAIL_SELECT)
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle<RawProduct>();

  if (error) {
    logger.error('catalog.product_failed', { error, slug });
    throw new Error('No se ha podido cargar el producto.');
  }

  return data ? withVisibleOffers(mapProduct(data)) : null;
}

export async function listActiveCategories(): Promise<CategoryView[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabasePublic
    .from('categories')
    .select(
      'id, name, slug, description, image_url, icon, seo_title, seo_description, active, sort_order',
    )
    .eq('active', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    logger.error('catalog.categories_failed', { error });
    return [];
  }

  return (data ?? []).map(mapCategory);
}

export async function getCategoryBySlug(slug: string): Promise<CategoryView | null> {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await supabasePublic
    .from('categories')
    .select(
      'id, name, slug, description, image_url, icon, seo_title, seo_description, active, sort_order',
    )
    .eq('slug', slug)
    .eq('active', true)
    .maybeSingle();

  if (error) {
    logger.error('catalog.category_failed', { error, slug });
    return null;
  }

  return data ? mapCategory(data) : null;
}

export async function listActiveProviders(): Promise<ProviderView[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabasePublic
    .from('providers')
    .select('id, name, slug, domains, allows_redirect_tracking, active')
    .eq('active', true)
    .order('name');

  if (error) {
    logger.error('catalog.providers_failed', { error });
    return [];
  }

  return (data ?? []).map(mapProvider);
}

/** Slugs for the sitemap. Capped: the sitemap is regenerated periodically. */
export async function listPublishedProductSlugs(
  limit = 5000,
): Promise<{ slug: string; updatedAt: string }[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabasePublic
    .from('products')
    .select('slug, updated_at')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(limit);

  if (error) {
    logger.error('catalog.slugs_failed', { error });
    return [];
  }

  return (data ?? []).map((row) => ({ slug: row.slug, updatedAt: row.updated_at }));
}

/** Related products: same category, excluding the current product. */
export async function listRelatedProducts(
  categoryId: string | null,
  excludeProductId: string,
  limit = 4,
): Promise<ProductView[]> {
  if (!categoryId) return [];

  const { products } = await listCatalogProducts({
    categoryId,
    perPage: limit + 1,
    sort: 'recent',
  });

  return products.filter((product) => product.id !== excludeProductId).slice(0, limit);
}

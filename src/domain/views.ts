import { calculateDiscountPercentage } from '@/domain/discount';
import { parsePrice } from '@/domain/money';
import type { OfferStatus, ProductStatus } from '@/types/database';

/**
 * View models.
 *
 * The database speaks snake_case and serialises `numeric` as strings; the UI
 * speaks camelCase and numbers. The mapping happens here, once, so no component
 * ever has to know about PostgREST quirks.
 */

export interface CategoryView {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  icon: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  active: boolean;
  sortOrder: number;
}

export interface ProviderView {
  id: string;
  name: string;
  slug: string;
  domains: string[];
  allowsRedirectTracking: boolean;
  active: boolean;
}

export interface ProductImageView {
  id: string;
  url: string;
  alt: string | null;
  position: number;
}

export interface OfferView {
  id: string;
  productId: string;
  providerId: string;
  provider: Pick<ProviderView, 'id' | 'name' | 'slug' | 'allowsRedirectTracking'> | null;
  market: string;
  currency: string;
  currentPrice: number | null;
  previousPrice: number | null;
  discountPercentage: number | null;
  affiliateUrl: string;
  originalUrl: string | null;
  canonicalUrl: string | null;
  couponCode: string | null;
  couponDescription: string | null;
  startsAt: string | null;
  expiresAt: string | null;
  status: OfferStatus;
}

export interface ProductView {
  id: string;
  title: string;
  slug: string;
  shortDescription: string | null;
  description: string | null;
  status: ProductStatus;
  featured: boolean;
  category: Pick<CategoryView, 'id' | 'name' | 'slug'> | null;
  images: ProductImageView[];
  offers: OfferView[];
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

// ---------------------------------------------------------------------------
// Raw row shapes returned by the queries in `src/repositories`
// ---------------------------------------------------------------------------

export interface RawCategory {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  image_url?: string | null;
  icon?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  active?: boolean;
  sort_order?: number;
}

export interface RawProvider {
  id: string;
  name: string;
  slug: string;
  domains?: string[] | null;
  allows_redirect_tracking?: boolean;
  active?: boolean;
}

export interface RawOffer {
  id: string;
  product_id: string;
  provider_id: string;
  market: string;
  currency: string;
  current_price: string | number | null;
  previous_price: string | number | null;
  discount_percentage: number | null;
  affiliate_url: string;
  original_url: string | null;
  canonical_url?: string | null;
  coupon_code: string | null;
  coupon_description: string | null;
  starts_at: string | null;
  expires_at: string | null;
  status: OfferStatus;
  provider?: RawProvider | null;
}

export interface RawProduct {
  id: string;
  title: string;
  slug: string;
  short_description: string | null;
  description?: string | null;
  status: ProductStatus;
  featured: boolean;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  category?: RawCategory | null;
  images?: { id: string; url: string; alt: string | null; position: number }[] | null;
  offers?: RawOffer[] | null;
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

export function mapCategory(row: RawCategory): CategoryView {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description ?? null,
    imageUrl: row.image_url ?? null,
    icon: row.icon ?? null,
    seoTitle: row.seo_title ?? null,
    seoDescription: row.seo_description ?? null,
    active: row.active ?? true,
    sortOrder: row.sort_order ?? 0,
  };
}

export function mapProvider(row: RawProvider): ProviderView {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    domains: row.domains ?? [],
    allowsRedirectTracking: row.allows_redirect_tracking ?? false,
    active: row.active ?? true,
  };
}

export function mapOffer(row: RawOffer): OfferView {
  const currentPrice = parsePrice(row.current_price);
  const previousPrice = parsePrice(row.previous_price);

  return {
    id: row.id,
    productId: row.product_id,
    providerId: row.provider_id,
    provider: row.provider
      ? {
          id: row.provider.id,
          name: row.provider.name,
          slug: row.provider.slug,
          allowsRedirectTracking: row.provider.allows_redirect_tracking ?? false,
        }
      : null,
    market: row.market,
    currency: row.currency,
    currentPrice,
    previousPrice,
    // Trust the generated column, but recompute as a fallback for previews.
    discountPercentage:
      row.discount_percentage ?? calculateDiscountPercentage(currentPrice, previousPrice),
    affiliateUrl: row.affiliate_url,
    originalUrl: row.original_url,
    canonicalUrl: row.canonical_url ?? null,
    couponCode: row.coupon_code,
    couponDescription: row.coupon_description,
    startsAt: row.starts_at,
    expiresAt: row.expires_at,
    status: row.status,
  };
}

export function mapProduct(row: RawProduct): ProductView {
  const images = (row.images ?? [])
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((image) => ({
      id: image.id,
      url: image.url,
      alt: image.alt,
      position: image.position,
    }));

  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    shortDescription: row.short_description,
    description: row.description ?? null,
    status: row.status,
    featured: row.featured,
    category: row.category
      ? { id: row.category.id, name: row.category.name, slug: row.category.slug }
      : null,
    images,
    offers: (row.offers ?? []).map(mapOffer),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
  };
}

/**
 * The offer shown on cards and product pages: the cheapest active one, falling
 * back to the first available. Returns `null` when there is none — the UI then
 * shows no price at all instead of a placeholder.
 */
export function primaryOffer(product: ProductView): OfferView | null {
  const active = product.offers.filter((offer) => offer.status === 'active');
  const pool = active.length > 0 ? active : product.offers;
  if (pool.length === 0) return null;

  const priced = pool.filter((offer) => offer.currentPrice !== null);
  if (priced.length === 0) return pool[0] ?? null;

  return priced.reduce((best, offer) =>
    (offer.currentPrice ?? Infinity) < (best.currentPrice ?? Infinity) ? offer : best,
  );
}

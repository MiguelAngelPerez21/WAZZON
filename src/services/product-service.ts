import 'server-only';

import { toDbPrice } from '@/domain/money';
import { slugify, uniqueSlug } from '@/domain/slug';
import { logger } from '@/lib/logger';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getTakenSlugs } from '@/repositories/admin/products';
import { buildDedupeKey } from '@/services/duplicates';
import { resolveDefaultProviderId } from '@/services/providers';
import type { ProductStatus } from '@/types/database';
import type { OfferInput, ProductInput } from '@/validation/product';

/**
 * Product write model.
 *
 * PostgREST has no multi-statement transaction, so a create spans three calls
 * (product → offer → images). Failures are compensated explicitly: if the offer
 * or the images cannot be written, the product row is removed again (its
 * children cascade), leaving no half-created record behind.
 */

export interface SaveProductResult {
  productId: string;
  slug: string;
}

export class ProductServiceError extends Error {
  readonly field?: string;

  constructor(message: string, field?: string) {
    super(message);
    this.name = 'ProductServiceError';
    if (field !== undefined) this.field = field;
  }
}

async function resolveSlug(
  desired: string | undefined,
  title: string,
  currentSlug?: string,
): Promise<string> {
  const base = desired?.trim() ? slugify(desired) : slugify(title);
  if (!base) throw new ProductServiceError('No se ha podido generar el slug.', 'slug');
  if (base === currentSlug) return base;

  const taken = await getTakenSlugs(base);
  taken.delete(currentSlug ?? '');
  return uniqueSlug(base, taken);
}

/**
 * `providerId` is passed in rather than read from `offer`: the admin form no
 * longer submits a store, so it is resolved server-side (Temu) and can never
 * be influenced by the client.
 */
function offerRow(offer: OfferInput, productId: string, providerId: string) {
  return {
    product_id: productId,
    provider_id: providerId,
    market: offer.market,
    currency: offer.currency,
    current_price: toDbPrice(offer.currentPrice),
    previous_price: toDbPrice(offer.previousPrice),
    affiliate_url: offer.affiliateUrl,
    original_url: offer.originalUrl,
    canonical_url: offer.canonicalUrl,
    dedupe_key: buildDedupeKey({
      affiliateUrl: offer.affiliateUrl,
      originalUrl: offer.originalUrl,
      canonicalUrl: offer.canonicalUrl,
    }),
    coupon_code: offer.couponCode,
    coupon_description: offer.couponDescription,
    starts_at: offer.startsAt,
    expires_at: offer.expiresAt,
    status: offer.status,
    last_checked_at: new Date().toISOString(),
  };
}

function publishedAtFor(status: ProductStatus, current: string | null): string | null {
  if (status !== 'published') return current;
  return current ?? new Date().toISOString();
}

export async function createProductWithOffer(
  product: ProductInput,
  offer: OfferInput,
  createdBy: string,
): Promise<SaveProductResult> {
  const supabase = await createSupabaseServerClient();
  const slug = await resolveSlug(product.slug, product.title);
  // Resolved before the product insert so a missing provider fails cleanly,
  // without leaving a product row to compensate for.
  const providerId = await resolveDefaultProviderId();

  const { data: created, error: productError } = await supabase
    .from('products')
    .insert({
      title: product.title,
      slug,
      short_description: product.shortDescription,
      description: product.description,
      category_id: product.categoryId,
      status: product.status,
      featured: product.featured,
      created_by: createdBy,
      published_at: publishedAtFor(product.status, null),
    })
    .select('id, slug')
    .single();

  if (productError || !created) {
    logger.error('product.create_failed', { error: productError });
    throw new ProductServiceError('No se ha podido crear el producto.');
  }

  try {
    const { error: offerError } = await supabase
      .from('offers')
      .insert(offerRow(offer, created.id, providerId));
    if (offerError) {
      logger.error('product.create_offer_failed', { error: offerError });
      throw new ProductServiceError('No se ha podido guardar la oferta.', 'affiliateUrl');
    }

    await replaceImages(created.id, product.images);
  } catch (error) {
    // Compensating action: never leave a product without its offer.
    await supabase.from('products').delete().eq('id', created.id);
    throw error;
  }

  return { productId: created.id, slug: created.slug };
}

export async function updateProductWithOffer(
  productId: string,
  product: ProductInput,
  offer: OfferInput & { id?: string },
): Promise<SaveProductResult> {
  const supabase = await createSupabaseServerClient();

  const { data: existing, error: loadError } = await supabase
    .from('products')
    .select('id, slug, published_at')
    .eq('id', productId)
    .maybeSingle();

  if (loadError || !existing) {
    throw new ProductServiceError('El producto no existe.');
  }

  const slug = await resolveSlug(product.slug, product.title, existing.slug);

  const { error: updateError } = await supabase
    .from('products')
    .update({
      title: product.title,
      slug,
      short_description: product.shortDescription,
      description: product.description,
      category_id: product.categoryId,
      status: product.status,
      featured: product.featured,
      published_at: publishedAtFor(product.status, existing.published_at),
    })
    .eq('id', productId);

  if (updateError) {
    logger.error('product.update_failed', { error: updateError, productId });
    throw new ProductServiceError('No se ha podido actualizar el producto.');
  }

  if (offer.id) {
    // An existing offer keeps whatever store it was filed under: the editor no
    // longer chooses one, so a save must not silently re-attribute old data.
    const { data: currentOffer } = await supabase
      .from('offers')
      .select('provider_id')
      .eq('id', offer.id)
      .maybeSingle();

    const providerId = currentOffer?.provider_id ?? (await resolveDefaultProviderId());
    const row = offerRow(offer, productId, providerId);

    const { error: offerError } = await supabase.from('offers').update(row).eq('id', offer.id);
    if (offerError) {
      logger.error('product.update_offer_failed', { error: offerError, productId });
      throw new ProductServiceError('No se ha podido actualizar la oferta.', 'affiliateUrl');
    }
  } else {
    const row = offerRow(offer, productId, await resolveDefaultProviderId());

    const { error: offerError } = await supabase.from('offers').insert(row);
    if (offerError) {
      logger.error('product.insert_offer_failed', { error: offerError, productId });
      throw new ProductServiceError('No se ha podido guardar la oferta.', 'affiliateUrl');
    }
  }

  await replaceImages(productId, product.images);

  return { productId, slug };
}

async function replaceImages(
  productId: string,
  images: { url: string; alt: string | null }[],
): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { error: deleteError } = await supabase
    .from('product_images')
    .delete()
    .eq('product_id', productId);

  if (deleteError) {
    logger.error('product.images_clear_failed', { error: deleteError, productId });
    throw new ProductServiceError('No se han podido actualizar las imágenes.');
  }

  if (images.length === 0) return;

  const { error: insertError } = await supabase.from('product_images').insert(
    images.map((image, index) => ({
      product_id: productId,
      url: image.url,
      alt: image.alt,
      position: index,
    })),
  );

  if (insertError) {
    logger.error('product.images_insert_failed', { error: insertError, productId });
    throw new ProductServiceError('No se han podido guardar las imágenes.');
  }
}

export async function setProductStatus(ids: string[], status: ProductStatus): Promise<void> {
  if (ids.length === 0) return;
  const supabase = await createSupabaseServerClient();

  // The `products_published_needs_timestamp` constraint requires published_at
  // to be set *before* the status flips, and it must not be rewritten for
  // products that were already published once.
  if (status === 'published') {
    const { error: stampError } = await supabase
      .from('products')
      .update({ published_at: new Date().toISOString() })
      .in('id', ids)
      .is('published_at', null);

    if (stampError) {
      logger.error('product.publish_stamp_failed', { error: stampError });
      throw new ProductServiceError('No se ha podido publicar el producto.');
    }
  }

  const { error } = await supabase.from('products').update({ status }).in('id', ids);

  if (error) {
    logger.error('product.status_update_failed', { error });
    throw new ProductServiceError('No se ha podido cambiar el estado.');
  }
}

export async function setProductsFeatured(ids: string[], featured: boolean): Promise<void> {
  if (ids.length === 0) return;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from('products').update({ featured }).in('id', ids);
  if (error) {
    logger.error('product.featured_update_failed', { error });
    throw new ProductServiceError('No se ha podido actualizar el destacado.');
  }
}

export async function setProductsCategory(ids: string[], categoryId: string): Promise<void> {
  if (ids.length === 0) return;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('products')
    .update({ category_id: categoryId })
    .in('id', ids);
  if (error) {
    logger.error('product.category_update_failed', { error });
    throw new ProductServiceError('No se ha podido cambiar la categoría.');
  }
}

/** Hard delete. The admin UI always asks for confirmation first. */
export async function deleteProducts(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from('products').delete().in('id', ids);
  if (error) {
    logger.error('product.delete_failed', { error });
    throw new ProductServiceError('No se han podido eliminar los productos.');
  }
}

/** Duplicates a product (and its first offer) as a fresh draft. */
export async function duplicateProduct(productId: string): Promise<SaveProductResult> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('products')
    .select(
      `id, title, short_description, description, category_id, featured,
       images:product_images ( url, alt, position ),
       offers ( provider_id, market, currency, current_price, previous_price, affiliate_url,
                original_url, canonical_url, coupon_code, coupon_description, status )`,
    )
    .eq('id', productId)
    .maybeSingle();

  if (error || !data) {
    throw new ProductServiceError('El producto no existe.');
  }

  const slug = await resolveSlug(undefined, `${data.title} copia`);

  const { data: created, error: insertError } = await supabase
    .from('products')
    .insert({
      title: `${data.title} (copia)`,
      slug,
      short_description: data.short_description,
      description: data.description,
      category_id: data.category_id,
      featured: false,
      status: 'draft',
    })
    .select('id, slug')
    .single();

  if (insertError || !created) {
    logger.error('product.duplicate_failed', { error: insertError, productId });
    throw new ProductServiceError('No se ha podido duplicar el producto.');
  }

  const source = data.offers?.[0];
  if (source) {
    await supabase.from('offers').insert({
      product_id: created.id,
      provider_id: source.provider_id,
      market: source.market,
      currency: source.currency,
      current_price: source.current_price,
      previous_price: source.previous_price,
      affiliate_url: source.affiliate_url,
      original_url: source.original_url,
      canonical_url: source.canonical_url,
      dedupe_key: buildDedupeKey({
        affiliateUrl: source.affiliate_url,
        originalUrl: source.original_url,
        canonicalUrl: source.canonical_url,
      }),
      coupon_code: source.coupon_code,
      coupon_description: source.coupon_description,
      status: 'draft',
    });
  }

  if (data.images && data.images.length > 0) {
    await supabase.from('product_images').insert(
      data.images.map((image, index) => ({
        product_id: created.id,
        url: image.url,
        alt: image.alt,
        position: index,
      })),
    );
  }

  return { productId: created.id, slug: created.slug };
}

/** Flips offers whose window has closed. Products are left untouched. */
export async function expireStaleOffers(): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('expire_stale_offers');

  if (error) {
    logger.error('offers.expire_failed', { error });
    throw new ProductServiceError('No se han podido actualizar las ofertas caducadas.');
  }

  return data ?? 0;
}

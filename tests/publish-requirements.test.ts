import { describe, expect, it } from 'vitest';

import { productWithOfferSchema } from '@/validation/product';

/**
 * Publishing rules (Quick Add assisted manual entry).
 *
 * Only title, category, affiliate URL, current price and one image are
 * required to publish. Description, previous price, coupon and dates are
 * optional, and the currency comes from settings. A draft may be incomplete —
 * that is what a draft is for.
 */

const baseProduct = {
  title: 'Mini aspirador para coche',
  slug: undefined,
  categoryId: '11111111-1111-1111-1111-111111111111',
  shortDescription: undefined,
  description: undefined,
  images: [{ url: 'https://img.kwcdn.com/product/abc.jpg', alt: undefined }],
  featured: undefined,
  status: 'published',
};

const baseOffer = {
  affiliateUrl: 'https://temu.to/k/abc123',
  originalUrl: undefined,
  canonicalUrl: undefined,
  market: 'ES',
  currency: 'EUR',
  currentPrice: '12,99',
  previousPrice: undefined,
  couponCode: undefined,
  couponDescription: undefined,
  startsAt: undefined,
  expiresAt: undefined,
  status: 'active',
};

function parse(product: object, offer: object) {
  return productWithOfferSchema.safeParse({
    product: { ...baseProduct, ...product },
    offer: { ...baseOffer, ...offer },
  });
}

function messages(result: ReturnType<typeof parse>): string[] {
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

describe('productWithOfferSchema publishing rules', () => {
  it('publishes with only the mandatory fields filled in by hand', () => {
    expect(parse({}, {}).success).toBe(true);
  });

  it('does not require description, previous price, coupon or dates', () => {
    const result = parse(
      { shortDescription: '', description: '' },
      { previousPrice: '', couponCode: '', couponDescription: '', startsAt: '', expiresAt: '' },
    );

    expect(result.success).toBe(true);
  });

  it('refuses to publish without a current price', () => {
    const result = parse({}, { currentPrice: '' });

    expect(result.success).toBe(false);
    expect(messages(result)).toContain('Indica el precio actual para poder publicar.');
  });

  it('refuses to publish without an image', () => {
    const result = parse({ images: [] }, {});

    expect(result.success).toBe(false);
    expect(messages(result)).toContain('Añade al menos una imagen para poder publicar.');
  });

  it('reports the price and image problems against the right form fields', () => {
    const result = parse({ images: [] }, { currentPrice: '' });

    expect(result.success).toBe(false);
    const paths = result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'));
    expect(paths).toContain('offer.currentPrice');
    expect(paths).toContain('product.images');
  });

  it('still saves an incomplete draft', () => {
    const result = parse({ status: 'draft', images: [] }, { currentPrice: '' });

    expect(result.success).toBe(true);
  });

  it('accepts an image hosted in our own Supabase Storage bucket', () => {
    const result = parse(
      {
        images: [
          {
            url: 'https://project.supabase.co/storage/v1/object/public/product-images/a.jpg',
            alt: undefined,
          },
        ],
      },
      {},
    );

    expect(result.success).toBe(true);
  });
});

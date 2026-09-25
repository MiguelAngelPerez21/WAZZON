import { describe, expect, it } from 'vitest';

import {
  mapOffer,
  mapProduct,
  primaryOffer,
  type ProductView,
  type RawOffer,
  type RawProduct,
} from '@/domain/views';

function rawOffer(overrides: Partial<RawOffer> = {}): RawOffer {
  return {
    id: 'offer-1',
    product_id: 'product-1',
    provider_id: 'provider-1',
    market: 'ES',
    currency: 'EUR',
    current_price: '19.99',
    previous_price: '39.99',
    discount_percentage: 50,
    affiliate_url: 'https://tienda.example.com/a',
    original_url: null,
    coupon_code: null,
    coupon_description: null,
    starts_at: null,
    expires_at: null,
    status: 'active',
    ...overrides,
  };
}

function rawProduct(overrides: Partial<RawProduct> = {}): RawProduct {
  return {
    id: 'product-1',
    title: 'Auriculares',
    slug: 'auriculares',
    short_description: null,
    status: 'published',
    featured: false,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
    published_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('mapOffer', () => {
  it('converts PostgREST numeric strings into numbers', () => {
    const offer = mapOffer(rawOffer());
    expect(offer.currentPrice).toBe(19.99);
    expect(offer.previousPrice).toBe(39.99);
    expect(offer.discountPercentage).toBe(50);
  });

  it('keeps null prices null instead of defaulting to zero', () => {
    const offer = mapOffer(
      rawOffer({ current_price: null, previous_price: null, discount_percentage: null }),
    );
    expect(offer.currentPrice).toBeNull();
    expect(offer.previousPrice).toBeNull();
    expect(offer.discountPercentage).toBeNull();
  });

  it('recomputes the discount when the generated column is absent', () => {
    const offer = mapOffer(
      rawOffer({ discount_percentage: null, current_price: '10', previous_price: '25' }),
    );
    expect(offer.discountPercentage).toBe(60);
  });

  it('maps the joined provider or leaves it null', () => {
    expect(mapOffer(rawOffer()).provider).toBeNull();
    const withProvider = mapOffer(
      rawOffer({
        provider: {
          id: 'provider-1',
          name: 'Tienda',
          slug: 'tienda',
          allows_redirect_tracking: true,
        },
      }),
    );
    expect(withProvider.provider?.allowsRedirectTracking).toBe(true);
  });
});

describe('mapProduct', () => {
  it('sorts images by position and defaults missing relations', () => {
    const product = mapProduct(
      rawProduct({
        images: [
          { id: 'b', url: 'https://cdn.example.com/b.jpg', alt: null, position: 2 },
          { id: 'a', url: 'https://cdn.example.com/a.jpg', alt: 'A', position: 1 },
        ],
      }),
    );

    expect(product.images.map((image) => image.id)).toEqual(['a', 'b']);
    expect(product.offers).toEqual([]);
    expect(product.category).toBeNull();
  });
});

describe('primaryOffer', () => {
  const product = (offers: RawOffer[]): ProductView => mapProduct(rawProduct({ offers }));

  it('returns null when there is no offer, so the UI shows no price', () => {
    expect(primaryOffer(product([]))).toBeNull();
  });

  it('picks the cheapest active offer', () => {
    const result = primaryOffer(
      product([
        rawOffer({ id: 'a', current_price: '30' }),
        rawOffer({ id: 'b', current_price: '12.50' }),
        rawOffer({ id: 'c', current_price: '20' }),
      ]),
    );
    expect(result?.id).toBe('b');
  });

  it('ignores expired offers while an active one exists', () => {
    const result = primaryOffer(
      product([
        rawOffer({ id: 'expired', current_price: '1', status: 'expired' }),
        rawOffer({ id: 'active', current_price: '99' }),
      ]),
    );
    expect(result?.id).toBe('active');
  });

  it('falls back to a non-active offer when none is active', () => {
    const result = primaryOffer(
      product([rawOffer({ id: 'only', current_price: '5', status: 'expired' })]),
    );
    expect(result?.id).toBe('only');
  });

  it('falls back to the first offer when no price is known', () => {
    const result = primaryOffer(
      product([
        rawOffer({ id: 'first', current_price: null }),
        rawOffer({ id: 'second', current_price: null }),
      ]),
    );
    expect(result?.id).toBe('first');
  });
});

import { describe, expect, it } from 'vitest';

import { offerInputSchema, productWithOfferSchema } from '@/validation/product';

/**
 * The admin form no longer asks which store a product belongs to: this site
 * publishes Temu exclusively and `offers.provider_id` is resolved server-side
 * (see `src/services/providers.ts`).
 *
 * These tests guard the boundary in both directions: the schema must accept a
 * payload with no provider, and it must not let the browser smuggle one in.
 */

const validOffer = {
  affiliateUrl: 'https://www.temu.com/es/product-g-601099512345678.html',
  originalUrl: undefined,
  canonicalUrl: undefined,
  market: 'ES',
  currency: 'EUR',
  currentPrice: '12,99',
  previousPrice: '19,99',
  couponCode: undefined,
  couponDescription: undefined,
  startsAt: undefined,
  expiresAt: undefined,
  status: 'active',
};

describe('offerInputSchema', () => {
  it('accepts an offer submitted without any provider', () => {
    const result = offerInputSchema.safeParse(validOffer);

    expect(result.success).toBe(true);
  });

  it('never exposes a provider field on the parsed output', () => {
    const result = offerInputSchema.parse(validOffer);

    expect(result).not.toHaveProperty('providerId');
    expect(result).not.toHaveProperty('provider_id');
  });

  it('strips a provider sent by the client instead of trusting it', () => {
    const result = offerInputSchema.parse({
      ...validOffer,
      providerId: '00000000-0000-0000-0000-0000000000ff',
    });

    expect(result).not.toHaveProperty('providerId');
  });

  it('does not report a missing store when the rest of the offer is valid', () => {
    const result = productWithOfferSchema.safeParse({
      product: {
        title: 'Auriculares inalámbricos',
        slug: undefined,
        categoryId: '11111111-1111-1111-1111-111111111111',
        shortDescription: undefined,
        description: undefined,
        images: [],
        featured: undefined,
        status: 'draft',
      },
      offer: validOffer,
    });

    expect(result.success).toBe(true);
  });
});

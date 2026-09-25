import { z } from 'zod';

import {
  checkboxSchema,
  currencySchema,
  marketSchema,
  optionalDateSchema,
  optionalPublicUrlSchema,
  optionalSlugSchema,
  optionalText,
  priceSchema,
  publicUrlSchema,
  uuidSchema,
} from '@/validation/common';

export const productStatusSchema = z.enum(['draft', 'published', 'hidden', 'archived']);
export const offerStatusSchema = z.enum(['draft', 'active', 'expired', 'hidden']);

export const productImageSchema = z.object({
  url: z.string().trim().url('URL de imagen no válida.').max(2048),
  alt: optionalText(200),
});

export const offerInputSchema = z
  .object({
    // No `providerId`: the store is not an editorial decision any more. The
    // write path resolves it from `DEFAULT_PROVIDER_SLUG`, so the browser can
    // never choose (or forge) which provider an offer is attributed to.
    affiliateUrl: publicUrlSchema,
    originalUrl: optionalPublicUrlSchema,
    canonicalUrl: optionalPublicUrlSchema,
    market: marketSchema,
    currency: currencySchema,
    currentPrice: priceSchema,
    previousPrice: priceSchema,
    couponCode: optionalText(64),
    couponDescription: optionalText(200),
    startsAt: optionalDateSchema,
    expiresAt: optionalDateSchema,
    status: offerStatusSchema,
  })
  .superRefine((value, ctx) => {
    if (
      value.previousPrice !== null &&
      value.currentPrice !== null &&
      value.previousPrice <= value.currentPrice
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['previousPrice'],
        message: 'El precio anterior debe ser mayor que el actual.',
      });
    }

    if (value.previousPrice !== null && value.currentPrice === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['currentPrice'],
        message: 'Indica el precio actual para poder calcular el descuento.',
      });
    }

    if (
      value.startsAt &&
      value.expiresAt &&
      new Date(value.expiresAt) <= new Date(value.startsAt)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['expiresAt'],
        message: 'La fecha de fin debe ser posterior a la de inicio.',
      });
    }

    if (value.couponDescription && !value.couponCode) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['couponCode'],
        message: 'Indica el código del cupón.',
      });
    }
  });

export type OfferInput = z.infer<typeof offerInputSchema>;

export const productInputSchema = z.object({
  title: z.string().trim().min(3, 'El título es obligatorio.').max(180, 'Máximo 180 caracteres.'),
  // Same contract as categories: empty means "derive it from the title".
  slug: optionalSlugSchema,
  categoryId: uuidSchema,
  shortDescription: optionalText(300),
  description: optionalText(20_000),
  images: z.array(productImageSchema).max(10, 'Máximo 10 imágenes.').default([]),
  featured: checkboxSchema,
  status: productStatusSchema,
});

export type ProductInput = z.infer<typeof productInputSchema>;

/**
 * Minimum a product needs before it goes live.
 *
 * Everything else — description, previous price, coupon, dates — is genuinely
 * optional, and the currency falls back to the configured default, so an offer
 * whose metadata could not be imported can still be published entirely by
 * hand. Drafts are exempt on purpose: saving an incomplete draft is the whole
 * point of a draft.
 */
function requirePublishableFields(
  value: { product: { status: string; images: unknown[] }; offer: { currentPrice: number | null } },
  ctx: z.RefinementCtx,
): void {
  if (value.product.status !== 'published') return;

  if (value.offer.currentPrice === null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['offer', 'currentPrice'],
      message: 'Indica el precio actual para poder publicar.',
    });
  }

  if (value.product.images.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['product', 'images'],
      message: 'Añade al menos una imagen para poder publicar.',
    });
  }
}

/** Quick Add and the full form both submit a product together with one offer. */
export const productWithOfferSchema = z
  .object({
    product: productInputSchema,
    offer: offerInputSchema,
  })
  .superRefine(requirePublishableFields);

export type ProductWithOfferInput = z.infer<typeof productWithOfferSchema>;

export const productUpdateSchema = z
  .object({
    id: uuidSchema,
    product: productInputSchema,
    offer: offerInputSchema.and(z.object({ id: uuidSchema.optional() })),
  })
  .superRefine(requirePublishableFields);

export const bulkActionSchema = z.object({
  ids: z.array(uuidSchema).min(1, 'Selecciona al menos un producto.').max(200),
  action: z.enum(['publish', 'hide', 'feature', 'unfeature', 'archive', 'set_category']),
  categoryId: uuidSchema.optional(),
});

export type BulkActionInput = z.infer<typeof bulkActionSchema>;

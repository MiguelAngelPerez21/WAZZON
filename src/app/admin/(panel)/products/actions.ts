'use server';

import { revalidatePath } from 'next/cache';

import { errorState, type ActionState } from '@/lib/action-state';
import { requireAdmin } from '@/lib/auth/session';
import { logger } from '@/lib/logger';
import { getSettings } from '@/repositories/settings';
import {
  createProductWithOffer,
  deleteProducts,
  duplicateProduct,
  ProductServiceError,
  setProductsCategory,
  setProductsFeatured,
  setProductStatus,
  updateProductWithOffer,
} from '@/services/product-service';
import {
  bulkActionSchema,
  productUpdateSchema,
  productWithOfferSchema,
} from '@/validation/product';

import type { ProductActionState } from './state';

/** Revalidates every surface a product change can affect. */
function revalidateProduct(slug?: string): void {
  revalidatePath('/', 'page');
  revalidatePath('/productos');
  revalidatePath('/ofertas');
  revalidatePath('/admin', 'layout');
  if (slug) revalidatePath(`/producto/${slug}`);
}

function text(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === 'string' ? value : undefined;
}

/** Treats a whitespace-only field as absent, so a default can take over. */
function blank(value: string | undefined): string | undefined {
  return value && value.trim() !== '' ? value : undefined;
}

/** Images travel as a JSON array in a hidden field. */
function images(formData: FormData): unknown {
  const raw = text(formData, 'images');
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function readPayload(formData: FormData, defaults: { currency: string; market: string }) {
  return {
    product: {
      title: text(formData, 'title') ?? '',
      // Raw on purpose: the schema normalises it and maps empty to `undefined`.
      slug: formData.get('slug'),
      categoryId: text(formData, 'categoryId') ?? '',
      shortDescription: text(formData, 'shortDescription'),
      description: text(formData, 'description'),
      images: images(formData),
      // `null` when unchecked — `checkboxSchema` maps it to `false`.
      featured: formData.get('featured'),
      status: text(formData, 'status') ?? 'draft',
    },
    offer: {
      // No `providerId`: the store is resolved server-side (Temu), so it can
      // never be chosen — or forged — by the browser.
      affiliateUrl: text(formData, 'affiliateUrl') ?? '',
      originalUrl: text(formData, 'originalUrl'),
      canonicalUrl: text(formData, 'canonicalUrl'),
      // Marketplaces frequently publish no currency. Falling back to the
      // configured default here — not in the schema — keeps the rule in one
      // place and means a blank field is never an error the editor has to fix.
      market: blank(text(formData, 'market')) ?? defaults.market,
      currency: blank(text(formData, 'currency')) ?? defaults.currency,
      currentPrice: text(formData, 'currentPrice'),
      previousPrice: text(formData, 'previousPrice'),
      couponCode: text(formData, 'couponCode'),
      couponDescription: text(formData, 'couponDescription'),
      startsAt: text(formData, 'startsAt'),
      expiresAt: text(formData, 'expiresAt'),
      status: text(formData, 'offerStatus') ?? 'active',
    },
  };
}

/** Flattens nested Zod paths (`offer.currentPrice`) into form field names. */
function fieldErrorsFrom(error: {
  issues: { path: (string | number)[]; message: string }[];
}): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[issue.path.length - 1] ?? 'form');
    (result[key] ??= []).push(issue.message);
  }
  return result;
}

export async function saveProductAction(
  _previous: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  const identity = await requireAdmin();
  const productId = text(formData, 'id');
  const offerId = text(formData, 'offerId');
  const settings = await getSettings();
  const payload = readPayload(formData, {
    currency: settings.default_currency,
    market: settings.default_market,
  });

  try {
    if (productId) {
      const parsed = productUpdateSchema.safeParse({
        id: productId,
        product: payload.product,
        offer: { ...payload.offer, ...(offerId ? { id: offerId } : {}) },
      });

      if (!parsed.success) {
        return {
          ...errorState('Revisa los campos marcados.', fieldErrorsFrom(parsed.error)),
        };
      }

      const saved = await updateProductWithOffer(
        parsed.data.id,
        parsed.data.product,
        parsed.data.offer,
      );
      revalidateProduct(saved.slug);

      return {
        status: 'success',
        message: 'Producto actualizado.',
        product: { id: saved.productId, slug: saved.slug, status: parsed.data.product.status },
      };
    }

    const parsed = productWithOfferSchema.safeParse(payload);
    if (!parsed.success) {
      return { ...errorState('Revisa los campos marcados.', fieldErrorsFrom(parsed.error)) };
    }

    const saved = await createProductWithOffer(
      parsed.data.product,
      parsed.data.offer,
      identity.userId,
    );
    revalidateProduct(saved.slug);

    return {
      status: 'success',
      message:
        parsed.data.product.status === 'published' ? 'Producto publicado.' : 'Borrador guardado.',
      product: { id: saved.productId, slug: saved.slug, status: parsed.data.product.status },
    };
  } catch (error) {
    if (error instanceof ProductServiceError) {
      return error.field
        ? errorState(error.message, { [error.field]: [error.message] })
        : errorState(error.message);
    }
    logger.error('product.save_action_failed', { error });
    return errorState('No se ha podido guardar el producto.');
  }
}

export async function bulkProductAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const parsed = bulkActionSchema.safeParse({
    ids: formData.getAll('ids').map(String),
    action: text(formData, 'action'),
    categoryId: text(formData, 'categoryId') || undefined,
  });

  if (!parsed.success) {
    return errorState(parsed.error.issues[0]?.message ?? 'Acción no válida.');
  }

  const { ids, action, categoryId } = parsed.data;

  try {
    switch (action) {
      case 'publish':
        await setProductStatus(ids, 'published');
        break;
      case 'hide':
        await setProductStatus(ids, 'hidden');
        break;
      case 'archive':
        await setProductStatus(ids, 'archived');
        break;
      case 'feature':
        await setProductsFeatured(ids, true);
        break;
      case 'unfeature':
        await setProductsFeatured(ids, false);
        break;
      case 'set_category':
        if (!categoryId) return errorState('Selecciona una categoría.');
        await setProductsCategory(ids, categoryId);
        break;
    }

    revalidateProduct();
    return { status: 'success', message: `${ids.length} producto(s) actualizados.` };
  } catch (error) {
    if (error instanceof ProductServiceError) return errorState(error.message);
    logger.error('product.bulk_action_failed', { error });
    return errorState('No se ha podido completar la acción.');
  }
}

export async function deleteProductAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const id = text(formData, 'id');
  if (!id) return errorState('Producto no válido.');

  try {
    await deleteProducts([id]);
    revalidateProduct();
    return { status: 'success', message: 'Producto eliminado.' };
  } catch (error) {
    if (error instanceof ProductServiceError) return errorState(error.message);
    return errorState('No se ha podido eliminar el producto.');
  }
}

export async function duplicateProductAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const id = text(formData, 'id');
  if (!id) return errorState('Producto no válido.');

  try {
    const created = await duplicateProduct(id);
    revalidateProduct(created.slug);
    return { status: 'success', message: 'Producto duplicado como borrador.' };
  } catch (error) {
    if (error instanceof ProductServiceError) return errorState(error.message);
    return errorState('No se ha podido duplicar el producto.');
  }
}

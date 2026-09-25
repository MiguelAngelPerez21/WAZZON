'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';

import { saveProductAction } from '@/app/admin/(panel)/products/actions';
import { idleProductState } from '@/app/admin/(panel)/products/state';
import { ImagePicker, type PickedImage } from '@/components/admin/image-picker';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import type { CategoryView, ProductView } from '@/domain/views';
import { primaryOffer } from '@/domain/views';

/**
 * Full product editor.
 *
 * Deliberately exposes exactly one offer: the MVP models "one product = one
 * link". Multi-offer support can be added later without changing the schema.
 *
 * There is no store selector: the site publishes Temu exclusively, so
 * `offers.provider_id` is resolved server-side. See `src/services/providers.ts`.
 */
export function ProductForm({
  product,
  categories,
  defaultCurrency,
  defaultMarket,
}: {
  product?: ProductView;
  categories: CategoryView[];
  defaultCurrency: string;
  defaultMarket: string;
}) {
  const [state, formAction, saving] = useActionState(saveProductAction, idleProductState);
  const offer = product ? (primaryOffer(product) ?? product.offers[0] ?? null) : null;

  const [images, setImages] = useState<PickedImage[]>(
    product?.images.map((image) => ({ url: image.url, alt: image.alt })) ?? [],
  );

  const error = (field: string) => state.fieldErrors?.[field]?.[0];

  return (
    <form action={formAction} className="space-y-6">
      {product ? <input type="hidden" name="id" value={product.id} /> : null}
      {offer ? <input type="hidden" name="offerId" value={offer.id} /> : null}

      <section className="border-ink-200 space-y-4 rounded-[--radius-card] border bg-white p-4">
        <h2 className="text-ink-900 text-base font-semibold">Producto</h2>

        <Field id="title" label="Título" required error={error('title')}>
          <Input
            id="title"
            name="title"
            defaultValue={product?.title ?? ''}
            maxLength={180}
            required
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="slug"
            label="Slug"
            hint="Déjalo vacío para generarlo a partir del título."
            error={error('slug')}
          >
            <Input id="slug" name="slug" defaultValue={product?.slug ?? ''} maxLength={80} />
          </Field>

          <Field id="categoryId" label="Categoría" required error={error('categoryId')}>
            <Select
              id="categoryId"
              name="categoryId"
              defaultValue={product?.category?.id ?? ''}
              required
            >
              <option value="">Selecciona…</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field
          id="shortDescription"
          label="Descripción corta"
          hint="Máximo 300 caracteres."
          error={error('shortDescription')}
        >
          <Textarea
            id="shortDescription"
            name="shortDescription"
            maxLength={300}
            defaultValue={product?.shortDescription ?? ''}
          />
        </Field>

        <Field id="description" label="Descripción" error={error('description')}>
          <Textarea
            id="description"
            name="description"
            className="min-h-40"
            defaultValue={product?.description ?? ''}
          />
        </Field>

        <div className="flex flex-wrap items-end gap-4">
          <Field id="status" label="Estado" className="w-48">
            <Select id="status" name="status" defaultValue={product?.status ?? 'draft'}>
              <option value="draft">Borrador</option>
              <option value="published">Publicado</option>
              <option value="hidden">Oculto</option>
              <option value="archived">Archivado</option>
            </Select>
          </Field>

          <label className="text-ink-700 flex h-10 items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="featured"
              value="on"
              defaultChecked={product?.featured ?? false}
              className="border-ink-300 text-brand-600 size-4 rounded"
            />
            Destacado
          </label>
        </div>
      </section>

      <section className="border-ink-200 space-y-4 rounded-[--radius-card] border bg-white p-4">
        <h2 className="text-ink-900 text-base font-semibold">Imágenes</h2>
        <ImagePicker images={images} onChange={setImages} />
        {error('images') ? (
          <p role="alert" className="text-xs font-medium text-red-600">
            {error('images')}
          </p>
        ) : null}
      </section>

      <section className="border-ink-200 space-y-4 rounded-[--radius-card] border bg-white p-4">
        <div>
          <h2 className="text-ink-900 text-base font-semibold">Oferta</h2>
          <p className="text-ink-500 mt-1 text-sm">
            Se publica en <strong className="text-ink-700 font-medium">Temu</strong>.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="offerStatus" label="Estado de la oferta">
            <Select id="offerStatus" name="offerStatus" defaultValue={offer?.status ?? 'active'}>
              <option value="active">Activa</option>
              <option value="draft">Borrador</option>
              <option value="expired">Caducada</option>
              <option value="hidden">Oculta</option>
            </Select>
          </Field>
        </div>

        <Field id="affiliateUrl" label="Enlace de afiliado" required error={error('affiliateUrl')}>
          <Input
            id="affiliateUrl"
            name="affiliateUrl"
            type="url"
            defaultValue={offer?.affiliateUrl ?? ''}
            required
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="originalUrl" label="Enlace original" error={error('originalUrl')}>
            <Input
              id="originalUrl"
              name="originalUrl"
              type="url"
              defaultValue={offer?.originalUrl ?? ''}
            />
          </Field>
          <Field id="canonicalUrl" label="Enlace canónico" error={error('canonicalUrl')}>
            <Input
              id="canonicalUrl"
              name="canonicalUrl"
              type="url"
              defaultValue={offer?.canonicalUrl ?? ''}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-4">
          <Field id="currentPrice" label="Precio actual" error={error('currentPrice')}>
            <Input
              id="currentPrice"
              name="currentPrice"
              inputMode="decimal"
              defaultValue={offer?.currentPrice ?? ''}
            />
          </Field>
          <Field
            id="previousPrice"
            label="Precio anterior"
            hint="Sólo si la tienda lo publica."
            error={error('previousPrice')}
          >
            <Input
              id="previousPrice"
              name="previousPrice"
              inputMode="decimal"
              defaultValue={offer?.previousPrice ?? ''}
            />
          </Field>
          <Field id="currency" label="Moneda" error={error('currency')}>
            <Input
              id="currency"
              name="currency"
              maxLength={3}
              defaultValue={offer?.currency ?? defaultCurrency}
            />
          </Field>
          <Field id="market" label="Mercado" error={error('market')}>
            <Input
              id="market"
              name="market"
              maxLength={2}
              defaultValue={offer?.market ?? defaultMarket}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="couponCode" label="Código de cupón" error={error('couponCode')}>
            <Input id="couponCode" name="couponCode" defaultValue={offer?.couponCode ?? ''} />
          </Field>
          <Field
            id="couponDescription"
            label="Descripción del cupón"
            error={error('couponDescription')}
          >
            <Input
              id="couponDescription"
              name="couponDescription"
              defaultValue={offer?.couponDescription ?? ''}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="startsAt" label="Empieza" error={error('startsAt')}>
            <Input
              id="startsAt"
              name="startsAt"
              type="datetime-local"
              defaultValue={toLocalInput(offer?.startsAt)}
            />
          </Field>
          <Field id="expiresAt" label="Caduca" error={error('expiresAt')}>
            <Input
              id="expiresAt"
              name="expiresAt"
              type="datetime-local"
              defaultValue={toLocalInput(offer?.expiresAt)}
            />
          </Field>
        </div>
      </section>

      {state.message ? (
        <p
          role="alert"
          className={
            state.status === 'error'
              ? 'rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700'
              : 'bg-deal-50 text-deal-700 rounded-lg p-3 text-sm font-medium'
          }
        >
          {state.message}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" size="lg" disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar'}
        </Button>
        <Button asChild variant="ghost" size="lg">
          <Link href="/admin/products">Cancelar</Link>
        </Button>
        {product?.status === 'published' ? (
          <Button asChild variant="ghost" size="lg">
            <Link href={`/producto/${product.slug}`} target="_blank" rel="noopener">
              Ver en el sitio
            </Link>
          </Button>
        ) : null}
      </div>
    </form>
  );
}

/** `datetime-local` needs `YYYY-MM-DDTHH:mm` without the timezone suffix. */
function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

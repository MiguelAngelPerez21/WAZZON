'use client';

import { CheckCircle2, Info, Link2, Loader2, PencilLine, Plus } from 'lucide-react';
import Link from 'next/link';
import { useActionState, useState, useTransition } from 'react';

import { saveProductAction } from '@/app/admin/(panel)/products/actions';
import { idleProductState } from '@/app/admin/(panel)/products/state';
import { ImagePicker, type PickedImage } from '@/components/admin/image-picker';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { isTemuUrl } from '@/config/temu';
import type { CategoryView } from '@/domain/views';

interface AnalyzeResponse {
  result: {
    title?: string;
    description?: string;
    images?: { url: string; alt?: string }[];
    price?: number;
    previousPrice?: number;
    currency?: string;
    canonicalUrl?: string;
  };
  fields: Record<string, 'detected' | 'missing'>;
  warnings: string[];
  duplicates: { productId: string; productTitle: string; productSlug: string }[];
  /** `assisted-manual` when the page did not expose enough data to publish. */
  mode: 'imported' | 'assisted-manual';
  isTemu: boolean;
  /** Landing page reached after following the affiliate redirects. */
  finalUrl: string;
  redirected: boolean;
  fetched: boolean;
  notice: { headline: string; detail: string } | null;
}

/** Shown when the analyser could not run at all (network, 500…). */
function offlineAnalysis(url: string): AnalyzeResponse {
  return {
    result: {},
    fields: {},
    warnings: [],
    duplicates: [],
    mode: 'assisted-manual',
    isTemu: isTemuUrl(url),
    finalUrl: url,
    redirected: false,
    fetched: false,
    notice: {
      headline: isTemuUrl(url)
        ? 'Temu no expone metadata suficiente en este enlace. Puedes completar los datos manualmente.'
        : 'No hemos podido leer la página. Puedes completar los datos manualmente.',
      detail:
        'No se han podido importar automáticamente los datos, pero puedes publicar el producto ' +
        'manualmente.',
    },
  };
}

/**
 * Quick Add: paste link → pick category → publish.
 *
 * The analysis is a help, never a requirement. Marketplaces are free not to
 * publish Open Graph or JSON-LD, and Temu in particular answers non-browser
 * clients with a challenge page, so "no metadata" is an expected outcome — not
 * an error. When that happens the form opens anyway in assisted manual mode,
 * keeping the affiliate link and the category already chosen, and the editor
 * types the few fields that matter.
 *
 * Nothing is ever inferred from free text: whatever appears in a field was
 * either read from the page or typed by a human.
 */
export function QuickAddForm({
  categories,
  defaultCurrency,
  defaultMarket,
}: {
  categories: CategoryView[];
  defaultCurrency: string;
  defaultMarket: string;
}) {
  const { toast } = useToast();
  const [state, formAction, saving] = useActionState(saveProductAction, idleProductState);

  const [url, setUrl] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [images, setImages] = useState<PickedImage[]>([]);
  const [analyzing, startAnalyzing] = useTransition();

  /** The link the admin pasted, kept verbatim: it is what earns the commission. */
  const affiliateUrl = url.trim();
  const canSubmit = Boolean(categoryId) && affiliateUrl.length > 0;

  function applyAnalysis(data: AnalyzeResponse): void {
    setAnalysis(data);
    setImages(
      (data.result.images ?? [])
        .slice(0, 5)
        .map((image) => ({ url: image.url, alt: image.alt ?? null })),
    );
  }

  function analyze() {
    setAnalyzeError(null);
    startAnalyzing(async () => {
      try {
        const response = await fetch('/api/admin/analyze-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: affiliateUrl }),
        });
        const body: unknown = await response.json();

        if (!response.ok) {
          const message =
            typeof body === 'object' && body !== null && 'error' in body
              ? String((body as { error: unknown }).error)
              : 'No se ha podido analizar el enlace.';
          // A rejected URL is a real problem the admin must fix (it is the URL
          // guard refusing an unsafe destination), so do not open the form.
          setAnalyzeError(message);
          setAnalysis(null);
          return;
        }

        const data = body as AnalyzeResponse;
        applyAnalysis(data);
        toast(
          data.mode === 'imported'
            ? { tone: 'success', title: 'Enlace analizado' }
            : { tone: 'info', title: 'Completa los datos a mano' },
        );
      } catch {
        setAnalyzeError('No se ha podido contactar con el servidor.');
      }
    });
  }

  /** Escape hatch: publish without analysing at all. */
  function skipAnalysis() {
    setAnalyzeError(null);
    applyAnalysis(offlineAnalysis(affiliateUrl));
  }

  if (state.status === 'success' && state.product) {
    return (
      <div className="border-deal-600/30 bg-deal-50 space-y-4 rounded-[--radius-card] border p-6 text-center">
        <CheckCircle2 aria-hidden className="text-deal-600 mx-auto size-10" />
        <p className="text-ink-900 font-semibold">{state.message}</p>
        <div className="flex flex-wrap justify-center gap-3">
          {state.product.status === 'published' ? (
            <Button asChild>
              <Link href={`/producto/${state.product.slug}`} target="_blank" rel="noopener">
                Ver producto
              </Link>
            </Button>
          ) : (
            <Button asChild>
              <Link href={`/admin/products/${state.product.id}`}>Seguir editando</Link>
            </Button>
          )}
          <Button variant="outline" onClick={() => window.location.reload()}>
            <Plus aria-hidden className="size-4" />
            Añadir otro
          </Button>
        </div>
      </div>
    );
  }

  const assisted = analysis?.mode === 'assisted-manual';

  return (
    <div className="space-y-5">
      {/* Step 1 — the 30-second path. */}
      <div className="border-ink-200 space-y-3 rounded-[--radius-card] border bg-white p-4">
        <Field
          id="quick-url"
          label="1. Pega el enlace del producto"
          hint="Seguimos las redirecciones del enlace y leemos sólo los datos públicos de la página."
          required
        >
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="quick-url"
              type="url"
              inputMode="url"
              placeholder="https://…"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              autoFocus
            />
            <Button onClick={analyze} disabled={analyzing || affiliateUrl.length < 8}>
              {analyzing ? (
                <Loader2 aria-hidden className="size-4 animate-spin" />
              ) : (
                <Link2 aria-hidden className="size-4" />
              )}
              {analyzing ? 'Analizando…' : 'Analizar enlace'}
            </Button>
          </div>
        </Field>

        <Field id="quick-category" label="2. Elige la categoría" required>
          <Select
            id="quick-category"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
          >
            <option value="">Selecciona…</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </Field>

        {analyzeError ? (
          <div role="alert" className="space-y-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            <p className="font-medium">{analyzeError}</p>
            <Button type="button" variant="outline" size="sm" onClick={skipAnalysis}>
              <PencilLine aria-hidden className="size-4" />
              Rellenar manualmente
            </Button>
          </div>
        ) : null}
      </div>

      {analysis ? (
        <>
          {assisted && analysis.notice ? (
            <div className="border-brand-200 bg-brand-50 text-ink-800 space-y-1 rounded-[--radius-card] border p-3 text-sm">
              <p className="flex items-start gap-2 font-medium">
                <Info aria-hidden className="text-brand-700 mt-0.5 size-4 shrink-0" />
                <span>{analysis.notice.headline}</span>
              </p>
              <p className="text-ink-600 pl-6">{analysis.notice.detail}</p>
              {analysis.redirected ? (
                <p className="text-ink-500 pl-6 text-xs break-all">
                  El enlace redirige a: {analysis.finalUrl}
                </p>
              ) : null}
            </div>
          ) : null}

          {analysis.warnings.map((warning) => (
            <p
              key={warning}
              className="rounded-[--radius-card] border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
            >
              {warning}
            </p>
          ))}

          {analysis.duplicates.length > 0 ? (
            <div className="rounded-[--radius-card] border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="font-semibold">Puede que ya tengas este producto</p>
              <ul className="mt-1 list-disc pl-5">
                {analysis.duplicates.map((duplicate) => (
                  <li key={duplicate.productId}>
                    <Link
                      href={`/admin/products/${duplicate.productId}`}
                      className="underline underline-offset-2"
                    >
                      {duplicate.productTitle}
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="mt-1">Puedes publicarlo igualmente si es un producto distinto.</p>
            </div>
          ) : null}

          {/* Step 3 — review and publish. */}
          <form action={formAction} className="space-y-4">
            {/* The pasted link is never rebuilt or rewritten. */}
            <input type="hidden" name="affiliateUrl" value={affiliateUrl} />
            <input type="hidden" name="originalUrl" value={analysis.finalUrl || affiliateUrl} />
            <input type="hidden" name="canonicalUrl" value={analysis.result.canonicalUrl ?? ''} />
            <input type="hidden" name="categoryId" value={categoryId} />
            {/* No `providerId`: the server attributes every offer to Temu. */}
            <input type="hidden" name="market" value={defaultMarket} />
            <input type="hidden" name="offerStatus" value="active" />

            <div className="border-ink-200 space-y-4 rounded-[--radius-card] border bg-white p-4">
              <div className="bg-ink-50 space-y-2 rounded-lg p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-ink-700 text-sm font-medium">Enlace de afiliado</span>
                  <span className="text-ink-500 text-xs">
                    Tienda: <strong className="text-ink-700 font-medium">Temu</strong>
                  </span>
                </div>
                <Input
                  id="affiliate-url-preview"
                  aria-label="Enlace de afiliado"
                  value={affiliateUrl}
                  readOnly
                  className="bg-white text-xs"
                />
                <p className="text-ink-500 text-xs">
                  Para cambiarlo, edita el enlace en el paso 1.
                </p>
              </div>

              <Field id="title" label="Título" required error={state.fieldErrors?.['title']?.[0]}>
                <Input
                  id="title"
                  name="title"
                  defaultValue={analysis.result.title ?? ''}
                  maxLength={180}
                  required
                />
              </Field>

              <Field
                id="shortDescription"
                label="Descripción corta"
                hint="Opcional. Máximo 300 caracteres. No se interpreta: se guarda tal cual."
                error={state.fieldErrors?.['shortDescription']?.[0]}
              >
                <Textarea
                  id="shortDescription"
                  name="shortDescription"
                  maxLength={300}
                  defaultValue={(analysis.result.description ?? '').slice(0, 300)}
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-3">
                <Field
                  id="currentPrice"
                  label="Precio actual"
                  required
                  error={state.fieldErrors?.['currentPrice']?.[0]}
                >
                  <Input
                    id="currentPrice"
                    name="currentPrice"
                    inputMode="decimal"
                    defaultValue={analysis.result.price ?? ''}
                    placeholder="12,99"
                  />
                </Field>
                <Field
                  id="previousPrice"
                  label="Precio anterior"
                  hint="Opcional. Sólo si la tienda lo publica."
                  error={state.fieldErrors?.['previousPrice']?.[0]}
                >
                  <Input
                    id="previousPrice"
                    name="previousPrice"
                    inputMode="decimal"
                    defaultValue={analysis.result.previousPrice ?? ''}
                  />
                </Field>
                <Field
                  id="currency"
                  label="Moneda"
                  hint={`Por defecto ${defaultCurrency}.`}
                  error={state.fieldErrors?.['currency']?.[0]}
                >
                  <Input
                    id="currency"
                    name="currency"
                    maxLength={3}
                    defaultValue={analysis.result.currency ?? defaultCurrency}
                  />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  id="couponCode"
                  label="Cupón"
                  hint="Opcional."
                  error={state.fieldErrors?.['couponCode']?.[0]}
                >
                  <Input id="couponCode" name="couponCode" maxLength={64} />
                </Field>
                <Field
                  id="couponDescription"
                  label="Condiciones del cupón"
                  hint="Opcional."
                  error={state.fieldErrors?.['couponDescription']?.[0]}
                >
                  <Input id="couponDescription" name="couponDescription" maxLength={200} />
                </Field>
              </div>

              <fieldset className="space-y-2">
                <legend className="text-ink-800 text-sm font-medium">
                  Imagen principal <span className="text-red-600">*</span>
                </legend>
                <ImagePicker images={images} onChange={setImages} />
                {state.fieldErrors?.['images']?.[0] ? (
                  <p role="alert" className="text-xs font-medium text-red-600">
                    {state.fieldErrors['images'][0]}
                  </p>
                ) : null}
              </fieldset>

              <label className="text-ink-700 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="featured"
                  value="on"
                  className="border-ink-300 text-brand-600 size-4 rounded"
                />
                Marcar como destacado
              </label>
            </div>

            {state.status === 'error' && state.message ? (
              <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700">
                {state.message}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <Button
                type="submit"
                name="status"
                value="published"
                size="lg"
                disabled={saving || !canSubmit}
              >
                {saving ? 'Guardando…' : 'Publicar producto'}
              </Button>
              <Button
                type="submit"
                name="status"
                value="draft"
                size="lg"
                variant="outline"
                disabled={saving || !canSubmit}
              >
                Guardar borrador
              </Button>
            </div>
            {!categoryId ? (
              <p className="text-ink-500 text-xs">Selecciona una categoría para poder publicar.</p>
            ) : (
              <p className="text-ink-500 text-xs">
                Para publicar hacen falta título, categoría, enlace, precio actual e imagen. El
                borrador se guarda igualmente aunque falte algo.
              </p>
            )}
          </form>
        </>
      ) : null}
    </div>
  );
}

import { PackageSearch } from 'lucide-react';

import { CatalogFilters } from '@/components/public/catalog-filters';
import { Pagination } from '@/components/public/pagination';
import { ProductGrid } from '@/components/public/product-grid';
import { EmptyState } from '@/components/ui/empty-state';
import {
  buildPageHref,
  readFlag,
  readPage,
  readParam,
  readQuery,
  readSort,
  type SearchParams,
} from '@/lib/catalog-params';
import {
  listActiveCategories,
  listActiveProviders,
  listCatalogProducts,
  type CatalogSort,
} from '@/repositories/catalog';
import { getSettings } from '@/repositories/settings';

/**
 * Shared catalog listing used by /productos, /categoria/[slug], /buscar and
 * /ofertas. Keeping one implementation means filters, pagination and the empty
 * states behave identically everywhere.
 */
export async function CatalogView({
  basePath,
  searchParams,
  categoryId,
  forceOnlyOffers = false,
  showCategoryFilter = true,
  defaultSort,
  emptyTitle = 'Todavía no hay productos aquí',
  emptyDescription = 'Prueba a cambiar los filtros o vuelve pronto: publicamos hallazgos nuevos a menudo.',
}: {
  basePath: string;
  searchParams: SearchParams;
  categoryId?: string | null;
  forceOnlyOffers?: boolean;
  showCategoryFilter?: boolean;
  defaultSort?: CatalogSort;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  const [categories, providers, settings] = await Promise.all([
    listActiveCategories(),
    listActiveProviders(),
    getSettings(),
  ]);

  const page = readPage(searchParams);
  const categorySlug = readParam(searchParams, 'categoria');
  const providerSlug = readParam(searchParams, 'tienda');
  const query = readQuery(searchParams);
  const sort = readParam(searchParams, 'orden')
    ? readSort(searchParams)
    : (defaultSort ?? 'recent');
  const featured = readFlag(searchParams, 'destacados');
  const onlyOffers = forceOnlyOffers || readFlag(searchParams, 'ofertas');

  const resolvedCategoryId =
    categoryId ?? categories.find((category) => category.slug === categorySlug)?.id ?? null;
  const resolvedProviderId =
    providers.find((provider) => provider.slug === providerSlug)?.id ?? null;

  const result = await listCatalogProducts({
    categoryId: resolvedCategoryId,
    providerId: resolvedProviderId,
    search: query ?? null,
    featured: featured ? true : null,
    withOfferOnly: onlyOffers,
    sort,
    page,
  });

  return (
    <div className="space-y-6">
      <CatalogFilters
        action={basePath}
        categories={categories}
        providers={providers}
        showCategory={showCategoryFilter}
        values={{
          category: categorySlug,
          provider: providerSlug,
          sort,
          featured,
          onlyOffers: forceOnlyOffers ? undefined : onlyOffers,
          q: query,
        }}
      />

      {result.total > 0 ? (
        <>
          <p className="text-ink-500 text-sm" aria-live="polite">
            {result.total} {result.total === 1 ? 'producto' : 'productos'}
          </p>
          <ProductGrid products={result.products} trackingMode={settings.outbound_tracking_mode} />
          <Pagination
            page={result.page}
            totalPages={result.totalPages}
            buildHref={(value) => buildPageHref(basePath, searchParams, value)}
          />
        </>
      ) : (
        <EmptyState
          icon={<PackageSearch aria-hidden className="size-10" />}
          title={emptyTitle}
          description={emptyDescription}
        />
      )}
    </div>
  );
}

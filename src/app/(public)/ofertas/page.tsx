import type { Metadata } from 'next';

import { Breadcrumbs } from '@/components/public/breadcrumbs';
import { CatalogView } from '@/components/public/catalog-view';
import type { SearchParams } from '@/lib/catalog-params';

export const metadata: Metadata = {
  title: 'Ofertas',
  description:
    'Productos con precio rebajado respecto a su precio anterior publicado por la tienda.',
  // Filters and pagination live in the query string and would otherwise be
  // indexed as duplicates of this page.
  alternates: { canonical: '/ofertas' },
};

export default async function OffersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8">
      <Breadcrumbs items={[{ label: 'Inicio', href: '/' }, { label: 'Ofertas' }]} />
      <header>
        <h1 className="text-ink-900 text-2xl font-bold sm:text-3xl">Ofertas</h1>
        {/* No countdowns, no "quedan X unidades": sólo lo que publica la tienda. */}
        <p className="text-ink-500 mt-1 text-sm">
          Solo mostramos un descuento cuando la tienda publica también un precio anterior.
        </p>
      </header>
      <CatalogView
        basePath="/ofertas"
        searchParams={params}
        forceOnlyOffers
        defaultSort="recent"
        emptyTitle="Ahora mismo no hay ofertas activas"
        emptyDescription="Cuando encontremos una rebaja real la verás aquí."
      />
    </div>
  );
}

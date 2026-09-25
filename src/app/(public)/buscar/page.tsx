import { Search } from 'lucide-react';
import type { Metadata } from 'next';

import { Breadcrumbs } from '@/components/public/breadcrumbs';
import { CatalogView } from '@/components/public/catalog-view';
import { EmptyState } from '@/components/ui/empty-state';
import { readQuery, type SearchParams } from '@/lib/catalog-params';

export const metadata: Metadata = {
  title: 'Buscar',
  description: 'Busca entre todos los productos publicados.',
  // Search result pages add no value to the index.
  robots: { index: false, follow: true },
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const query = readQuery(params);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8">
      <Breadcrumbs items={[{ label: 'Inicio', href: '/' }, { label: 'Buscar' }]} />
      <header>
        <h1 className="text-ink-900 text-2xl font-bold sm:text-3xl">
          {query ? `Resultados para “${query}”` : 'Buscar productos'}
        </h1>
      </header>

      {query ? (
        <CatalogView
          basePath="/buscar"
          searchParams={params}
          emptyTitle={`Sin resultados para “${query}”`}
          emptyDescription="Prueba con menos palabras o con un término más general."
        />
      ) : (
        <EmptyState
          icon={<Search aria-hidden className="size-10" />}
          title="Escribe qué estás buscando"
          description="Usa el buscador de la parte superior para encontrar productos por nombre."
        />
      )}
    </div>
  );
}

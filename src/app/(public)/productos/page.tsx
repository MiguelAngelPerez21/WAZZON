import type { Metadata } from 'next';

import { CatalogView } from '@/components/public/catalog-view';
import { Breadcrumbs } from '@/components/public/breadcrumbs';
import type { SearchParams } from '@/lib/catalog-params';

export const metadata: Metadata = {
  title: 'Todos los productos',
  description:
    'Explora todos los hallazgos publicados, con filtros por categoría, tienda y precio.',
  // Filters and pagination live in the query string and would otherwise be
  // indexed as duplicates of this page.
  alternates: { canonical: '/productos' },
};

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8">
      <Breadcrumbs items={[{ label: 'Inicio', href: '/' }, { label: 'Productos' }]} />
      <header>
        <h1 className="text-ink-900 text-2xl font-bold sm:text-3xl">Todos los productos</h1>
        <p className="text-ink-500 mt-1 text-sm">
          Cada producto enlaza a la tienda donde lo hemos encontrado.
        </p>
      </header>
      <CatalogView basePath="/productos" searchParams={params} />
    </div>
  );
}

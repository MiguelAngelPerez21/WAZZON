import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { Breadcrumbs } from '@/components/public/breadcrumbs';
import { CatalogView } from '@/components/public/catalog-view';
import type { SearchParams } from '@/lib/catalog-params';
import { getCategoryBySlug, listActiveCategories } from '@/repositories/catalog';

export const revalidate = 300;

export async function generateStaticParams() {
  const categories = await listActiveCategories();
  return categories.map((category) => ({ slug: category.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) return { title: 'Categoría no encontrada' };

  const description =
    category.seoDescription ??
    category.description ??
    `Productos de la categoría ${category.name}.`;

  return {
    title: category.seoTitle ?? category.name,
    description,
    alternates: { canonical: `/categoria/${category.slug}` },
    openGraph: { title: category.name, description, type: 'website' },
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const category = await getCategoryBySlug(slug);
  if (!category) notFound();

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8">
      <Breadcrumbs
        items={[
          { label: 'Inicio', href: '/' },
          { label: 'Productos', href: '/productos' },
          { label: category.name },
        ]}
      />
      <header>
        <h1 className="text-ink-900 text-2xl font-bold sm:text-3xl">{category.name}</h1>
        {category.description ? (
          <p className="text-ink-500 mt-1 max-w-2xl text-sm">{category.description}</p>
        ) : null}
      </header>

      <CatalogView
        basePath={`/categoria/${category.slug}`}
        searchParams={query}
        categoryId={category.id}
        showCategoryFilter={false}
        emptyTitle={`Aún no hay productos en ${category.name}`}
        emptyDescription="Estamos añadiendo hallazgos continuamente. Vuelve pronto."
      />
    </div>
  );
}

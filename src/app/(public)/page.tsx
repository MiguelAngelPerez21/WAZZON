import { ArrowRight, Sparkles } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { ProductGrid } from '@/components/public/product-grid';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { listActiveCategories, listCatalogProducts } from '@/repositories/catalog';
import { getSettings } from '@/repositories/settings';

export const revalidate = 300;

export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

export default async function HomePage() {
  const [settings, categories, featured, recent, deals] = await Promise.all([
    getSettings(),
    listActiveCategories(),
    listCatalogProducts({ featured: true, perPage: 8, sort: 'recent' }),
    listCatalogProducts({ perPage: 8, sort: 'recent' }),
    listCatalogProducts({ withOfferOnly: true, perPage: 4, sort: 'recent' }),
  ]);

  const mode = settings.outbound_tracking_mode;
  const isEmpty = recent.total === 0;

  return (
    <div className="mx-auto max-w-7xl space-y-14 px-4 py-8 sm:py-12">
      <section className="text-center">
        <p className="text-brand-700 inline-flex items-center gap-1.5 text-sm font-medium">
          <Sparkles aria-hidden className="size-4" />
          Hallazgos seleccionados a mano
        </p>
        <h1 className="text-ink-900 mt-2 text-3xl font-bold text-balance sm:text-5xl">
          {settings.site_description}
        </h1>
        <p className="text-ink-500 mx-auto mt-3 max-w-2xl text-base text-pretty">
          Buscamos productos interesantes, los ordenamos por categorías y te llevamos directamente a
          la tienda. Sin carrito, sin registro.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/productos">Explorar productos</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/ofertas">Ver ofertas</Link>
          </Button>
        </div>
      </section>

      {categories.length > 0 ? (
        <section aria-labelledby="categorias">
          <h2 id="categorias" className="text-ink-900 mb-4 text-xl font-semibold">
            Categorías
          </h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {categories.map((category) => (
              <li key={category.id}>
                <Link
                  href={`/categoria/${category.slug}`}
                  className="border-ink-200 hover:border-brand-400 hover:bg-brand-50 flex h-full flex-col justify-center rounded-[--radius-card] border p-4 text-center transition-colors"
                >
                  <span className="text-ink-900 text-sm font-medium">{category.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {isEmpty ? (
        <EmptyState
          title="Todavía no hay productos publicados"
          description="En cuanto se publique el primer hallazgo aparecerá aquí."
        />
      ) : null}

      {featured.products.length > 0 ? (
        <HomeSection title="Destacados" href="/productos?destacados=1">
          <ProductGrid products={featured.products} trackingMode={mode} />
        </HomeSection>
      ) : null}

      {deals.products.length > 0 ? (
        <HomeSection title="Con descuento" href="/ofertas">
          <ProductGrid products={deals.products} trackingMode={mode} />
        </HomeSection>
      ) : null}

      {recent.products.length > 0 ? (
        <HomeSection title="Añadidos recientemente" href="/productos">
          <ProductGrid products={recent.products} trackingMode={mode} />
        </HomeSection>
      ) : null}
    </div>
  );
}

function HomeSection({
  title,
  href,
  children,
}: {
  title: string;
  href: string;
  children: React.ReactNode;
}) {
  const id = title.toLowerCase().replace(/\s+/g, '-');

  return (
    <section aria-labelledby={id}>
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h2 id={id} className="text-ink-900 text-xl font-semibold">
          {title}
        </h2>
        <Link
          href={href}
          className="text-brand-700 hover:text-brand-800 inline-flex items-center gap-1 text-sm font-medium"
        >
          Ver más
          <ArrowRight aria-hidden className="size-4" />
        </Link>
      </div>
      {children}
    </section>
  );
}

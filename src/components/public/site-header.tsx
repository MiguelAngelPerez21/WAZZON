import Link from 'next/link';
import { Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { listActiveCategories } from '@/repositories/catalog';
import { getSettings } from '@/repositories/settings';

/**
 * Site header.
 *
 * A Server Component with a progressive-enhancement search form (plain GET), so
 * search works with JavaScript disabled and ships zero client JS.
 */
export async function SiteHeader() {
  const [settings, categories] = await Promise.all([getSettings(), listActiveCategories()]);
  const primaryCategories = categories.slice(0, 6);

  return (
    <header className="border-ink-200 sticky top-0 z-40 border-b bg-white/95 backdrop-blur">
      <a
        href="#contenido"
        className="bg-brand-600 sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:px-3 focus:py-2 focus:text-white"
      >
        Saltar al contenido
      </a>

      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 sm:gap-4">
        <Link
          href="/"
          className="text-ink-900 hover:text-brand-700 shrink-0 text-lg font-bold tracking-tight"
        >
          {settings.site_name}
        </Link>

        <form
          action="/buscar"
          method="get"
          role="search"
          className="order-3 flex w-full items-center gap-2 sm:order-none sm:w-auto sm:flex-1"
        >
          <div className="relative flex-1">
            <Search
              aria-hidden
              className="text-ink-400 pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            />
            <label htmlFor="site-search" className="sr-only">
              Buscar productos
            </label>
            <input
              id="site-search"
              type="search"
              name="q"
              placeholder="Buscar productos…"
              autoComplete="off"
              className="border-ink-300 text-ink-900 placeholder:text-ink-400 focus:border-brand-500 h-10 w-full rounded-full border bg-white pr-4 pl-9 text-sm"
            />
          </div>
          <Button type="submit" size="md" className="rounded-full">
            Buscar
          </Button>
        </form>

        <nav aria-label="Principal" className="ml-auto flex items-center gap-1 sm:gap-2">
          <Link
            href="/productos"
            className="text-ink-700 hover:bg-ink-100 rounded-lg px-3 py-2 text-sm font-medium"
          >
            Productos
          </Link>
          <Link
            href="/ofertas"
            className="text-ink-700 hover:bg-ink-100 rounded-lg px-3 py-2 text-sm font-medium"
          >
            Ofertas
          </Link>
        </nav>
      </div>

      {primaryCategories.length > 0 ? (
        <nav aria-label="Categorías" className="border-ink-100 border-t">
          <ul className="mx-auto flex max-w-7xl [scrollbar-width:none] gap-1 overflow-x-auto px-3 py-2">
            {primaryCategories.map((category) => (
              <li key={category.id}>
                <Link
                  href={`/categoria/${category.slug}`}
                  className="text-ink-600 hover:bg-ink-100 hover:text-ink-900 block rounded-full px-3 py-1.5 text-sm whitespace-nowrap"
                >
                  {category.name}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/productos"
                className="text-brand-700 hover:bg-brand-50 block rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap"
              >
                Ver todo
              </Link>
            </li>
          </ul>
        </nav>
      ) : null}
    </header>
  );
}

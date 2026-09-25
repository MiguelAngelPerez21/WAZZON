import Link from 'next/link';

import { QuickAddForm } from '@/components/admin/quick-add-form';
import { StatCard } from '@/components/admin/stat-card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import {
  getDashboardStats,
  getRecentProducts,
  getTopProducts,
} from '@/repositories/admin/analytics';
import { listActiveCategories } from '@/repositories/catalog';
import { getSettings } from '@/repositories/settings';

export default async function AdminDashboardPage() {
  const [stats, categories, settings, recent, top] = await Promise.all([
    getDashboardStats(),
    listActiveCategories(),
    getSettings(),
    getRecentProducts(5),
    getTopProducts(30, 5),
  ]);

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-ink-900 text-xl font-bold">Añadir producto en 30 segundos</h1>
        <p className="text-ink-500 mt-1 text-sm">Pega el enlace, elige la categoría y publica.</p>
        <div className="mt-4">
          <QuickAddForm
            categories={categories}
            defaultCurrency={settings.default_currency}
            defaultMarket={settings.default_market}
          />
        </div>
      </section>

      <section aria-labelledby="metricas">
        <h2 id="metricas" className="text-ink-900 mb-3 text-lg font-semibold">
          Resumen
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Productos publicados" value={stats.products.published} tone="brand" />
          <StatCard label="Borradores" value={stats.products.draft} />
          <StatCard label="Ofertas activas" value={stats.offers.active} tone="deal" />
          <StatCard
            label="Ofertas caducadas"
            value={stats.offers.expired}
            tone={stats.offers.expired > 0 ? 'warning' : 'neutral'}
          />
          <StatCard label="Clics hoy" value={stats.clicks.today} />
          <StatCard label="Clics (7 días)" value={stats.clicks.last7Days} />
          <StatCard label="Clics (30 días)" value={stats.clicks.last30Days} />
          <StatCard label="Ocultos" value={stats.products.hidden} />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="recientes">
          <h2 id="recientes" className="text-ink-900 mb-3 text-lg font-semibold">
            Últimos productos
          </h2>
          {recent.length === 0 ? (
            <EmptyState title="Aún no has añadido productos" />
          ) : (
            <ul className="border-ink-200 divide-ink-100 divide-y rounded-[--radius-card] border bg-white">
              {recent.map((product) => (
                <li key={product.id} className="flex items-center gap-3 p-3">
                  <Link
                    href={`/admin/products/${product.id}`}
                    className="text-ink-900 hover:text-brand-700 min-w-0 flex-1 truncate text-sm font-medium"
                  >
                    {product.title}
                  </Link>
                  <Badge tone={product.status === 'published' ? 'deal' : 'neutral'}>
                    {product.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="top">
          <h2 id="top" className="text-ink-900 mb-3 text-lg font-semibold">
            Más clicados (30 días)
          </h2>
          {top.length === 0 ? (
            <EmptyState
              title="Todavía no hay clics registrados"
              description="Cuando alguien pulse en una oferta lo verás aquí."
            />
          ) : (
            <ul className="border-ink-200 divide-ink-100 divide-y rounded-[--radius-card] border bg-white">
              {top.map((item) => (
                <li key={item.productId} className="flex items-center gap-3 p-3">
                  <Link
                    href={`/admin/products/${item.productId}`}
                    className="text-ink-900 hover:text-brand-700 min-w-0 flex-1 truncate text-sm font-medium"
                  >
                    {item.title}
                  </Link>
                  <span className="text-ink-600 text-sm font-semibold tabular-nums">
                    {item.clicks}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

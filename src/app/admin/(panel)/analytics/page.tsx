import type { Metadata } from 'next';
import Link from 'next/link';

import { BarList } from '@/components/admin/bar-list';
import { StatCard } from '@/components/admin/stat-card';
import { EmptyState } from '@/components/ui/empty-state';
import {
  getClicksByCategory,
  getClicksByDay,
  getClicksByProvider,
  getClicksBySource,
  getDashboardStats,
  getTopProducts,
} from '@/repositories/admin/analytics';

export const metadata: Metadata = { title: 'Analítica' };

function formatDay(day: string): string {
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short' }).format(new Date(day));
}

export default async function AdminAnalyticsPage() {
  const [stats, byDay, top, byCategory, byProvider, bySource] = await Promise.all([
    getDashboardStats(),
    getClicksByDay(30),
    getTopProducts(30, 10),
    getClicksByCategory(30),
    getClicksByProvider(30),
    getClicksBySource(30),
  ]);

  const hasData = stats.clicks.last30Days > 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-ink-900 text-xl font-bold">Analítica</h1>
        <p className="text-ink-500 text-sm">
          Clics salientes registrados de forma anónima, sin cookies ni direcciones IP.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Clics hoy" value={stats.clicks.today} tone="brand" />
        <StatCard label="Últimos 7 días" value={stats.clicks.last7Days} />
        <StatCard label="Últimos 30 días" value={stats.clicks.last30Days} />
      </div>

      {!hasData ? (
        <EmptyState
          title="Aún no hay clics registrados"
          description="En cuanto alguien pulse en una oferta empezarás a ver datos aquí."
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Clics por día">
            <BarList
              items={byDay.map((row) => ({ label: formatDay(row.day), value: row.clicks }))}
            />
          </Panel>

          <Panel title="Productos más clicados">
            {top.length === 0 ? (
              <p className="text-ink-500 text-sm">Sin datos todavía</p>
            ) : (
              <ul className="space-y-2">
                {top.map((item) => (
                  <li key={item.productId} className="flex items-center gap-3">
                    <Link
                      href={`/admin/products/${item.productId}`}
                      className="text-ink-800 hover:text-brand-700 min-w-0 flex-1 truncate text-sm"
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
          </Panel>

          <Panel title="Por categoría">
            <BarList items={byCategory.map((row) => ({ label: row.name, value: row.clicks }))} />
          </Panel>

          <Panel title="Por tienda">
            <BarList items={byProvider.map((row) => ({ label: row.name, value: row.clicks }))} />
          </Panel>

          <Panel title="Por origen (utm_source)">
            <BarList
              items={bySource.map((row) => ({ label: row.name, value: row.clicks }))}
              emptyLabel="Ningún clic llegó con utm_source"
            />
          </Panel>
        </div>
      )}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-ink-200 rounded-[--radius-card] border bg-white p-4">
      <h2 className="text-ink-900 mb-3 text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}

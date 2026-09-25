import type { Metadata } from 'next';
import Link from 'next/link';

import { ExpireOffersButton } from '@/components/admin/expire-offers-button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { formatPrice } from '@/domain/money';
import { listAdminOffers } from '@/repositories/admin/offers';
import type { OfferStatus } from '@/types/database';

export const metadata: Metadata = { title: 'Ofertas' };

const STATUS_LABEL: Record<OfferStatus, string> = {
  draft: 'Borrador',
  active: 'Activa',
  expired: 'Caducada',
  hidden: 'Oculta',
};

const STATUS_TONE: Record<OfferStatus, 'deal' | 'neutral' | 'warning' | 'muted'> = {
  draft: 'neutral',
  active: 'deal',
  expired: 'warning',
  hidden: 'muted',
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'short' }).format(new Date(iso));
}

export default async function AdminOffersPage() {
  const offers = await listAdminOffers();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-ink-900 text-xl font-bold">Ofertas</h1>
          <p className="text-ink-500 text-sm">
            Cuando una oferta caduca el producto sigue existiendo; sólo deja de mostrarse el enlace.
          </p>
        </div>
        <ExpireOffersButton />
      </div>

      {offers.length === 0 ? (
        <EmptyState title="Todavía no hay ofertas" />
      ) : (
        <div className="border-ink-200 overflow-x-auto rounded-[--radius-card] border bg-white">
          <table className="w-full min-w-[40rem] text-sm">
            <caption className="sr-only">Listado de ofertas</caption>
            <thead className="bg-ink-50 text-ink-600 text-left text-xs">
              <tr>
                <th scope="col" className="p-3">
                  Producto
                </th>
                <th scope="col" className="p-3">
                  Tienda
                </th>
                <th scope="col" className="p-3">
                  Precio
                </th>
                <th scope="col" className="p-3">
                  Estado
                </th>
                <th scope="col" className="p-3">
                  Caduca
                </th>
                <th scope="col" className="p-3">
                  Comprobada
                </th>
              </tr>
            </thead>
            <tbody className="divide-ink-100 divide-y">
              {offers.map((offer) => (
                <tr key={offer.id}>
                  <td className="p-3">
                    <Link
                      href={`/admin/products/${offer.productId}`}
                      className="text-ink-900 hover:text-brand-700 font-medium"
                    >
                      {offer.productTitle}
                    </Link>
                  </td>
                  <td className="text-ink-600 p-3">{offer.providerName}</td>
                  <td className="text-ink-600 p-3 tabular-nums">
                    {formatPrice(offer.currentPrice, offer.currency) ?? '—'}
                  </td>
                  <td className="p-3">
                    <Badge tone={STATUS_TONE[offer.status]}>{STATUS_LABEL[offer.status]}</Badge>
                  </td>
                  <td className="text-ink-600 p-3">{formatDate(offer.expiresAt)}</td>
                  <td className="text-ink-500 p-3">{formatDate(offer.lastCheckedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

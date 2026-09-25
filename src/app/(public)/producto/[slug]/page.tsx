import { Info, Store, Ticket } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Breadcrumbs } from '@/components/public/breadcrumbs';
import { JsonLd } from '@/components/public/json-ld';
import { OutboundCta } from '@/components/public/outbound-cta';
import { PriceTag } from '@/components/public/price-tag';
import { ProductGallery } from '@/components/public/product-gallery';
import { ProductGrid } from '@/components/public/product-grid';
import { Badge } from '@/components/ui/badge';
import { primaryOffer } from '@/domain/views';
import { siteUrl } from '@/lib/env';
import { buildBreadcrumbJsonLd, buildProductJsonLd } from '@/lib/seo/json-ld';
import { getProductBySlug, listRelatedProducts } from '@/repositories/catalog';
import { getSettings } from '@/repositories/settings';

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: 'Producto no encontrado' };

  const description =
    product.shortDescription ?? product.description?.slice(0, 160) ?? product.title;
  const image = product.images[0]?.url;

  return {
    title: product.title,
    description,
    alternates: { canonical: `/producto/${product.slug}` },
    openGraph: {
      title: product.title,
      description,
      type: 'website',
      url: `${siteUrl}/producto/${product.slug}`,
      ...(image ? { images: [image] } : {}),
    },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const [settings, related] = await Promise.all([
    getSettings(),
    listRelatedProducts(product.category?.id ?? null, product.id),
  ]);

  const offer = primaryOffer(product);
  const pageUrl = `${siteUrl}/producto/${product.slug}`;

  const crumbs = [
    { label: 'Inicio', href: '/' },
    { label: 'Productos', href: '/productos' },
    ...(product.category
      ? [{ label: product.category.name, href: `/categoria/${product.category.slug}` }]
      : []),
    { label: product.title },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <JsonLd
        data={[
          buildProductJsonLd(product, pageUrl),
          buildBreadcrumbJsonLd(
            crumbs.map((crumb) => ({
              name: crumb.label,
              url: crumb.href ? `${siteUrl}${crumb.href}` : pageUrl,
            })),
          ),
        ]}
      />

      <Breadcrumbs items={crumbs} />

      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        <ProductGallery images={product.images} title={product.title} />

        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            {product.category ? (
              <Link href={`/categoria/${product.category.slug}`}>
                <Badge tone="brand">{product.category.name}</Badge>
              </Link>
            ) : null}
            {product.featured ? <Badge tone="muted">Destacado</Badge> : null}
          </div>

          <h1 className="text-ink-900 text-2xl font-bold text-balance sm:text-3xl">
            {product.title}
          </h1>

          {product.shortDescription ? (
            <p className="text-ink-600 text-base">{product.shortDescription}</p>
          ) : null}

          {offer ? (
            <div className="border-ink-200 space-y-4 rounded-[--radius-card] border p-4">
              <PriceTag offer={offer} size="lg" />

              {offer.provider ? (
                <p className="text-ink-600 flex items-center gap-2 text-sm">
                  <Store aria-hidden className="size-4" />
                  Disponible en{' '}
                  <span className="text-ink-900 font-medium">{offer.provider.name}</span>
                </p>
              ) : null}

              {offer.couponCode ? (
                <p className="border-deal-600/30 bg-deal-50 text-deal-700 flex items-center gap-2 rounded-lg border p-3 text-sm">
                  <Ticket aria-hidden className="size-4 shrink-0" />
                  <span>
                    Cupón <code className="font-mono font-semibold">{offer.couponCode}</code>
                    {offer.couponDescription ? ` — ${offer.couponDescription}` : null}
                  </span>
                </p>
              ) : null}

              <OutboundCta
                offerId={offer.id}
                productId={product.id}
                affiliateUrl={offer.affiliateUrl}
                trackingMode={settings.outbound_tracking_mode}
                allowsRedirectTracking={offer.provider?.allowsRedirectTracking ?? false}
                className="w-full"
              />

              <p className="text-ink-500 flex items-start gap-2 text-xs">
                <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                El precio y la disponibilidad los fija la tienda y pueden haber cambiado desde la
                última comprobación.
              </p>
            </div>
          ) : (
            <p className="border-ink-200 text-ink-600 rounded-[--radius-card] border border-dashed p-4 text-sm">
              Ahora mismo no tenemos un enlace activo para este producto.
            </p>
          )}

          {product.description ? (
            <section aria-labelledby="descripcion" className="space-y-2">
              <h2 id="descripcion" className="text-ink-900 text-lg font-semibold">
                Descripción
              </h2>
              {/* Plain text only: descriptions are never rendered as HTML. */}
              <p className="text-ink-600 text-sm whitespace-pre-line">{product.description}</p>
            </section>
          ) : null}

          <p className="text-ink-500 text-xs">{settings.affiliate_disclosure}</p>
        </div>
      </div>

      {related.length > 0 ? (
        <section aria-labelledby="relacionados" className="mt-14">
          <h2 id="relacionados" className="text-ink-900 mb-4 text-xl font-semibold">
            También te puede interesar
          </h2>
          <ProductGrid products={related} trackingMode={settings.outbound_tracking_mode} />
        </section>
      ) : null}
    </div>
  );
}

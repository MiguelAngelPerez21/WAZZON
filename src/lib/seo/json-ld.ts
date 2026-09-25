import { primaryOffer, type ProductView } from '@/domain/views';

/**
 * Structured data builders.
 *
 * Rule: only fields we can prove. No `aggregateRating`, no `review`, no
 * `availability` — we do not track stock, so claiming it would be false.
 */

export interface JsonLdNode {
  '@context'?: string;
  '@type': string;
  [key: string]: unknown;
}

export function buildProductJsonLd(product: ProductView, pageUrl: string): JsonLdNode {
  const offer = primaryOffer(product);
  const description = product.shortDescription ?? product.description ?? undefined;

  const node: JsonLdNode = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    url: pageUrl,
  };

  if (description) node['description'] = description;
  if (product.images.length > 0) node['image'] = product.images.map((image) => image.url);
  if (product.category) node['category'] = product.category.name;

  if (offer && offer.currentPrice !== null) {
    node['offers'] = {
      '@type': 'Offer',
      price: offer.currentPrice.toFixed(2),
      priceCurrency: offer.currency,
      url: pageUrl,
      ...(offer.expiresAt ? { priceValidUntil: offer.expiresAt.slice(0, 10) } : {}),
      ...(offer.provider ? { seller: { '@type': 'Organization', name: offer.provider.name } } : {}),
    };
  }

  return node;
}

export function buildBreadcrumbJsonLd(items: { name: string; url: string }[]): JsonLdNode {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

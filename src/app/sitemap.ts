import type { MetadataRoute } from 'next';

import { siteUrl } from '@/lib/env';
import { listActiveCategories, listPublishedProductSlugs } from '@/repositories/catalog';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categories, products] = await Promise.all([
    listActiveCategories(),
    listPublishedProductSlugs(),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${siteUrl}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${siteUrl}/productos`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${siteUrl}/ofertas`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${siteUrl}/afiliacion`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${siteUrl}/privacidad`, changeFrequency: 'yearly', priority: 0.1 },
    { url: `${siteUrl}/cookies`, changeFrequency: 'yearly', priority: 0.1 },
    { url: `${siteUrl}/aviso-legal`, changeFrequency: 'yearly', priority: 0.1 },
  ];

  return [
    ...staticRoutes,
    ...categories.map((category) => ({
      url: `${siteUrl}/categoria/${category.slug}`,
      changeFrequency: 'daily' as const,
      priority: 0.7,
    })),
    ...products.map((product) => ({
      url: `${siteUrl}/producto/${product.slug}`,
      lastModified: new Date(product.updatedAt),
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    })),
  ];
}

import type { MetadataRoute } from 'next';

import { siteUrl } from '@/lib/env';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // `/go/` are affiliate redirects and `/buscar` produces infinite
        // crawlable combinations; neither belongs in an index.
        disallow: ['/admin', '/api/', '/go/', '/buscar'],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
